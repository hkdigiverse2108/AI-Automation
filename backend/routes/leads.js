const router = require('express').Router();
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const AuditLog = require('../models/AuditLog');
const { verifyToken } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');

router.use(verifyToken);

// GET /leads — List leads with filters, search, sorting, and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      status, 
      startDate, 
      endDate, 
      sortBy = 'createdAt', 
      sortOrder = 'desc', 
      page = 1, 
      limit = 20 
    } = req.query;

    const query = { userId: req.userId };

    // Filter by Status
    if (status) {
      query.status = status;
    }

    // Filter by Date Range
    if (startDate || endDate) {
      query.conversationDateTime = {};
      if (startDate) {
        query.conversationDateTime.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set to end of the day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.conversationDateTime.$lte = end;
      }
    }

    // Search query (name, companyName, email, phone, serviceRequired, projectDescription)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { companyName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { serviceRequired: searchRegex },
        { projectDescription: searchRegex }
      ];
    }

    // Sorting
    const sort = {};
    if (sortBy === 'budget') {
      sort.numericBudget = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'name') {
      sort.name = sortOrder === 'asc' ? 1 : -1;
    } else {
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    }

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('contactId', 'source tags notes profilePic')
        .lean(),
      Lead.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        leads,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch leads', code: 'FETCH_ERROR' });
  }
});

// GET /leads/export/csv — Export all matching leads as CSV
router.get('/export/csv', async (req, res) => {
  try {
    const { search, status, startDate, endDate } = req.query;

    const query = { userId: req.userId };

    if (status) query.status = status;

    if (startDate || endDate) {
      query.conversationDateTime = {};
      if (startDate) query.conversationDateTime.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.conversationDateTime.$lte = end;
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { companyName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { serviceRequired: searchRegex },
        { projectDescription: searchRegex }
      ];
    }

    const leads = await Lead.find(query).sort({ conversationDateTime: -1 }).lean();

    // Generate CSV string
    const headers = [
      'Customer Name',
      'Company Name',
      'Contact Phone',
      'Email Address',
      'Service Required',
      'Project Description',
      'Budget',
      'Timeline',
      'Preferred Technology',
      'Special Requirements',
      'Status',
      'AI Summary',
      'Notes',
      'Extraction Date'
    ];

    const escapeCsv = (val) => {
      if (val === undefined || val === null) return '';
      let str = String(val).replace(/"/g, '""'); // Escape double quotes
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        str = `"${str}"`;
      }
      return str;
    };

    const rows = leads.map(l => [
      l.name,
      l.companyName,
      l.phone,
      l.email,
      l.serviceRequired,
      l.projectDescription,
      l.budget,
      l.timeline,
      l.preferredTechnology,
      l.specialRequirements,
      l.status,
      l.aiSummary,
      l.notes,
      l.conversationDateTime ? new Date(l.conversationDateTime).toISOString() : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(escapeCsv).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, error: 'CSV export failed', code: 'EXPORT_ERROR' });
  }
});

// GET /leads/:id — Get details of a single lead, including full conversation history
router.get('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.userId })
      .populate('contactId')
      .lean();

    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }

    // Fetch conversation history
    const messages = await Message.find({ 
      userId: req.userId, 
      conversationId: lead.conversationId 
    })
      .sort({ timestamp: 1 })
      .lean();

    res.json({
      success: true,
      data: {
        lead,
        messages
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch lead details', code: 'FETCH_ERROR' });
  }
});

// PUT /leads/:id — Update lead status and manual notes section
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { status, notes } = req.body;

    const lead = await Lead.findOne({ _id: req.params.id, userId: req.userId });
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }

    if (status) {
      lead.status = status;
    }
    if (notes !== undefined) {
      lead.notes = notes;
    }

    await lead.save();

    await AuditLog.log({
      userId: req.userId,
      action: 'EDIT_LEAD',
      resource: 'Lead',
      resourceId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      data: { lead },
      message: 'Lead updated successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update lead', code: 'UPDATE_ERROR' });
  }
});

// DELETE /leads/:id — Delete lead
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }

    await AuditLog.log({
      userId: req.userId,
      action: 'DELETE_LEAD',
      resource: 'Lead',
      resourceId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete lead', code: 'DELETE_ERROR' });
  }
});

module.exports = router;

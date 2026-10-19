const router = require('express').Router();
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const AuditLog = require('../models/AuditLog');
const { verifyToken } = require('../middleware/auth');
const checkFeatureAccess = require('../middleware/checkFeatureAccess');

router.use(verifyToken);
router.use(checkFeatureAccess('contacts'));

// GET /leads - list leads
router.get('/', async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    
    // Filter contacts that have any bot flow interaction
    const query = { 
      userId: req.userId, 
      isDeleted: { $ne: true },
      $or: [
        { 'customFields.currentStep': { $exists: true } },
        { 'customFields.conversationHistory': { $exists: true } },
        { 'customFields.selectedService': { $exists: true } },
        { 'customFields.businessCategory': { $exists: true } },
        { 'customFields.paymentScreenshot': { $exists: true } },
        { 'customFields.city': { $exists: true } }
      ]
    };

    const { getOekForUser, decryptContact } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);
    const cleanSearch = (search || '').trim();
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 20);

    let leads = [];
    let total = 0;

    const transformLead = (c) => {
      const decrypted = decryptContact(c, rawOek);
      return {
        ...decrypted,
        assignedAgent: c.assignedAgent || null,
        status: decrypted.customFields?.status || 'new',
        serviceRequired: decrypted.customFields?.selectedService || decrypted.customFields?.service || decrypted.customFields?.businessCategory || '',
        projectDescription: decrypted.customFields?.subService || decrypted.customFields?.description || '',
        budget: decrypted.customFields?.budget || '',
        timeline: decrypted.customFields?.timeline || '',
        preferredTechnology: decrypted.customFields?.meetingPreference || '',
        specialRequirements: decrypted.customFields?.companySize || ''
      };
    };

    if ((req.query.all === 'true' || limitNum >= 500) && !cleanSearch) {
      const allContacts = await Contact.find(query)
        .populate('assignedAgent', 'name email role avatar')
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .lean();
      leads = allContacts.map(transformLead);
      return res.json({
        success: true,
        data: {
          leads,
          total: leads.length,
          page: 1,
          pages: 1
        }
      });
    }

    if (!cleanSearch) {
      const skip = (pageNum - 1) * limitNum;
      const [contacts, totalCount] = await Promise.all([
        Contact.find(query)
          .populate('assignedAgent', 'name email role avatar')
          .sort({ lastMessageAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Contact.countDocuments(query)
      ]);

      leads = contacts.map(transformLead);
      total = totalCount;
    } else {
      // Live smart search:
      // Fetch user's candidate lead contacts, decrypt, and perform full search across all fields
      const allCandidates = await Contact.find(query)
        .populate('assignedAgent', 'name email role avatar')
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .lean();
      const searchTokens = cleanSearch.toLowerCase().split(/\s+/).filter(Boolean);
      const digitsOnly = cleanSearch.replace(/\D/g, '');

      const decryptedAll = allCandidates.map(transformLead);

      const matchedLeads = decryptedAll.filter((lead) => {
        const nameStr = (lead.name || '').toLowerCase();
        const phoneStr = (lead.phone || '').toString();
        const phoneClean = phoneStr.replace(/\D/g, '');
        const emailStr = (lead.email || '').toLowerCase();
        const serviceStr = (lead.serviceRequired || '').toLowerCase();
        const descStr = (lead.projectDescription || '').toLowerCase();
        const budgetStr = (lead.budget || '').toString().toLowerCase();
        const timelineStr = (lead.timeline || '').toString().toLowerCase();
        const statusStr = (lead.status || '').toLowerCase();
        const segmentStr = (lead.segment || '').toLowerCase();
        const cityStr = (lead.customFields?.city || '').toLowerCase();
        const notesStr = (lead.notes || '').toLowerCase();
        const assignedAgentStr = (lead.assignedAgent?.name || '').toLowerCase();
        const idStr = (lead._id || '').toString().toLowerCase();

        // Match ID
        if (idStr.includes(cleanSearch.toLowerCase())) return true;

        // Match phone digits (e.g. partial phone digits like last 4 digits)
        if (digitsOnly && digitsOnly.length >= 2 && phoneClean.includes(digitsOnly)) {
          return true;
        }

        // Match search tokens across combined string
        const textBlob = `${nameStr} ${phoneStr} ${emailStr} ${serviceStr} ${descStr} ${budgetStr} ${timelineStr} ${statusStr} ${segmentStr} ${cityStr} ${notesStr} ${assignedAgentStr}`;
        if (searchTokens.every(tok => textBlob.includes(tok))) {
          return true;
        }

        // Search in custom fields values
        if (lead.customFields && typeof lead.customFields === 'object') {
          for (const val of Object.values(lead.customFields)) {
            if (val && typeof val === 'string' && val.toLowerCase().includes(cleanSearch.toLowerCase())) {
              return true;
            }
          }
        }

        return false;
      });

      total = matchedLeads.length;
      const skip = (pageNum - 1) * limitNum;
      leads = matchedLeads.slice(skip, skip + limitNum);
    }

    res.json({ 
      success: true, 
      data: { 
        leads, 
        total, 
        page: pageNum, 
        pages: Math.max(1, Math.ceil(total / limitNum)) 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch leads', code: 'FETCH_ERROR' });
  }
});

// GET /leads/agents - list assignable team agents/members
router.get('/agents', async (req, res) => {
  try {
    const User = require('../models/User');
    const ownerId = req.userId;
    const orConditions = [
      { _id: ownerId },
      { ownerId: ownerId }
    ];
    if (req.user && req.user.organizationId) {
      orConditions.push({ organizationId: req.user.organizationId });
    }
    const query = {
      isDeleted: { $ne: true },
      $or: orConditions
    };
    const agents = await User.find(query).select('name email role avatar').sort({ name: 1 }).lean();
    res.json({ success: true, data: { agents } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch agents', details: error.message });
  }
});

// GET /leads/:id - get single lead
router.get('/:id', async (req, res) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, userId: req.userId, isDeleted: { $ne: true } })
      .populate('assignedAgent', 'name email role avatar')
      .lean();
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }

    const { getOekForUser, decryptContact, decryptMessage } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);
    const decrypted = decryptContact(contact, rawOek);

    const lead = {
      ...decrypted,
      assignedAgent: contact.assignedAgent || null,
      status: decrypted.customFields?.status || 'new',
      serviceRequired: decrypted.customFields?.selectedService || decrypted.customFields?.service || decrypted.customFields?.businessCategory || '',
      projectDescription: decrypted.customFields?.subService || decrypted.customFields?.description || '',
      budget: decrypted.customFields?.budget || '',
      timeline: decrypted.customFields?.timeline || '',
      preferredTechnology: decrypted.customFields?.meetingPreference || '',
      specialRequirements: decrypted.customFields?.companySize || ''
    };

    // Fetch message history
    const messages = await Message.find({ userId: req.userId, contactId: contact._id }).sort({ timestamp: 1 }).lean();
    const decryptedMessages = messages.map(m => decryptMessage(m, rawOek));

    res.json({
      success: true,
      data: {
        lead,
        messages: decryptedMessages
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch lead details', code: 'FETCH_ERROR' });
  }
});

// PUT /leads/:id - update lead status, notes, assignedAgent, and bot flow details
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, notes, status, serviceRequired, budget, timeline, city, specialRequirements, assignedAgent } = req.body;
    
    // Find the contact
    const contact = await Contact.findOne({ _id: req.params.id, userId: req.userId, isDeleted: { $ne: true } });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }

    if (name !== undefined) contact.name = name;
    if (phone !== undefined) contact.phone = phone.replace(/\D/g, '');
    if (email !== undefined) contact.email = email;
    if (notes !== undefined) contact.notes = notes;

    if (!contact.customFields) contact.customFields = new Map();

    if (status !== undefined) contact.customFields.set('status', status);
    if (serviceRequired !== undefined) {
      contact.customFields.set('selectedService', serviceRequired);
      contact.customFields.set('service', serviceRequired);
      contact.customFields.set('businessCategory', serviceRequired);
    }
    if (budget !== undefined) contact.customFields.set('budget', budget);
    if (timeline !== undefined) contact.customFields.set('timeline', timeline);
    if (city !== undefined) contact.customFields.set('city', city);
    if (specialRequirements !== undefined) {
      contact.customFields.set('companySize', specialRequirements);
      contact.customFields.set('specialRequirements', specialRequirements);
    }

    if (assignedAgent !== undefined) {
      if (!assignedAgent || assignedAgent === 'unassigned' || assignedAgent === '') {
        contact.assignedAgent = null;
      } else if (require('mongoose').Types.ObjectId.isValid(assignedAgent)) {
        contact.assignedAgent = assignedAgent;
      }
      // Also update conversation assignment if exists
      const Conversation = require('../models/Conversation');
      await Conversation.updateMany(
        { contactId: contact._id, userId: req.userId },
        { 
          assignedAgent: contact.assignedAgent, 
          assigned_agent_id: contact.assignedAgent 
        }
      );
    }

    contact.markModified('customFields');
    await contact.save();
    await contact.populate('assignedAgent', 'name email role avatar');

    const { getOekForUser, decryptContact } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);
    const decrypted = decryptContact(contact, rawOek);

    const lead = {
      ...decrypted,
      assignedAgent: contact.assignedAgent || null,
      status: decrypted.customFields?.status || 'new',
      serviceRequired: decrypted.customFields?.selectedService || decrypted.customFields?.service || decrypted.customFields?.businessCategory || '',
      projectDescription: decrypted.customFields?.subService || decrypted.customFields?.description || '',
      budget: decrypted.customFields?.budget || '',
      timeline: decrypted.customFields?.timeline || '',
      preferredTechnology: decrypted.customFields?.meetingPreference || '',
      specialRequirements: decrypted.customFields?.companySize || ''
    };

    res.json({
      success: true,
      data: { lead }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update lead', code: 'UPDATE_ERROR' });
  }
});

// DELETE /leads/:id - permanently delete a lead (contact) and all associated messages/conversations
router.delete('/:id', async (req, res) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, userId: req.userId });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }

    const Conversation = require('../models/Conversation');
    const Message = require('../models/Message');

    // 1. Find conversation to cascade delete its messages and the conversation itself
    const conversation = await Conversation.findOne({ contactId: contact._id, userId: req.userId });
    if (conversation) {
      await Message.deleteMany({ conversationId: conversation._id, userId: req.userId });
      await Conversation.deleteOne({ _id: conversation._id, userId: req.userId });
    }

    // 2. Permanently delete the contact from database
    await Contact.deleteOne({ _id: contact._id, userId: req.userId });

    // 3. Log action
    await AuditLog.log({
      userId: req.userId,
      action: 'DELETE_LEAD',
      resource: 'Contact',
      resourceId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    res.json({ success: true, message: 'Lead and associated conversations/messages permanently deleted successfully from the database.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Delete failed', code: 'DELETE_ERROR' });
  }
});

module.exports = router;

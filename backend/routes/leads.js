const router = require('express').Router();
const Contact = require('../models/Contact');
const Message = require('../models/Message');
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

    if (search) {
      const { getOekForUser, generateHMAC } = require('../services/oekService');
      const rawOek = await getOekForUser(req.userId);
      if (rawOek) {
        const hmacSearch = generateHMAC(search, rawOek);
        query.$and = [
          {
            $or: [
              { nameHash: hmacSearch },
              { phoneHash: hmacSearch }
            ]
          }
        ];
      } else {
        query.$and = [
          {
            $or: [
              { name: { $regex: search, $options: 'i' } },
              { phone: { $regex: search, $options: 'i' } }
            ]
          }
        ];
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [contacts, total] = await Promise.all([
      Contact.find(query).sort({ lastMessageAt: -1, createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Contact.countDocuments(query)
    ]);

    const { getOekForUser, decryptContact } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);
    
    const leads = contacts.map(c => {
      const decrypted = decryptContact(c, rawOek);
      return {
        ...decrypted,
        status: decrypted.customFields?.status || 'new',
        serviceRequired: decrypted.customFields?.selectedService || decrypted.customFields?.service || decrypted.customFields?.businessCategory || '',
        projectDescription: decrypted.customFields?.subService || decrypted.customFields?.description || '',
        budget: decrypted.customFields?.budget || '',
        timeline: decrypted.customFields?.timeline || '',
        preferredTechnology: decrypted.customFields?.meetingPreference || '',
        specialRequirements: decrypted.customFields?.companySize || ''
      };
    });

    res.json({ 
      success: true, 
      data: { 
        leads, 
        total, 
        page: parseInt(page), 
        pages: Math.ceil(total / parseInt(limit)) 
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch leads', code: 'FETCH_ERROR' });
  }
});

// GET /leads/:id - get single lead
router.get('/:id', async (req, res) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, userId: req.userId, isDeleted: { $ne: true } }).lean();
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }

    const { getOekForUser, decryptContact, decryptMessage } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);
    const decrypted = decryptContact(contact, rawOek);

    const lead = {
      ...decrypted,
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

// PUT /leads/:id - update lead status and notes
router.put('/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    // Find the contact
    const contact = await Contact.findOne({ _id: req.params.id, userId: req.userId, isDeleted: { $ne: true } });
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Lead not found', code: 'NOT_FOUND' });
    }

    if (notes !== undefined) contact.notes = notes;
    if (status !== undefined) {
      if (!contact.customFields) contact.customFields = new Map();
      contact.customFields.set('status', status);
      contact.markModified('customFields');
    }

    await contact.save();

    const { getOekForUser, decryptContact } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);
    const decrypted = decryptContact(contact, rawOek);

    const lead = {
      ...decrypted,
      status: decrypted.customFields?.status || 'new'
    };

    res.json({
      success: true,
      data: { lead }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update lead', code: 'UPDATE_ERROR' });
  }
});

module.exports = router;

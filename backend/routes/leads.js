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

// PUT /leads/:id - update lead status, notes, and bot flow details
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, email, notes, status, serviceRequired, budget, timeline, city, specialRequirements } = req.body;
    
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

    contact.markModified('customFields');
    await contact.save();

    const { getOekForUser, decryptContact } = require('../services/oekService');
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

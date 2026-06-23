const router = require('express').Router();
const mongoose = require('mongoose');
const multer = require('multer');
const Contact = require('../models/Contact');
const AuditLog = require('../models/AuditLog');
const { verifyToken } = require('../middleware/auth');
const { contactValidation, validateObjectId } = require('../middleware/validator');
const { createNotification } = require('../services/notificationService');

router.use(verifyToken);
const checkFeatureAccess = require('../middleware/checkFeatureAccess');
router.use(checkFeatureAccess('contacts'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /contacts
router.get('/', async (req, res) => {
  try {
    const { search, tags, source, optedOut, segment, groupId, page = 1, limit = 20, sort = '-createdAt' } = req.query;
    const query = { userId: req.userId, isDeleted: { $ne: true } };

    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
      const ContactGroup = require('../models/ContactGroup');
      const mapping = await ContactGroup.find({ groupId, organizationId: req.organizationId }).select('contactId').lean();
      const contactIds = mapping.map((m) => m.contactId);
      query._id = { $in: contactIds };
    }

    if (search) {
      const { getOekForUser, generateHMAC, decryptAES } = require('../services/oekService');
      const rawOek = await getOekForUser(req.userId);
      
      const Tag = require('../models/Tag');
      const ContactNote = require('../models/ContactNote');

      // 1. Search tags by name
      const matchedTags = await Tag.find({ organizationId: req.organizationId, name: { $regex: search, $options: 'i' } }).select('name').lean();
      const matchedTagNames = matchedTags.map(t => t.name);

      // 2. Search notes by text
      let noteContactIds = [];
      if (rawOek) {
        const allNotes = await ContactNote.find({ organizationId: req.organizationId }).select('contactId note isEncrypted').lean();
        for (const n of allNotes) {
          const decNote = n.isEncrypted ? decryptAES(n.note, rawOek) : n.note;
          if (decNote && decNote.toLowerCase().includes(search.toLowerCase())) {
            noteContactIds.push(n.contactId);
          }
        }
      } else {
        const matchedNotes = await ContactNote.find({
          organizationId: req.organizationId,
          note: { $regex: search, $options: 'i' }
        }).select('contactId').lean();
        noteContactIds = matchedNotes.map(n => n.contactId);
      }

      // 3. Search standard fields
      let searchConditions = [];
      if (rawOek) {
        const hmacSearch = generateHMAC(search, rawOek);
        searchConditions = [
          { nameHash: hmacSearch },
          { phoneHash: hmacSearch },
          { emailHash: hmacSearch },
        ];
      } else {
        searchConditions = [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      // 4. Combine search conditions
      query.$or = [...searchConditions];
      if (matchedTagNames.length > 0) {
        query.$or.push({ tags: { $in: matchedTagNames } });
      }
      if (noteContactIds.length > 0) {
        query.$or.push({ _id: { $in: noteContactIds } });
      }
    }
    if (tags) query.tags = { $in: tags.split(',') };
    if (source) query.source = source;
    if (segment) query.segment = segment;
    if (optedOut !== undefined) query.optedOut = optedOut === 'true';

    // Additional filters
    if (req.query.assignedAgent) {
      if (mongoose.Types.ObjectId.isValid(req.query.assignedAgent)) {
        query.assignedAgent = req.query.assignedAgent;
      } else if (req.query.assignedAgent === 'unassigned') {
        query.assignedAgent = { $exists: false };
      }
    }

    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
    }

    if (req.query.lastActivityStart || req.query.lastActivityEnd) {
      query.lastMessageAt = {};
      if (req.query.lastActivityStart) query.lastMessageAt.$gte = new Date(req.query.lastActivityStart);
      if (req.query.lastActivityEnd) query.lastMessageAt.$lte = new Date(req.query.lastActivityEnd);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [contacts, total] = await Promise.all([
      Contact.find(query).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      Contact.countDocuments(query),
    ]);

    const { getOekForUser, decryptContact } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);
    const decryptedContacts = contacts.map((c) => decryptContact(c, rawOek));

    res.json({ success: true, data: { contacts: decryptedContacts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch contacts', code: 'FETCH_ERROR' });
  }
});

// POST /contacts — create single
router.post('/', contactValidation, async (req, res) => {
  try {
    let { phone, name, email, source, tags } = req.body;
    if (phone) phone = phone.replace(/\D/g, '');

    const { getOekForUser, generateHMAC } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);
    let existing;
    if (rawOek) {
      const phoneHash = generateHMAC(phone, rawOek);
      existing = await Contact.findOne({ userId: req.userId, $or: [{ phone }, { phoneHash }], isDeleted: { $ne: true } });
    } else {
      existing = await Contact.findOne({ userId: req.userId, phone, isDeleted: { $ne: true } });
    }

    if (existing) return res.status(409).json({ success: false, error: 'Contact already exists', code: 'DUPLICATE' });

    const contact = await Contact.create({ userId: req.userId, phone, name, email, source: source || 'manual', tags: tags || [] });

    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'contact',
      title: 'New Contact Created 👤',
      message: `Contact "${name || phone}" was successfully created.`,
      link: '/dashboard/contacts',
      metadata: { contactId: contact._id }
    });

    res.status(201).json({ success: true, data: { contact }, message: 'Contact created' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create contact', code: 'CREATE_ERROR' });
  }
});

// POST /contacts/import — CSV upload
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'CSV file required', code: 'NO_FILE' });

    const csv = req.file.buffer.toString('utf-8');
    const lines = csv.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return res.status(400).json({ success: false, error: 'CSV must have header and data', code: 'INVALID_CSV' });

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const phoneIdx = headers.indexOf('phone');
    const nameIdx = headers.indexOf('name');
    const emailIdx = headers.indexOf('email');
    const tagsIdx = headers.indexOf('tags');

    if (phoneIdx === -1) return res.status(400).json({ success: false, error: 'CSV must have phone column', code: 'MISSING_PHONE' });

    const { getOekForUser, generateHMAC, encryptAES } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);

    let imported = 0, skipped = 0, errors = 0;
    const ops = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim());
      const rawPhone = cols[phoneIdx];
      if (!rawPhone || !/^\+?[1-9]\d{6,14}$/.test(rawPhone)) { errors++; continue; }
      const phone = rawPhone.replace(/\D/g, '');

      let updatePayload = {
        userId: req.userId,
        phone,
        name: nameIdx >= 0 ? cols[nameIdx] || '' : '',
        email: emailIdx >= 0 ? cols[emailIdx] || '' : '',
        tags: tagsIdx >= 0 ? (cols[tagsIdx] || '').split(';').filter(Boolean) : [],
        source: 'import',
      };

      let filterCondition = { userId: req.userId, phone };

      if (rawOek) {
        const encryptedPhone = encryptAES(phone, rawOek);
        const phoneHash = generateHMAC(phone, rawOek);
        const nameVal = nameIdx >= 0 ? cols[nameIdx] || '' : '';
        const emailVal = emailIdx >= 0 ? cols[emailIdx] || '' : '';
        
        updatePayload = {
          userId: req.userId,
          phone: encryptedPhone,
          phoneHash,
          name: encryptAES(nameVal, rawOek),
          nameHash: generateHMAC(nameVal, rawOek),
          email: encryptAES(emailVal, rawOek),
          emailHash: generateHMAC(emailVal, rawOek),
          tags: tagsIdx >= 0 ? (cols[tagsIdx] || '').split(';').filter(Boolean) : [],
          source: 'import',
          isEncrypted: true
        };

        filterCondition = { userId: req.userId, $or: [{ phone }, { phoneHash }] };
      }

      ops.push({
        updateOne: {
          filter: filterCondition,
          update: {
            $setOnInsert: updatePayload,
          },
          upsert: true,
        },
      });
    }

    if (ops.length > 0) {
      const result = await Contact.bulkWrite(ops, { ordered: false });
      imported = result.upsertedCount || 0;
      skipped = ops.length - imported;
    }

    res.json({ success: true, data: { imported, skipped, errors, total: lines.length - 1 }, message: 'Import complete' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Import failed', code: 'IMPORT_ERROR' });
  }
});

// PUT /contacts/:id
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { name, email, tags, notes, customFields } = req.body;
    const contact = await Contact.findOne({ _id: req.params.id, userId: req.userId, isDeleted: { $ne: true } });
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found', code: 'NOT_FOUND' });

    if (name !== undefined) contact.name = name;
    if (email !== undefined) contact.email = email;
    if (tags !== undefined) contact.tags = tags;
    if (notes !== undefined) contact.notes = notes;
    if (req.body.optedOut !== undefined) {
      contact.optedOut = req.body.optedOut;
      if (req.body.optedOut) contact.optedOutAt = new Date();
      else contact.optedOutAt = undefined;
    }
    if (customFields) {
      for (const [k, v] of Object.entries(customFields)) {
        contact.customFields.set(k, v);
      }
    }
    await contact.save();

    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'contact',
      title: 'Contact Updated 👤',
      message: `Contact "${contact.name || contact.phone}" details were updated.`,
      link: '/dashboard/contacts',
      metadata: { contactId: contact._id }
    });

    res.json({ success: true, data: { contact }, message: 'Contact updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Update failed', code: 'UPDATE_ERROR' });
  }
});

// DELETE /contacts/:id — permanently delete a contact
router.delete('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, userId: req.userId });
    if (!contact) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });

    const Conversation = require('../models/Conversation');
    const Message = require('../models/Message');

    // 1. Find conversation to cascade delete its messages and the conversation itself
    const conversation = await Conversation.findOne({ contactId: contact._id, userId: req.userId });
    if (conversation) {
      await Message.deleteMany({ conversationId: conversation._id, userId: req.userId });
      await Conversation.deleteOne({ _id: conversation._id, userId: req.userId });
    }

    // 2. Permanently delete the contact from the database
    await Contact.deleteOne({ _id: contact._id, userId: req.userId });

    await AuditLog.log({ userId: req.userId, action: 'DELETE_CONTACT', resource: 'Contact', resourceId: req.params.id, ip: req.ip, userAgent: req.headers['user-agent'] });

    res.json({ success: true, message: 'Contact and all associated conversations/messages permanently deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Delete failed', code: 'DELETE_ERROR' });
  }
});

// POST /contacts/:id/opt-out
router.post('/:id/opt-out', ...validateObjectId('id'), async (req, res) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, userId: req.userId });
    if (!contact) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });

    contact.optedOut = true;
    contact.optedOutAt = new Date();
    await contact.save();

    res.json({ success: true, message: 'Contact opted out' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Opt-out failed', code: 'OPTOUT_ERROR' });
  }
});

// POST /contacts/recalculate-scores
router.post('/recalculate-scores', async (req, res) => {
  try {
    const { recalculateAllScores } = require('../services/scoring');
    const result = await recalculateAllScores(req.userId);
    res.json({ success: true, data: result, message: 'Scoring recalculation complete' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to recalculate scores', code: 'RECALC_ERROR' });
  }
});

// GET /contacts/:id — single contact
router.get('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const contact = await Contact.findOne({ _id: req.params.id, userId: req.userId, isDeleted: { $ne: true } });
    if (!contact) return res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
    res.json({ success: true, data: { contact } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Fetch failed', code: 'FETCH_ERROR' });
  }
});

// POST /contacts/:id/add-tag — assign tag to contact
router.post('/:id/add-tag', ...validateObjectId('id'), async (req, res) => {
  try {
    const contactId = req.params.id;
    const { tagId, tagName } = req.body;
    if (!tagId && !tagName) {
      return res.status(400).json({ success: false, error: 'tagId or tagName is required' });
    }

    const contact = await Contact.findOne({ _id: contactId, userId: req.userId, isDeleted: { $ne: true } });
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });

    const Tag = require('../models/Tag');
    let tag;
    if (tagId) {
      tag = await Tag.findOne({ _id: tagId, organizationId: req.organizationId });
    } else {
      tag = await Tag.findOne({ name: tagName.trim().toLowerCase(), organizationId: req.organizationId });
    }

    if (!tag) return res.status(404).json({ success: false, error: 'Tag not found in library' });

    const ContactTag = require('../models/ContactTag');
    const existingLink = await ContactTag.findOne({ contactId, tagId: tag._id });
    if (!existingLink) {
      await ContactTag.create({
        organizationId: req.organizationId,
        contactId,
        tagId: tag._id
      });
    }

    if (!contact.tags.includes(tag.name)) {
      contact.tags.push(tag.name);
      await contact.save();
    }

    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'contact',
      title: 'Tag Added to Contact 🏷️',
      message: `Tag "${tag.name}" was added to contact "${contact.name || contact.phone}".`,
      link: '/dashboard/contacts',
      metadata: { contactId: contact._id, tagId: tag._id }
    });

    res.json({ success: true, data: { tags: contact.tags }, message: 'Tag added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add tag', details: error.message });
  }
});

// POST /contacts/:id/remove-tag — remove tag from contact
router.post('/:id/remove-tag', ...validateObjectId('id'), async (req, res) => {
  try {
    const contactId = req.params.id;
    const { tagId, tagName } = req.body;
    if (!tagId && !tagName) {
      return res.status(400).json({ success: false, error: 'tagId or tagName is required' });
    }

    const contact = await Contact.findOne({ _id: contactId, userId: req.userId, isDeleted: { $ne: true } });
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });

    const Tag = require('../models/Tag');
    let tag;
    if (tagId) {
      tag = await Tag.findOne({ _id: tagId, organizationId: req.organizationId });
    } else {
      tag = await Tag.findOne({ name: tagName.trim().toLowerCase(), organizationId: req.organizationId });
    }

    if (!tag) return res.status(404).json({ success: false, error: 'Tag not found' });

    const ContactTag = require('../models/ContactTag');
    await ContactTag.deleteOne({ contactId, tagId: tag._id });

    contact.tags = contact.tags.filter(t => t !== tag.name);
    await contact.save();

    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'contact',
      title: 'Tag Removed from Contact 🏷️',
      message: `Tag "${tag.name}" was removed from contact "${contact.name || contact.phone}".`,
      link: '/dashboard/contacts',
      metadata: { contactId: contact._id, tagId: tag._id }
    });

    res.json({ success: true, data: { tags: contact.tags }, message: 'Tag removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove tag', details: error.message });
  }
});

// GET /contacts/:id/notes — fetch notes list
router.get('/:id/notes', ...validateObjectId('id'), async (req, res) => {
  try {
    const contactId = req.params.id;
    const contact = await Contact.findOne({ _id: contactId, userId: req.userId, isDeleted: { $ne: true } });
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });

    const ContactNote = require('../models/ContactNote');
    const notes = await ContactNote.find({ contactId, organizationId: req.organizationId })
      .populate('createdBy', 'name email role')
      .sort({ isPinned: -1, createdAt: -1 });

    res.json({ success: true, data: { notes } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch contact notes', details: error.message });
  }
});

// POST /contacts/:id/notes — add a note
router.post('/:id/notes', ...validateObjectId('id'), async (req, res) => {
  try {
    const contactId = req.params.id;
    const { note } = req.body;
    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, error: 'Note content is required' });
    }

    const contact = await Contact.findOne({ _id: contactId, userId: req.userId, isDeleted: { $ne: true } });
    if (!contact) return res.status(404).json({ success: false, error: 'Contact not found' });

    const ContactNote = require('../models/ContactNote');
    const newNote = await ContactNote.create({
      organizationId: req.organizationId,
      contactId,
      note: note.trim(),
      createdBy: req.user._id,
    });

    await newNote.populate('createdBy', 'name email role');

    await createNotification({
      userId: req.user._id,
      organizationId: req.organizationId,
      type: 'contact',
      title: 'New Note Added 📝',
      message: `A new note was added to contact "${contact.name || contact.phone}".`,
      link: '/dashboard/contacts',
      metadata: { contactId: contact._id, noteId: newNote._id }
    });

    res.status(201).json({ success: true, data: { note: newNote }, message: 'Note added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create note', details: error.message });
  }
});

module.exports = router;

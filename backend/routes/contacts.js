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
    const baseQuery = { userId: req.userId, isDeleted: { $ne: true } };

    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) {
      const ContactGroup = require('../models/ContactGroup');
      const mapping = await ContactGroup.find({ groupId, organizationId: req.organizationId }).select('contactId').lean();
      const contactIds = mapping.map((m) => m.contactId);
      baseQuery._id = { $in: contactIds };
    }

    if (tags) baseQuery.tags = { $in: tags.split(',') };
    if (source) baseQuery.source = source;
    if (segment) baseQuery.segment = segment;
    if (optedOut !== undefined) baseQuery.optedOut = optedOut === 'true';

    // Additional filters
    if (req.query.assignedAgent) {
      if (mongoose.Types.ObjectId.isValid(req.query.assignedAgent)) {
        baseQuery.assignedAgent = req.query.assignedAgent;
      } else if (req.query.assignedAgent === 'unassigned') {
        baseQuery.assignedAgent = { $exists: false };
      }
    }

    if (req.query.startDate || req.query.endDate) {
      baseQuery.createdAt = {};
      if (req.query.startDate) baseQuery.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) baseQuery.createdAt.$lte = new Date(req.query.endDate);
    }

    if (req.query.lastActivityStart || req.query.lastActivityEnd) {
      baseQuery.lastMessageAt = {};
      if (req.query.lastActivityStart) baseQuery.lastMessageAt.$gte = new Date(req.query.lastActivityStart);
      if (req.query.lastActivityEnd) baseQuery.lastMessageAt.$lte = new Date(req.query.lastActivityEnd);
    }

    const { getOekForUser, decryptContact, decryptAES, generateHMAC } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleanSearch = (search || '').trim();

    let decryptedContacts = [];
    let total = 0;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;

    if (!cleanSearch) {
      // Normal paginated query without search
      const skip = (pageNum - 1) * limitNum;
      const [contacts, totalCount] = await Promise.all([
        Contact.find(baseQuery).sort(sort).skip(skip).limit(limitNum).lean(),
        Contact.countDocuments(baseQuery),
      ]);
      decryptedContacts = contacts.map((c) => decryptContact(c, rawOek));
      total = totalCount;
    } else {
      // Universal Smart Search
      // Step A: Database-level candidates query
      const escapedSearch = escapeRegex(cleanSearch);
      const searchTokens = cleanSearch.toLowerCase().split(/\s+/).filter(Boolean);
      const digitsOnly = cleanSearch.replace(/\D/g, '');

      const dbSearchConditions = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { phone: { $regex: escapedSearch, $options: 'i' } },
        { email: { $regex: escapedSearch, $options: 'i' } },
        { tags: { $regex: escapedSearch, $options: 'i' } },
        { notes: { $regex: escapedSearch, $options: 'i' } },
      ];

      if (digitsOnly && digitsOnly.length >= 2) {
        dbSearchConditions.push({ phone: { $regex: digitsOnly } });
      }

      if (mongoose.Types.ObjectId.isValid(cleanSearch)) {
        dbSearchConditions.push({ _id: new mongoose.Types.ObjectId(cleanSearch) });
      }

      if (rawOek) {
        const hmacSearch = generateHMAC(cleanSearch, rawOek);
        dbSearchConditions.push(
          { nameHash: hmacSearch },
          { phoneHash: hmacSearch },
          { emailHash: hmacSearch }
        );
        if (digitsOnly) {
          dbSearchConditions.push({ phoneHash: generateHMAC(digitsOnly, rawOek) });
        }
      }

      // Check if any contacts in DB are encrypted
      const hasEncryptedContacts = rawOek || await Contact.exists({ ...baseQuery, isEncrypted: true });

      if (hasEncryptedContacts) {
        // When encrypted data exists, fetch user's candidate contacts, decrypt and do full fuzzy/substring match
        const allCandidates = await Contact.find(baseQuery).sort(sort).lean();
        const decryptedAll = allCandidates.map((c) => decryptContact(c, rawOek));

        const matched = decryptedAll.filter((c) => {
          const nameStr = (c.name || '').toLowerCase();
          const phoneStr = (c.phone || '').toString();
          const phoneClean = phoneStr.replace(/\D/g, '');
          const emailStr = (c.email || '').toLowerCase();
          const tagsStr = Array.isArray(c.tags) ? c.tags.join(' ').toLowerCase() : '';
          const notesStr = (c.notes || '').toLowerCase();
          const idStr = (c._id || '').toString().toLowerCase();

          // Match by ID
          if (idStr.includes(cleanSearch.toLowerCase())) return true;

          // Match by clean phone digits
          if (digitsOnly && digitsOnly.length >= 2 && phoneClean.includes(digitsOnly)) {
            return true;
          }

          // Match if every search word is present in name, phone, email, tags or notes
          const fullBlob = `${nameStr} ${phoneStr} ${emailStr} ${tagsStr} ${notesStr}`;
          const allTokensMatch = searchTokens.every(tok => fullBlob.includes(tok));
          if (allTokensMatch) return true;

          // Also check customFields values
          if (c.customFields && typeof c.customFields === 'object') {
            const cfValues = Object.values(c.customFields).join(' ').toLowerCase();
            if (searchTokens.every(tok => `${fullBlob} ${cfValues}`.includes(tok))) {
              return true;
            }
          }

          return false;
        });

        total = matched.length;
        const skip = (pageNum - 1) * limitNum;
        decryptedContacts = matched.slice(skip, skip + limitNum);
      } else {
        // Plaintext direct MongoDB database search
        const query = {
          ...baseQuery,
          $or: dbSearchConditions,
        };

        const skip = (pageNum - 1) * limitNum;
        const [contacts, totalCount] = await Promise.all([
          Contact.find(query).sort(sort).skip(skip).limit(limitNum).lean(),
          Contact.countDocuments(query),
        ]);

        decryptedContacts = contacts.map((c) => decryptContact(c, rawOek));
        total = totalCount;
      }
    }

    res.json({
      success: true,
      data: {
        contacts: decryptedContacts,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error('Fetch contacts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch contacts', code: 'FETCH_ERROR' });
  }
});

// POST /contacts — create single
router.post('/', contactValidation, async (req, res) => {
  try {
    let { phone, name, email, source, tags, customFields } = req.body;
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

    if (existing) return res.status(409).json({ success: false, error: 'Contact already exists with this phone number', code: 'DUPLICATE' });

    const contactData = {
      userId: req.userId,
      phone,
      name: name || '',
      email: email || '',
      source: source || 'manual',
      tags: tags || []
    };

    if (customFields && typeof customFields === 'object') {
      contactData.customFields = customFields;
    }

    const contact = await Contact.create(contactData);

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

// POST /contacts/import — CSV / Excel upload (.csv, .xlsx, .xls)
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'File is required (.csv, .xlsx, or .xls)', code: 'NO_FILE' });

    const xlsx = require('xlsx');
    let workbook;
    try {
      workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    } catch (parseErr) {
      return res.status(400).json({ success: false, error: 'Could not parse spreadsheet. Please upload a valid CSV or Excel file.', code: 'INVALID_FILE' });
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ success: false, error: 'Sheet is empty', code: 'EMPTY_SHEET' });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ success: false, error: 'Spreadsheet has no data rows', code: 'EMPTY_DATA' });
    }

    const { getOekForUser, generateHMAC, encryptAES } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);

    let imported = 0, skipped = 0, errors = 0;
    const ops = [];

    for (const row of rawRows) {
      const entries = Object.entries(row);
      let phoneVal = '';
      let nameVal = '';
      let emailVal = '';
      let tagsVal = '';
      const customFields = {};

      for (const [key, val] of entries) {
        const k = key.trim().toLowerCase();
        const v = typeof val === 'string' ? val.trim() : String(val !== undefined && val !== null ? val : '');

        if (/^(phone|mobile|contact|cell|number|phone\s*number|mobile\s*number)$/i.test(k) || (k.includes('phone') && !phoneVal)) {
          phoneVal = v;
        } else if (/^(name|full\s*name|contact\s*name|first\s*name)$/i.test(k) || (k.includes('name') && !nameVal)) {
          nameVal = v;
        } else if (/^(email|e-mail|mail)$/i.test(k) || (k.includes('email') && !emailVal)) {
          emailVal = v;
        } else if (/^(tags?|labels?)$/i.test(k)) {
          tagsVal = v;
        } else if (k && v !== '') {
          customFields[key.trim()] = v;
        }
      }

      if (!phoneVal) {
        errors++;
        continue;
      }

      const cleanPhone = phoneVal.replace(/\D/g, '');
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        errors++;
        continue;
      }

      const tagsArray = tagsVal ? tagsVal.split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [];

      let updatePayload = {
        userId: req.userId,
        phone: cleanPhone,
        name: nameVal,
        email: emailVal ? emailVal.toLowerCase() : '',
        tags: tagsArray,
        customFields,
        source: 'import',
      };

      let filterCondition = { userId: req.userId, phone: cleanPhone };

      if (rawOek) {
        const encryptedPhone = encryptAES(cleanPhone, rawOek);
        const phoneHash = generateHMAC(cleanPhone, rawOek);

        const encryptedCustom = {};
        for (const [ck, cv] of Object.entries(customFields)) {
          encryptedCustom[ck] = typeof cv === 'string' ? encryptAES(cv, rawOek) : cv;
        }

        updatePayload = {
          userId: req.userId,
          phone: encryptedPhone,
          phoneHash,
          name: nameVal ? encryptAES(nameVal, rawOek) : '',
          nameHash: nameVal ? generateHMAC(nameVal, rawOek) : '',
          email: emailVal ? encryptAES(emailVal.toLowerCase(), rawOek) : '',
          emailHash: emailVal ? generateHMAC(emailVal.toLowerCase(), rawOek) : '',
          tags: tagsArray,
          customFields: encryptedCustom,
          source: 'import',
          isEncrypted: true
        };

        filterCondition = { userId: req.userId, $or: [{ phone: cleanPhone }, { phoneHash }] };
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

    res.json({
      success: true,
      data: { imported, skipped, errors, total: rawRows.length },
      message: `Import complete: ${imported} imported, ${skipped} existing skipped, ${errors} invalid rows.`
    });
  } catch (error) {
    console.error('Import spreadsheet error:', error);
    res.status(500).json({ success: false, error: 'Import failed', details: error.message, code: 'IMPORT_ERROR' });
  }
});

// GET /contacts/duplicates — Scan and detect duplicate contacts
router.get('/duplicates', async (req, res) => {
  try {
    const { getOekForUser, decryptContact } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);

    const contacts = await Contact.find({ userId: req.userId, isDeleted: { $ne: true } })
      .sort('-lastMessageAt -updatedAt')
      .lean();

    const decryptedContacts = contacts.map((c) => decryptContact(c, rawOek));

    const phoneGroups = new Map();
    const emailGroups = new Map();

    for (const c of decryptedContacts) {
      if (c.phone) {
        const cleanPhone = String(c.phone).replace(/\D/g, '');
        if (cleanPhone.length >= 7) {
          if (!phoneGroups.has(cleanPhone)) phoneGroups.set(cleanPhone, []);
          phoneGroups.get(cleanPhone).push(c);
        }
      }

      if (c.email && typeof c.email === 'string') {
        const cleanEmail = c.email.trim().toLowerCase();
        if (cleanEmail && cleanEmail.includes('@')) {
          if (!emailGroups.has(cleanEmail)) emailGroups.set(cleanEmail, []);
          emailGroups.get(cleanEmail).push(c);
        }
      }
    }

    const duplicates = [];

    // Collect phone duplicates
    for (const [phone, list] of phoneGroups.entries()) {
      if (list.length > 1) {
        duplicates.push({
          type: 'phone',
          matchKey: phone,
          count: list.length,
          contacts: list,
          suggestedPrimaryId: list[0]._id
        });
      }
    }

    // Collect email duplicates
    for (const [email, list] of emailGroups.entries()) {
      if (list.length > 1) {
        const isAlreadyGrouped = duplicates.some((d) =>
          d.contacts.length === list.length && list.every((c) => d.contacts.some((dc) => dc._id.toString() === c._id.toString()))
        );
        if (!isAlreadyGrouped) {
          duplicates.push({
            type: 'email',
            matchKey: email,
            count: list.length,
            contacts: list,
            suggestedPrimaryId: list[0]._id
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        totalGroups: duplicates.length,
        totalDuplicates: duplicates.reduce((acc, curr) => acc + curr.contacts.length, 0),
        groups: duplicates
      }
    });
  } catch (error) {
    console.error('Duplicates check error:', error);
    res.status(500).json({ success: false, error: 'Failed to find duplicate contacts', code: 'DUPLICATE_SCAN_ERROR' });
  }
});

// POST /contacts/merge — Merge duplicate contacts into a primary contact
router.post('/merge', async (req, res) => {
  try {
    const { primaryContactId, duplicateContactIds } = req.body;
    if (!primaryContactId || !Array.isArray(duplicateContactIds) || duplicateContactIds.length === 0) {
      return res.status(400).json({ success: false, error: 'primaryContactId and duplicateContactIds array required' });
    }

    const filteredDuplicateIds = duplicateContactIds.filter((id) => id.toString() !== primaryContactId.toString());
    if (filteredDuplicateIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No duplicate contacts to merge' });
    }

    const primary = await Contact.findOne({ _id: primaryContactId, userId: req.userId, isDeleted: { $ne: true } });
    if (!primary) return res.status(404).json({ success: false, error: 'Primary contact not found' });

    const duplicates = await Contact.find({ _id: { $in: filteredDuplicateIds }, userId: req.userId, isDeleted: { $ne: true } });
    if (duplicates.length === 0) return res.status(404).json({ success: false, error: 'No matching duplicate contacts found' });

    const { getOekForUser, decryptContact } = require('../services/oekService');
    const rawOek = await getOekForUser(req.userId);

    const decryptedPrimary = decryptContact(primary, rawOek);
    const decryptedDuplicates = duplicates.map((d) => decryptContact(d, rawOek));

    // 1. Merge tags
    const allTags = new Set(primary.tags || []);
    decryptedDuplicates.forEach((d) => {
      (d.tags || []).forEach((t) => allTags.add(t));
    });
    primary.tags = Array.from(allTags);

    // 2. Fill missing name / email / notes
    if (!decryptedPrimary.name) {
      const foundName = decryptedDuplicates.find((d) => d.name)?.name;
      if (foundName) primary.name = foundName;
    }
    if (!decryptedPrimary.email) {
      const foundEmail = decryptedDuplicates.find((d) => d.email)?.email;
      if (foundEmail) primary.email = foundEmail;
    }
    if (!decryptedPrimary.notes) {
      const foundNotes = decryptedDuplicates.find((d) => d.notes)?.notes;
      if (foundNotes) primary.notes = foundNotes;
    }

    // 3. Merge customFields
    let mergedCustomFields = {};
    if (decryptedPrimary.customFields) {
      mergedCustomFields = decryptedPrimary.customFields instanceof Map ? Object.fromEntries(decryptedPrimary.customFields) : { ...decryptedPrimary.customFields };
    }
    decryptedDuplicates.forEach((d) => {
      if (d.customFields) {
        const dFields = d.customFields instanceof Map ? Object.fromEntries(d.customFields) : d.customFields;
        for (const [k, v] of Object.entries(dFields)) {
          if (!mergedCustomFields[k] && v !== undefined && v !== '') {
            mergedCustomFields[k] = v;
          }
        }
      }
    });
    primary.customFields = mergedCustomFields;

    // 4. Update engagement score, total messages, last message
    let maxScore = primary.engagementScore || 0;
    let totalMsgs = primary.totalMessages || 0;
    let lastMsg = primary.lastMessageAt ? new Date(primary.lastMessageAt) : null;

    decryptedDuplicates.forEach((d) => {
      if ((d.engagementScore || 0) > maxScore) maxScore = d.engagementScore;
      totalMsgs += (d.totalMessages || 0);
      if (d.lastMessageAt) {
        const dDate = new Date(d.lastMessageAt);
        if (!lastMsg || dDate > lastMsg) lastMsg = dDate;
      }
    });

    primary.engagementScore = maxScore;
    primary.totalMessages = totalMsgs;
    if (lastMsg) primary.lastMessageAt = lastMsg;

    await primary.save();

    // 5. Re-link foreign records
    const Conversation = require('../models/Conversation');
    const Message = require('../models/Message');
    const ContactNote = require('../models/ContactNote');
    const ContactGroup = require('../models/ContactGroup');
    const Task = require('../models/Task');

    await Conversation.updateMany({ contactId: { $in: filteredDuplicateIds }, userId: req.userId }, { contactId: primary._id });
    await Message.updateMany({ contactId: { $in: filteredDuplicateIds }, userId: req.userId }, { contactId: primary._id });
    await ContactNote.updateMany({ contactId: { $in: filteredDuplicateIds } }, { contactId: primary._id });
    await Task.updateMany({ contactId: { $in: filteredDuplicateIds } }, { contactId: primary._id });

    // Group memberships
    for (const dupId of filteredDuplicateIds) {
      const dupGroups = await ContactGroup.find({ contactId: dupId });
      for (const dg of dupGroups) {
        const existsOnPrimary = await ContactGroup.findOne({ contactId: primary._id, groupId: dg.groupId });
        if (!existsOnPrimary) {
          await ContactGroup.create({
            organizationId: dg.organizationId,
            contactId: primary._id,
            groupId: dg.groupId
          });
        }
        await ContactGroup.deleteOne({ _id: dg._id });
      }
    }

    // 6. Delete duplicate contacts
    await Contact.deleteMany({ _id: { $in: filteredDuplicateIds }, userId: req.userId });

    // 7. Audit Log
    await AuditLog.log({
      userId: req.userId,
      action: 'MERGE_CONTACTS',
      resource: 'Contact',
      resourceId: primary._id,
      details: {
        mergedDuplicatesCount: filteredDuplicateIds.length,
        duplicateIds: filteredDuplicateIds
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    const decryptedResult = decryptContact(primary, rawOek);
    res.json({
      success: true,
      message: `Successfully merged ${filteredDuplicateIds.length} duplicate contacts into primary contact`,
      data: { contact: decryptedResult }
    });
  } catch (error) {
    console.error('Merge contacts error:', error);
    res.status(500).json({ success: false, error: 'Failed to merge contacts', details: error.message });
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

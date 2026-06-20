const mongoose = require('mongoose');

const contactNoteSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: true,
    },
    note: {
      type: String,
      required: true,
      trim: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isEncrypted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, strict: true }
);

// Transparent encryption of notes at rest using the organization's OEK if enabled
contactNoteSchema.pre('save', async function (next) {
  if (this.isModified('note') && this.note) {
    try {
      const { getOekForOrg, encryptAES } = require('../services/oekService');
      const rawOek = await getOekForOrg(this.organizationId);
      if (rawOek) {
        this.note = encryptAES(this.note, rawOek);
        this.isEncrypted = true;
      }
    } catch (err) {
      console.error('ContactNote encryption pre-save failed:', err.message);
    }
  }
  next();
});

// Decryption helper
async function decryptDocs(docs) {
  if (!docs) return;
  const arr = Array.isArray(docs) ? docs : [docs];
  try {
    const { getOekForOrg, decryptAES } = require('../services/oekService');
    for (let i = 0; i < arr.length; i++) {
      const doc = arr[i];
      if (doc.isEncrypted && doc.note) {
        const rawOek = await getOekForOrg(doc.organizationId);
        if (rawOek) {
          doc.note = decryptAES(doc.note, rawOek);
        }
      }
    }
  } catch (err) {
    console.error('ContactNote decryption failed:', err.message);
  }
}

contactNoteSchema.post('find', async function (docs) {
  await decryptDocs(docs);
});

contactNoteSchema.post('findOne', async function (doc) {
  await decryptDocs(doc);
});

contactNoteSchema.post('save', async function (doc) {
  await decryptDocs(doc);
});

// Indexes for query performance
contactNoteSchema.index({ organizationId: 1 });
contactNoteSchema.index({ contactId: 1 });
contactNoteSchema.index({ isPinned: -1, createdAt: -1 });

module.exports = mongoose.model('ContactNote', contactNoteSchema);

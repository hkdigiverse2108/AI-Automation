const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    phone: { type: String, required: true, trim: true },
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    profilePic: { type: String, default: '' },
    source: {
      type: String,
      enum: ['instagram', 'facebook', 'website', 'manual', 'import', 'api', 'direct'],
      default: 'manual',
    },
    tags: [{ type: String, trim: true }],
    customFields: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    optedOut: { type: Boolean, default: false },
    optedOutAt: { type: Date },
    lastMessageAt: { type: Date },
    totalMessages: { type: Number, default: 0 },
    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
    phoneHash: { type: String, default: '' },
    emailHash: { type: String, default: '' },
    nameHash: { type: String, default: '' },
    isEncrypted: { type: Boolean, default: false },
  },
  { timestamps: true, strict: true }
);

contactSchema.pre('save', async function (next) {
  if (this.isModified('phone') && this.phone) {
    if (!this.phone.includes(':')) {
      this.phone = this.phone.replace(/\D/g, '');
    }
  }

  try {
    const { getOekForUser, encryptContact } = require('../services/oekService');
    const rawOek = await getOekForUser(this.userId);
    if (rawOek) {
      const encrypted = encryptContact({
        phone: this.phone,
        name: this.name,
        email: this.email,
        notes: this.notes,
        customFields: this.customFields,
      }, rawOek);

      this.phone = encrypted.phone;
      this.phoneHash = encrypted.phoneHash;
      this.name = encrypted.name;
      this.nameHash = encrypted.nameHash;
      this.email = encrypted.email;
      this.emailHash = encrypted.emailHash;
      this.notes = encrypted.notes;
      this.customFields = encrypted.customFields;
      this.isEncrypted = true;
    }
  } catch (err) {
    console.error('Contact encryption pre-save failed:', err.message);
  }
  next();
});

contactSchema.post('find', async function (docs) {
  if (!docs || !Array.isArray(docs)) return;
  try {
    const { getOekForUser, decryptContact } = require('../services/oekService');
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      if (doc.isEncrypted) {
        const rawOek = await getOekForUser(doc.userId);
        if (rawOek) {
          const decrypted = decryptContact(doc, rawOek);
          Object.assign(doc, decrypted);
        }
      }
    }
  } catch (err) {
    console.error('Contact decryption post-find failed:', err.message);
  }
});

contactSchema.post('findOne', async function (doc) {
  if (!doc) return;
  try {
    const { getOekForUser, decryptContact } = require('../services/oekService');
    if (doc.isEncrypted) {
      const rawOek = await getOekForUser(doc.userId);
      if (rawOek) {
        const decrypted = decryptContact(doc, rawOek);
        if (doc.toObject) {
          doc.phone = decrypted.phone;
          doc.name = decrypted.name;
          doc.email = decrypted.email;
          doc.notes = decrypted.notes;
          doc.customFields = decrypted.customFields;
        } else {
          Object.assign(doc, decrypted);
        }
      }
    }
  } catch (err) {
    console.error('Contact decryption post-findOne failed:', err.message);
  }
});

contactSchema.index({ userId: 1, phone: 1 }, { unique: true });
contactSchema.index({ userId: 1, phoneHash: 1 });
contactSchema.index({ userId: 1, emailHash: 1 });
contactSchema.index({ userId: 1, nameHash: 1 });
contactSchema.index({ userId: 1, tags: 1 });
contactSchema.index({ userId: 1, source: 1 });
contactSchema.index({ userId: 1, lastMessageAt: -1 });
contactSchema.index({ userId: 1, isDeleted: 1 });
contactSchema.index({ userId: 1, name: 1 });
contactSchema.index({ userId: 1, email: 1 });

module.exports = mongoose.model('Contact', contactSchema);

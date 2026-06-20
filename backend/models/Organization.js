const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: '' },
    businessType: { type: String, default: '' },
    industry: { type: String, default: '' },
    website: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    country: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    contactPerson: { type: String, default: '' },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    contactNumber: { type: String, default: '' },
    plan: { type: String, enum: ['free', 'starter', 'pro', 'enterprise'], default: 'free' },
    maxTelecallers: { type: Number, default: 5 },
    maxLeads: { type: Number, default: 1000 },
    maxMonthlyConversations: { type: Number, default: 1000 },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    metaConfig: {
      whatsapp: {
        appId: { type: String, default: '' },
        appSecret: { type: String, default: '' },
        accessToken: { type: String, default: '' },
        phoneNumberId: { type: String, default: '' },
        wabaId: { type: String, default: '' },
        verifyToken: { type: String, default: '' },
        businessManagerId: { type: String, default: '' },
        status: { type: String, enum: ['connected', 'disconnected', 'error'], default: 'disconnected' },
        statusDetails: {
          businessName: { type: String, default: '' },
          displayName: { type: String, default: '' },
          phoneNumber: { type: String, default: '' },
          tokenStatus: { type: String, default: '' },
          errorReason: { type: String, default: '' },
          lastVerified: { type: Date },
        }
      },
      facebook: {
        pageId: { type: String, default: '' },
        pageAccessToken: { type: String, default: '' },
        appId: { type: String, default: '' },
        appSecret: { type: String, default: '' },
        status: { type: String, enum: ['connected', 'disconnected', 'error'], default: 'disconnected' },
        statusDetails: {
          pageName: { type: String, default: '' },
          errorReason: { type: String, default: '' },
          lastVerified: { type: Date },
        }
      },
      instagram: {
        accountId: { type: String, default: '' },
        accessToken: { type: String, default: '' },
        businessAccountId: { type: String, default: '' },
        status: { type: String, enum: ['connected', 'disconnected', 'error'], default: 'disconnected' },
        statusDetails: {
          accountName: { type: String, default: '' },
          errorReason: { type: String, default: '' },
          lastVerified: { type: Date },
        }
      }
    },
    aiConfig: {
      openaiApiKey: { type: String, default: '' },
      grokApiKey: { type: String, default: '' }
    },
    encryptionConfig: {
      enabled: { type: Boolean, default: false },
      oekEncrypted: { type: String, default: '' },
      keyRotationHistory: [{
        rotatedAt: { type: Date, default: Date.now },
        oldOekEncrypted: { type: String }
      }],
      lastRotatedAt: { type: Date }
    },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'expiring_soon', 'expired', 'pending', 'trial'],
      default: 'trial'
    },
    subscriptionExpiryDate: { type: Date },
    currentSubscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
    chatConfig: {
      roleColors: {
        type: Object,
        default: {
          'admin': '#22c55e',
          'owner': '#22c55e',
          'superadmin': '#10b981',
          'manager': '#3b82f6',
          'sales': '#f97316',
          'support': '#a855f7',
          'developer': '#ef4444',
          'agent': '#64748b'
        }
      }
    }
  },
  { timestamps: true }
);

organizationSchema.index({ contactEmail: 1 }, { unique: true });

module.exports = mongoose.model('Organization', organizationSchema);

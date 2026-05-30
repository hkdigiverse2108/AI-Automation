const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now },
    role: { type: String },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' }
  },
  { strict: true }
);

auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, action: 1 });
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

auditLogSchema.statics.log = async function (data) {
  try {
    await this.create(data);
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);

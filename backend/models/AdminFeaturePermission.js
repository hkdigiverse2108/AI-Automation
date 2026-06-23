const mongoose = require('mongoose');

const adminFeaturePermissionSchema = new mongoose.Schema(
  {
    admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    feature_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Feature', required: true },
    can_view: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true }
);

adminFeaturePermissionSchema.index({ admin_id: 1, feature_id: 1 }, { unique: true });

module.exports = mongoose.model('AdminFeaturePermission', adminFeaturePermissionSchema);

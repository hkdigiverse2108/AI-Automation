const mongoose = require('mongoose');

const agentFeaturePermissionSchema = new mongoose.Schema(
  {
    agent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    feature_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Feature', required: true },
    can_view: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true }
);

agentFeaturePermissionSchema.index({ agent_id: 1, feature_id: 1 }, { unique: true });
agentFeaturePermissionSchema.index({ organizationId: 1 });

module.exports = mongoose.model('AgentFeaturePermission', agentFeaturePermissionSchema);

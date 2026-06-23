const Feature = require('../models/Feature');
const AdminFeaturePermission = require('../models/AdminFeaturePermission');

function checkFeatureAccess(featureSlug) {
  return async (req, res, next) => {
    try {
      // Super admins bypass all permission checks
      if (req.user && req.user.role === 'superadmin') {
        return next();
      }

      // Find the feature
      const feature = await Feature.findOne({ slug: featureSlug, is_active: true });
      if (!feature) {
        // Fail-safe: if feature is not in DB or inactive, let the request proceed
        return next();
      }

      // Find permission entry for the tenant admin (req.userId is resolved to ownerId for agents)
      const tenantId = req.userId;
      if (!tenantId) {
        return res.status(401).json({ success: false, error: 'User context missing', code: 'UNAUTHORIZED' });
      }

      const permission = await AdminFeaturePermission.findOne({
        admin_id: tenantId,
        feature_id: feature._id
      });

      if (permission && permission.can_view === false) {
        return res.status(403).json({
          success: false,
          message: 'Permission denied',
          error: `Feature "${feature.name}" is disabled for this account.`
        });
      }

      next();
    } catch (error) {
      console.error(`[checkFeatureAccess] Error verifying access for "${featureSlug}":`, error.message);
      res.status(500).json({ success: false, error: 'Authorization check failed' });
    }
  };
}

module.exports = checkFeatureAccess;

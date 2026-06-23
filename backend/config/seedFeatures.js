const Feature = require('../models/Feature');

const defaultFeatures = [
  // MAIN
  { name: 'Dashboard', slug: 'dashboard', section: 'MAIN', icon: 'LayoutDashboard', route: '/dashboard', sort_order: 1 },
  { name: 'Inbox', slug: 'inbox', section: 'MAIN', icon: 'MessageSquare', route: '/dashboard/inbox', sort_order: 2 },
  { name: 'Contacts', slug: 'contacts', section: 'MAIN', icon: 'Users', route: '/dashboard/contacts', sort_order: 3 },
  { name: 'Catalog', slug: 'catalog', section: 'MAIN', icon: 'ShoppingBag', route: '/dashboard/catalog', sort_order: 4 },
  { name: 'Groups', slug: 'groups', section: 'MAIN', icon: 'FolderOpen', route: '/dashboard/contacts/groups', sort_order: 5 },
  { name: 'Follow-Ups', slug: 'follow-ups', section: 'MAIN', icon: 'Calendar', route: '/dashboard/follow-ups', sort_order: 6 },
  { name: 'Tasks', slug: 'tasks', section: 'MAIN', icon: 'ClipboardList', route: '/dashboard/tasks', sort_order: 7 },
  { name: 'Call Logs', slug: 'call-logs', section: 'MAIN', icon: 'Clock', route: '/dashboard/call-logs', sort_order: 8 },
  { name: 'Team', slug: 'team', section: 'MAIN', icon: 'Users2', route: '/dashboard/team', sort_order: 9 },
  { name: 'Team Chat', slug: 'team-chat', section: 'MAIN', icon: 'MessageCircle', route: '/dashboard/team-chat', sort_order: 10 },

  // MARKETING
  { name: 'Campaigns', slug: 'campaigns', section: 'MARKETING', icon: 'Megaphone', route: '/dashboard/campaigns', sort_order: 11 },
  { name: 'Unofficial Campaigns', slug: 'unofficial-campaigns', section: 'MARKETING', icon: 'Zap', route: '/dashboard/unofficial-campaigns', sort_order: 12 },
  { name: 'Templates', slug: 'templates', section: 'MARKETING', icon: 'FileText', route: '/dashboard/templates', sort_order: 13 },

  // AUTOMATION
  { name: 'Bot Builder', slug: 'bot-builder', section: 'AUTOMATION', icon: 'Bot', route: '/dashboard/bot-builder', sort_order: 14 },

  // INSIGHTS
  { name: 'Analytics', slug: 'analytics', section: 'INSIGHTS', icon: 'BarChart3', route: '/dashboard/analytics', sort_order: 15 },

  // SYSTEM
  { name: 'Subscription', slug: 'subscription', section: 'SYSTEM', icon: 'CreditCard', route: '/dashboard/subscription', sort_order: 16 },
  { name: 'Chat Logs', slug: 'chat-logs', section: 'SYSTEM', icon: 'Terminal', route: '/dashboard/chat-logs', sort_order: 17 },
  { name: 'Settings', slug: 'settings', section: 'SYSTEM', icon: 'Settings', route: '/dashboard/settings', sort_order: 18 }
];

async function seedFeatures(logger) {
  try {
    const count = await Feature.countDocuments();
    if (count === 0) {
      logger.info('No system features found in database. Seeding default features...');
      await Feature.insertMany(defaultFeatures);
      logger.info(`Successfully seeded ${defaultFeatures.length} system features!`);
    } else {
      logger.info('System features exist. Running sync/upsert of features...');
      for (const feat of defaultFeatures) {
        await Feature.findOneAndUpdate(
          { slug: feat.slug },
          feat,
          { upsert: true, new: true }
        );
      }
      logger.info('System features synced successfully!');
    }
  } catch (err) {
    logger.error('Failed to seed system features:', err.message);
  }
}

module.exports = { seedFeatures, defaultFeatures };

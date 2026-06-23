const router = require('express').Router();
const os = require('os');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { verifyToken, requireRole } = require('../middleware/auth');
const queueService = require('../services/queueService');

// Configure multer storage for logo uploads
const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const logoDir = path.join(__dirname, '../uploads/logos');
    if (!fs.existsSync(logoDir)) {
      fs.mkdirSync(logoDir, { recursive: true });
    }
    cb(null, logoDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const cloudinaryService = require('../services/cloudinaryService');

const logoUpload = multer({
  storage: cloudinaryService.isConfigured() ? multer.memoryStorage() : logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, png, gif, webp, svg) are allowed'));
    }
  }
});

// All admin routes require superadmin role
router.use(verifyToken);
router.use(requireRole('superadmin'));

/**
 * POST /api/admin/upload-logo
 * Upload an organization logo image file.
 */
router.post('/upload-logo', logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No logo file uploaded' });
    }

    let logoUrl = '';
    if (cloudinaryService.isConfigured()) {
      logoUrl = await cloudinaryService.uploadStream(req.file.buffer, 'logos', 'auto', req.file.originalname);
    } else {
      logoUrl = `/uploads/logos/${req.file.filename}`;
    }

    res.json({
      success: true,
      data: {
        url: logoUrl,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Logo upload failed', details: error.message });
  }
});

/**
 * GET /api/admin/health
 * Get platform-wide systems status and process resource usage.
 */
router.get('/health', async (req, res) => {
  try {
    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = {
      total: totalMem,
      free: freeMem,
      used: usedMem,
      percentage: Math.round((usedMem / totalMem) * 100),
    };

    // CPU load (1, 5, 15 min load averages)
    const load = os.loadavg();
    const cpuUsage = {
      load1m: load[0]?.toFixed(2) || '0.00',
      load5m: load[1]?.toFixed(2) || '0.00',
      load15m: load[2]?.toFixed(2) || '0.00',
      cores: os.cpus().length,
    };

    // MongoDB connection status
    const dbState = mongoose.connection.readyState;
    const dbStatusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };
    const dbStatus = dbStatusMap[dbState] || 'unknown';

    // Redis connection status
    const redisStatus = await queueService.getRedisStatus();

    // Queues overview
    const queueStatus = await queueService.getQueueStatus();

    res.json({
      success: true,
      data: {
        uptime: {
          system: os.uptime(),
          process: process.uptime(),
        },
        memory: memoryUsage,
        cpu: cpuUsage,
        database: {
          status: dbStatus,
        },
        redis: redisStatus,
        queues: queueStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to retrieve system health', details: error.message });
  }
});

/**
 * GET /api/admin/queues
 * Fetch details of Bull queue sizes.
 */
router.get('/queues', async (req, res) => {
  try {
    const queueStatus = await queueService.getQueueStatus();
    res.json({ success: true, data: queueStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch queue statistics', details: error.message });
  }
});

/**
 * POST /api/admin/queues/control
 * Pause, resume, or clean a queue.
 */
router.post('/queues/control', async (req, res) => {
  try {
    const { queueName, action, type } = req.body; // action: pause, resume, clean
    if (!['campaign-messages', 'scheduled-campaigns'].includes(queueName)) {
      return res.status(400).json({ success: false, error: 'Invalid queue name' });
    }

    if (action === 'clean') {
      if (!['completed', 'failed', 'waiting', 'delayed', 'active'].includes(type)) {
        return res.status(400).json({ success: false, error: 'Invalid clean job type' });
      }
      await queueService.cleanQueue(queueName, type);
      await AuditLog.log({
        userId: req.userId,
        action: `CLEAN_QUEUE_${queueName.toUpperCase()}`,
        resource: 'Queue',
        resourceId: type,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return res.json({ success: true, message: `Queue ${queueName} successfully cleaned for ${type} jobs.` });
    }

    if (action === 'pause') {
      await queueService.pauseQueue(queueName);
      await AuditLog.log({
        userId: req.userId,
        action: `PAUSE_QUEUE_${queueName.toUpperCase()}`,
        resource: 'Queue',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return res.json({ success: true, message: `Queue ${queueName} has been paused.` });
    }

    if (action === 'resume') {
      await queueService.resumeQueue(queueName);
      await AuditLog.log({
        userId: req.userId,
        action: `RESUME_QUEUE_${queueName.toUpperCase()}`,
        resource: 'Queue',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      return res.json({ success: true, message: `Queue ${queueName} has been resumed.` });
    }

    res.status(400).json({ success: false, error: 'Invalid action parameter' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Queue action execution failed', details: error.message });
  }
});

/**
 * GET /api/admin/users
 * Lists all users registered on the platform.
 */
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ isDeleted: { $ne: true } })
      .select('name email role plan isSuspended isEmailVerified organizationId createdAt')
      .sort('-createdAt')
      .lean();

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch users', details: error.message });
  }
});

/**
 * POST /api/admin/users/:id/suspend
 * Toggles suspension status for a user.
 */
router.post('/users/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    const { suspend } = req.body; // boolean: true to suspend, false to unsuspend

    if (typeof suspend !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Suspend parameter must be a boolean' });
    }

    if (id === req.userId.toString()) {
      return res.status(400).json({ success: false, error: 'You cannot suspend your own account' });
    }

    const user = await User.findById(id);
    if (!user || user.isDeleted) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    user.isSuspended = suspend;
    await user.save();

    await AuditLog.log({
      userId: req.userId,
      action: suspend ? 'SUSPEND_USER' : 'UNSUSPEND_USER',
      resource: 'User',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: { isSuspended: user.isSuspended },
      message: `User ${user.email} has been ${suspend ? 'suspended' : 'unsuspended'}.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to toggle user suspension', details: error.message });
  }
});

/**
 * GET /api/admin/organizations
 * Retrieve all organizations with usage statistics.
 */
router.get('/organizations', async (req, res) => {
  try {
    const Organization = require('../models/Organization');
    const Conversation = require('../models/Conversation');

    const orgs = await Organization.find({}).sort('-createdAt').lean();

    const data = await Promise.all(
      orgs.map(async (org) => {
        // Find admin user (can be admin or owner role)
        const adminUser = await User.findOne({ 
          organizationId: org._id, 
          role: { $in: ['admin', 'owner', 'superadmin'] }, 
          isDeleted: { $ne: true } 
        }).lean();

        let activeTelecallers = 0;
        let totalLeads = 0;
        let totalConversations = 0;
        let monthlyUsage = 0;

        activeTelecallers = await User.countDocuments({
          organizationId: org._id,
          role: 'agent',
          isDeleted: { $ne: true },
        });

        if (adminUser) {
          totalConversations = await Conversation.countDocuments({ userId: adminUser._id });

          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          monthlyUsage = await Conversation.countDocuments({
            userId: adminUser._id,
            createdAt: { $gte: startOfMonth },
          });
        }

        return {
          ...org,
          adminName: adminUser ? adminUser.name : 'N/A',
          adminEmail: adminUser ? adminUser.email : 'N/A',
          adminPhone: adminUser ? (adminUser.mobileNumber || '') : '',
          activeTelecallers,
          totalLeads,
          totalConversations,
          monthlyUsage,
        };
      })
    );

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch organizations', details: error.message });
  }
});

/**
 * POST /api/admin/organizations
 * Create a new organization and its primary Org Admin user.
 */
router.post('/organizations', async (req, res) => {
  try {
    const {
      name,
      logo,
      businessType,
      industry,
      website,
      address,
      city,
      state,
      country,
      gstNumber,
      contactPerson,
      contactEmail,
      contactNumber,
      plan,
      maxTelecallers,
      maxLeads,
      maxMonthlyConversations,
      adminName,
      adminEmail,
      adminUsername,
      adminPassword,
    } = req.body;

    if (!name || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ success: false, error: 'Missing required organization or admin fields' });
    }

    // Default contactEmail to adminEmail if not provided
    const orgContactEmail = contactEmail || adminEmail;

    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Admin email is already registered' });
    }

    const Organization = require('../models/Organization');
    const org = await Organization.create({
      name,
      logo,
      businessType,
      industry,
      website,
      address,
      city,
      state,
      country,
      gstNumber,
      contactPerson: contactPerson || adminName,
      contactEmail: orgContactEmail,
      contactNumber,
      plan: plan || 'free',
      maxTelecallers: maxTelecallers || 5,
      maxLeads: maxLeads || 1000,
      maxMonthlyConversations: maxMonthlyConversations || 1000,
      status: 'active',
    });

    const passwordHash = await User.hashPassword(adminPassword);
    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      mobileNumber: contactNumber,
      username: adminUsername || adminEmail,
      passwordHash,
      passwordHistory: [passwordHash],
      role: 'admin',
      organizationId: org._id,
      isEmailVerified: true,
      status: 'active',
    });

    // Send onboarding credentials email to newly created Org Admin
    const emailService = require('../services/emailService');
    emailService.sendOnboardingEmail(adminEmail, adminName, 'admin', adminPassword, name).catch((err) => {
      console.error('Failed to send organization admin onboarding email:', err.message);
    });

    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'ORGANIZATION_CREATED',
      resource: 'Organization',
      resourceId: org._id.toString(),
      newValue: { name, adminEmail },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, data: { organization: org, admin: admin.toSafeObject() }, message: 'Organization created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create organization', details: error.message });
  }
});

/**
 * PUT /api/admin/organizations/:id
 * Update organization subscription limits and status.
 */
router.put('/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      website,
      logo,
      businessType,
      industry,
      gstNumber,
      contactPerson,
      contactEmail,
      contactNumber,
      plan,
      maxTelecallers,
      maxLeads,
      maxMonthlyConversations,
      status,
    } = req.body;

    const Organization = require('../models/Organization');
    const org = await Organization.findById(id);
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    if (name) org.name = name;
    if (website !== undefined) org.website = website;
    if (logo !== undefined) org.logo = logo;
    if (businessType !== undefined) org.businessType = businessType;
    if (industry !== undefined) org.industry = industry;
    if (gstNumber !== undefined) org.gstNumber = gstNumber;
    if (contactPerson !== undefined) org.contactPerson = contactPerson;
    if (contactEmail) org.contactEmail = contactEmail;
    if (contactNumber !== undefined) org.contactNumber = contactNumber;
    if (plan) org.plan = plan;
    if (maxTelecallers !== undefined) org.maxTelecallers = maxTelecallers;
    if (maxLeads !== undefined) org.maxLeads = maxLeads;
    if (maxMonthlyConversations !== undefined) org.maxMonthlyConversations = maxMonthlyConversations;

    const oldStatus = org.status;
    if (status) org.status = status;

    await org.save();

    // If organization is suspended or inactive, suspend all its users
    if (status && status !== oldStatus && (status === 'suspended' || status === 'inactive')) {
      await User.updateMany({ organizationId: org._id }, { isSuspended: true });
    } else if (status && status !== oldStatus && status === 'active') {
      await User.updateMany({ organizationId: org._id }, { isSuspended: false });
    }

    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'ORGANIZATION_UPDATED',
      resource: 'Organization',
      resourceId: org._id.toString(),
      newValue: req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, data: org, message: 'Organization updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update organization', details: error.message });
  }
});

/**
 * DELETE /api/admin/organizations/:id
 * Delete an organization and permanently delete all related users and scoped organization data.
 */
router.delete('/organizations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const Organization = require('../models/Organization');
    const User = require('../models/User');

    const org = await Organization.findById(id);
    if (!org) {
      return res.status(404).json({ success: false, error: 'Organization not found' });
    }

    // 1. Find all users associated with this organization
    const orgUsers = await User.find({ organizationId: org._id }).select('_id').lean();
    const orgUserIds = orgUsers.map((u) => u._id);

    // 2. Cascade delete all scoped data associated with these users
    if (orgUserIds.length > 0) {
      const Contact = require('../models/Contact');
      const Conversation = require('../models/Conversation');
      const Message = require('../models/Message');
      const Campaign = require('../models/Campaign');
      const BotFlow = require('../models/BotFlow');
      const AssignmentRule = require('../models/AssignmentRule');
      const AutoTagRule = require('../models/AutoTagRule');
      const AuditLog = require('../models/AuditLog');
      const ApiLog = require('../models/ApiLog');
      const RefreshToken = require('../models/RefreshToken');
      const ReplyTrigger = require('../models/ReplyTrigger');
      const Sequence = require('../models/Sequence');
      const SequenceExecution = require('../models/SequenceExecution');
      const Template = require('../models/Template');
      const WhatsAppAccount = require('../models/WhatsAppAccount');
      const Tag = require('../models/Tag');

      await Promise.all([
        Contact.deleteMany({ userId: { $in: orgUserIds } }),
        Conversation.deleteMany({
          $or: [
            { userId: { $in: orgUserIds } },
            { organization_id: org._id }
          ]
        }),
        Message.deleteMany({ userId: { $in: orgUserIds } }),
        Campaign.deleteMany({ userId: { $in: orgUserIds } }),
        BotFlow.deleteMany({ userId: { $in: orgUserIds } }),
        AssignmentRule.deleteMany({ userId: { $in: orgUserIds } }),
        AutoTagRule.deleteMany({ userId: { $in: orgUserIds } }),
        AuditLog.deleteMany({
          $or: [
            { userId: { $in: orgUserIds } },
            { organizationId: org._id }
          ]
        }),
        ApiLog.deleteMany({ userId: { $in: orgUserIds } }),
        RefreshToken.deleteMany({ userId: { $in: orgUserIds } }),
        ReplyTrigger.deleteMany({ userId: { $in: orgUserIds } }),
        Sequence.deleteMany({ userId: { $in: orgUserIds } }),
        SequenceExecution.deleteMany({ userId: { $in: orgUserIds } }),
        Template.deleteMany({ userId: { $in: orgUserIds } }),
        WhatsAppAccount.deleteMany({ userId: { $in: orgUserIds } }),
        Tag.deleteMany({ userId: { $in: orgUserIds } }),
        User.deleteMany({ organizationId: org._id }) // Permanently delete users
      ]);
    }

    // 3. Permanently delete the Organization document
    await Organization.findByIdAndDelete(org._id);

    // 4. Log audit trace for superadmin delete action
    const AuditLog = require('../models/AuditLog');
    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'ORGANIZATION_PERMANENT_DELETED',
      resource: 'Organization',
      resourceId: id,
      newValue: { orgName: org.name },
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Organization and all associated data permanently deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete organization', details: error.message });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Reset an Org Admin's password.
 */
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, error: 'New password must be at least 8 characters long' });
    }

    const user = await User.findById(id);
    if (!user || user.isDeleted) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const passwordHash = await User.hashPassword(newPassword);
    user.passwordHash = passwordHash;
    user.passwordHistory.push(passwordHash);
    await user.save();

    await AuditLog.log({
      userId: req.userId,
      actorId: req.user._id,
      actorName: req.user.name,
      action: 'RESET_ADMIN_PASSWORD',
      resource: 'User',
      resourceId: id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to reset password', details: error.message });
  }
});

module.exports = router;

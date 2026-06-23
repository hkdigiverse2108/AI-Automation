const router = require('express').Router();
const User = require('../models/User');
const AssignmentRule = require('../models/AssignmentRule');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');

router.use(verifyToken);
const checkFeatureAccess = require('../middleware/checkFeatureAccess');
router.use(checkFeatureAccess('team'));

// GET /api/team/monitoring-stats — get admin monitoring details (accessible by all verified team members, including agents)
router.get('/monitoring-stats', async (req, res) => {
  try {
    const ownerId = req.userId; // resolved tenant owner ID
    const Conversation = require('../models/Conversation');
    const AuditLog = require('../models/AuditLog');
    const mongoose = require('mongoose');

    // 1. Total Unassigned Chats
    const totalUnassigned = await Conversation.countDocuments({
      userId: ownerId,
      status: { $ne: 'resolved' },
      $or: [
        { assignedAgent: { $exists: false } },
        { assignedAgent: null },
        { assigned_agent_id: { $exists: false } },
        { assigned_agent_id: null }
      ]
    });

    // 2. Active Telecallers count
    const activeTelecallers = await User.countDocuments({
      ownerId,
      role: 'agent',
      isDeleted: { $ne: true }
    });

    // 3. Assigned Conversations count (active/non-resolved)
    const totalAssignedActive = await Conversation.countDocuments({
      userId: ownerId,
      status: { $ne: 'resolved' },
      $or: [
        { assignedAgent: { $ne: null } },
        { assigned_agent_id: { $ne: null } }
      ]
    });

    // 4. Agent Performance (conversations count by agent)
    // List all agents first
    const agentsList = await User.find({ ownerId, role: 'agent', isDeleted: { $ne: true } }).select('name email isSuspended').lean();
    
    // Aggregate active counts
    const activeCounts = await Conversation.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(ownerId),
          status: { $ne: 'resolved' },
          assigned_agent_id: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$assigned_agent_id',
          count: { $sum: 1 }
        }
      }
    ]);

    // Aggregate resolved counts
    const resolvedCounts = await Conversation.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(ownerId),
          status: 'resolved',
          assigned_agent_id: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$assigned_agent_id',
          count: { $sum: 1 }
        }
      }
    ]);

    const activeMap = {};
    activeCounts.forEach(c => { activeMap[c._id.toString()] = c.count; });

    const resolvedMap = {};
    resolvedCounts.forEach(c => { resolvedMap[c._id.toString()] = c.count; });

    const performance = agentsList.map(agent => ({
      _id: agent._id,
      name: agent.name,
      email: agent.email,
      isSuspended: agent.isSuspended,
      activeChats: activeMap[agent._id.toString()] || 0,
      resolvedChats: resolvedMap[agent._id.toString()] || 0
    }));

    // 5. Takeover History / Audit Logs (Recent actions related to takeover/assignments/messages)
    const logs = await AuditLog.find({
      userId: ownerId,
      action: { $in: ['ASSIGN_CONVERSATION', 'REASSIGN_CONVERSATION', 'RELEASE_CONVERSATION', 'RESOLVE_CONVERSATION', 'AI_RESUME', 'AGENT_MESSAGE_SENT'] }
    })
      .sort({ timestamp: -1 })
      .limit(30)
      .lean();

    res.json({
      success: true,
      data: {
        totalUnassigned,
        activeTelecallers,
        totalAssignedActive,
        performance,
        takeoverHistory: logs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch monitoring statistics', details: error.message });
  }
});

// GET /api/team — get agents and auto assignment rules (accessible to all authenticated team members, rules restricted to admins)
router.get('/', async (req, res) => {
  try {
    const ownerId = req.userId;
    const query = { role: 'agent', isDeleted: { $ne: true } };
    if (req.user.role !== 'superadmin') {
      query.organizationId = req.user.organizationId;
    }
    const agents = await User.find(query).select('-passwordHash -passwordHistory').lean();

    // Auto assignment rules should only be visible to admin / owner / superadmin
    let rules = [];
    const isAdmin = ['superadmin', 'owner', 'admin'].includes(req.user.role);
    if (isAdmin) {
      rules = await AssignmentRule.find({ userId: ownerId }).sort('-createdAt').populate('agentId', 'name email').lean();
    }

    res.json({ success: true, data: { agents, rules } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch team details' });
  }
});

router.use(requireRole('superadmin', 'owner', 'admin'));

// POST /api/team/agents — add a new agent
router.post('/agents', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      employeeId,
      mobileNumber,
      username,
      department,
      designation,
      shiftTiming,
      status
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Missing name, email, or password' });
    }

    const Organization = require('../models/Organization');
    const org = await Organization.findById(req.user.organizationId);
    if (org) {
      const activeAgents = await User.countDocuments({
        organizationId: org._id,
        role: 'agent',
        isDeleted: { $ne: true }
      });
      if (activeAgents >= org.maxTelecallers) {
        return res.status(400).json({ success: false, error: `Maximum telecallers limit of ${org.maxTelecallers} reached under your current subscription plan.` });
      }
    }

    const ownerId = req.userId;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const passwordHash = await User.hashPassword(password);
    const agent = await User.create({
      name,
      email,
      passwordHash,
      role: 'agent',
      ownerId,
      organizationId: req.user.organizationId,
      employeeId: employeeId || '',
      mobileNumber: mobileNumber || '',
      username: username || email,
      department: department || '',
      designation: designation || '',
      shiftTiming: shiftTiming || '',
      status: status || 'active',
      createdByAdmin: req.user._id,
      isEmailVerified: true
    });

    // Send onboarding credentials email to newly created Agent
    const emailService = require('../services/emailService');
    const orgName = org ? org.name : 'HK Automation';
    emailService.sendOnboardingEmail(email, name, 'agent', password, orgName).catch((err) => {
      console.error('Failed to send agent onboarding email:', err.message);
    });

    res.status(201).json({ success: true, data: { agent: agent.toSafeObject() }, message: 'Agent created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create agent', details: error.message });
  }
});

// PUT /api/team/agents/:id — edit agent details
router.put('/agents/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      isSuspended,
      employeeId,
      mobileNumber,
      username,
      department,
      designation,
      shiftTiming,
      status
    } = req.body;

    const query = { _id: req.params.id, role: 'agent', isDeleted: { $ne: true } };
    if (req.user.role !== 'superadmin') {
      query.organizationId = req.user.organizationId;
    }
    const agent = await User.findOne(query);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    if (name) agent.name = name;
    if (email && email !== agent.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) return res.status(400).json({ success: false, error: 'Email already in use' });
      agent.email = email;
    }
    if (password) {
      agent.passwordHash = await User.hashPassword(password);
    }
    if (typeof isSuspended === 'boolean') {
      agent.isSuspended = isSuspended;
    }
    if (employeeId !== undefined) agent.employeeId = employeeId;
    if (mobileNumber !== undefined) agent.mobileNumber = mobileNumber;
    if (username !== undefined) agent.username = username;
    if (department !== undefined) agent.department = department;
    if (designation !== undefined) agent.designation = designation;
    if (shiftTiming !== undefined) agent.shiftTiming = shiftTiming;
    if (status !== undefined) agent.status = status;

    await agent.save();
    
    // Log suspension status change if applicable
    if (typeof isSuspended === 'boolean') {
      const AuditLog = require('../models/AuditLog');
      await AuditLog.log({
        userId: req.userId,
        actorId: req.user._id,
        actorName: req.user.name,
        action: isSuspended ? 'SUSPEND_AGENT' : 'UNSUSPEND_AGENT',
        resource: 'User',
        resourceId: agent._id.toString(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });
    }

    res.json({ success: true, data: { agent: agent.toSafeObject() }, message: 'Agent updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update agent' });
  }
});

// DELETE /api/team/agents/:id — permanently delete an agent
router.delete('/agents/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const query = { _id: req.params.id, role: 'agent' };
    if (req.user.role !== 'superadmin') {
      query.organizationId = req.user.organizationId;
    }
    const agent = await User.findOne(query);

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const Conversation = require('../models/Conversation');
    const RefreshToken = require('../models/RefreshToken');

    // 1. Unassign agent from any conversations
    await Conversation.updateMany(
      { $or: [{ assignedAgent: agent._id }, { assigned_agent_id: agent._id }] },
      { $unset: { assignedAgent: 1, assigned_agent_id: 1 } }
    );

    // 2. Permanently delete their assignment rules
    await AssignmentRule.deleteMany({ agentId: agent._id });

    // 3. Delete refresh tokens for this agent
    await RefreshToken.deleteMany({ userId: agent._id });

    // 4. Permanently delete agent from database
    await User.deleteOne({ _id: agent._id });

    res.json({ success: true, message: 'Agent and all associated authentication/rules permanently deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete agent' });
  }
});

// POST /api/team/rules — add assignment rule
router.post('/rules', async (req, res) => {
  try {
    const { ruleName, triggerType, triggerValue, agentId } = req.body;
    if (!ruleName || !agentId) {
      return res.status(400).json({ success: false, error: 'Rule name and Agent ID are required' });
    }

    const userId = req.userId;
    // Check if agent belongs to owner
    const agent = await User.findOne({ _id: agentId, ownerId: userId, role: 'agent', isDeleted: { $ne: true } });
    if (!agent) {
      return res.status(400).json({ success: false, error: 'Invalid agent selected' });
    }

    const rule = await AssignmentRule.create({
      userId,
      ruleName,
      triggerType: triggerType || 'all',
      triggerValue: triggerValue || '',
      agentId,
    });

    const populatedRule = await AssignmentRule.findById(rule._id).populate('agentId', 'name email').lean();

    res.status(201).json({ success: true, data: { rule: populatedRule }, message: 'Rule created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create rule', details: error.message });
  }
});

// PUT /api/team/rules/:id — edit or toggle assignment rule
router.put('/rules/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const { ruleName, triggerType, triggerValue, agentId, isActive } = req.body;
    const userId = req.userId;

    const rule = await AssignmentRule.findOne({ _id: req.params.id, userId });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    if (ruleName) rule.ruleName = ruleName;
    if (triggerType) rule.triggerType = triggerType;
    if (triggerValue !== undefined) rule.triggerValue = triggerValue;
    if (isActive !== undefined) rule.isActive = isActive;

    if (agentId) {
      const agent = await User.findOne({ _id: agentId, ownerId: userId, role: 'agent', isDeleted: { $ne: true } });
      if (!agent) return res.status(400).json({ success: false, error: 'Invalid agent selected' });
      rule.agentId = agentId;
    }

    await rule.save();
    const populated = await AssignmentRule.findById(rule._id).populate('agentId', 'name email').lean();

    res.json({ success: true, data: { rule: populated }, message: 'Rule updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update rule' });
  }
});

// DELETE /api/team/rules/:id — delete assignment rule
router.delete('/rules/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const userId = req.userId;
    const rule = await AssignmentRule.findOneAndDelete({ _id: req.params.id, userId });
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }
    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete rule' });
  }
});



module.exports = router;

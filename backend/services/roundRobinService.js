const User = require('../models/User');
const Conversation = require('../models/Conversation');

/**
 * Atomically selects the next eligible agent in the organization using Round-Robin.
 * Eligible agents: role === 'agent', active status, not suspended, not deleted.
 * Sorted by: lastAssignedAt: 1 (null/oldest first), createdAt: 1, _id: 1.
 * 
 * Atomically updates the picked agent's lastAssignedAt to current time,
 * rotating them to the back of the queue for subsequent assignments.
 * 
 * @param {Object} options
 * @param {string|ObjectId} options.organizationId
 * @param {string|ObjectId} options.ownerId
 * @param {string|ObjectId} [options.excludeAgentId]
 * @returns {Promise<User|null>}
 */
async function getNextRoundRobinAgent({ organizationId, ownerId, excludeAgentId = null }) {
  try {
    const baseQuery = {
      role: 'agent',
      isDeleted: { $ne: true },
      isSuspended: { $ne: true },
      status: { $ne: 'inactive' }
    };

    if (excludeAgentId) {
      baseQuery._id = { $ne: excludeAgentId };
    }

    // Try finding agents by organizationId first, then ownerId fallback
    let agentQuery = null;
    if (organizationId) {
      const orgAgentCount = await User.countDocuments({ ...baseQuery, organizationId });
      if (orgAgentCount > 0) {
        agentQuery = { ...baseQuery, organizationId };
      }
    }

    if (!agentQuery && ownerId) {
      const ownerAgentCount = await User.countDocuments({ ...baseQuery, ownerId });
      if (ownerAgentCount > 0) {
        agentQuery = { ...baseQuery, ownerId };
      }
    }

    if (!agentQuery) {
      // If organizationId wasn't found but exists in DB, try by tenant owner ID lookup
      if (ownerId) {
        const ownerUser = await User.findById(ownerId).select('organizationId').lean();
        if (ownerUser && ownerUser.organizationId) {
          const count = await User.countDocuments({ ...baseQuery, organizationId: ownerUser.organizationId });
          if (count > 0) {
            agentQuery = { ...baseQuery, organizationId: ownerUser.organizationId };
          }
        }
      }
    }

    if (!agentQuery) {
      return null;
    }

    // Atomic find and update: Pick agent with the oldest/null lastAssignedAt, update lastAssignedAt
    const now = new Date();
    const assignedAgent = await User.findOneAndUpdate(
      agentQuery,
      { $set: { lastAssignedAt: now } },
      {
        sort: { lastAssignedAt: 1, createdAt: 1, _id: 1 },
        new: true,
        select: '_id name email role organizationId ownerId lastAssignedAt'
      }
    );

    return assignedAgent;
  } catch (error) {
    console.error('Error in getNextRoundRobinAgent:', error.message);
    return null;
  }
}

/**
 * Assigns a conversation to the next Round-Robin agent.
 * Sets assignedAgent, assigned_agent_id, lock_status, takeover_status, and status.
 * Emits real-time socket events and in-app notifications.
 * 
 * @param {Object} options
 * @param {Conversation} options.conversation
 * @param {string|ObjectId} [options.organizationId]
 * @param {string|ObjectId} [options.ownerId]
 * @param {Object} [options.io] - Socket.io instance
 * @param {string} [options.contactName]
 * @returns {Promise<{conversation: Conversation, agent: User|null}>}
 */
async function assignConversationRoundRobin({
  conversation,
  organizationId,
  ownerId,
  io = null,
  contactName = '',
  asBot = false
}) {
  try {
    if (!conversation) {
      return { conversation: null, agent: null };
    }

    const orgId = organizationId || conversation.organization_id;
    const tenantId = ownerId || conversation.userId;

    const agent = await getNextRoundRobinAgent({ organizationId: orgId, ownerId: tenantId });
    if (!agent) {
      return { conversation, agent: null };
    }

    const now = new Date();
    conversation.assignedAgent = agent._id;
    conversation.assigned_agent_id = agent._id;
    conversation.previous_assigned_agent = agent._id;
    conversation.assigned_at = now;
    if (asBot) {
      conversation.lock_status = false;
      conversation.takeover_status = 'ai';
      conversation.status = 'bot';
    } else {
      conversation.lock_status = true;
      conversation.takeover_status = 'human';
      conversation.status = 'human';
    }
    await conversation.save();

    // Re-populate for clean socket and API responses
    await conversation.populate([
      { path: 'assignedAgent', select: 'name email' },
      { path: 'assigned_agent_id', select: 'name email' }
    ]);

    // Emit Socket.IO event for live update
    if (io) {
      const payload = {
        conversationId: conversation._id,
        assignedAgent: {
          _id: agent._id,
          name: agent.name,
          email: agent.email
        },
        assigned_agent_id: agent._id,
        lock_status: conversation.lock_status,
        takeover_status: conversation.takeover_status,
        status: conversation.status,
        assigned_at: now
      };

      // 1. Direct agent room: ensures the assigned agent's inbox immediately updates
      io.to(`user_${agent._id}`).emit('conversation_assigned', payload);

      // 2. Tenant owner room: ensures Admin/Owner dashboard updates
      if (tenantId) {
        io.to(`user_${tenantId}`).emit('conversation_assigned', payload);
      }
    }

    // Trigger in-app notification for the assigned agent
    try {
      const { createNotification } = require('./notificationService');
      createNotification({
        userId: agent._id.toString(),
        organizationId: orgId,
        type: 'team',
        title: `New Chat Assigned: ${contactName || 'WhatsApp Contact'}`,
        message: `Assigned to you via Round-Robin auto-distribution.`,
        link: '/dashboard/inbox'
      }).catch(() => {});
    } catch (_) {}

    return { conversation, agent };
  } catch (error) {
    console.error('Error in assignConversationRoundRobin:', error.message);
    return { conversation, agent: null };
  }
}

/**
 * Records an activity/manual assignment for an agent to keep Round-Robin balanced.
 * @param {string|ObjectId} agentId
 */
async function recordAgentActivity(agentId) {
  if (!agentId) return;
  try {
    await User.findByIdAndUpdate(agentId, { $set: { lastAssignedAt: new Date() } });
  } catch (error) {
    console.error('Error updating lastAssignedAt for agent:', error.message);
  }
}

/**
 * Distributes all currently unassigned conversations for a tenant using Round-Robin.
 * @param {string|ObjectId} userId - Tenant Owner ID
 * @param {string|ObjectId} organizationId - Organization ID
 * @param {Object} io - Socket.io instance
 * @returns {Promise<{ assignedCount: number }>}
 */
async function distributeUnassignedConversations(userId, organizationId, io = null) {
  try {
    const unassignedConvs = await Conversation.find({
      userId,
      status: { $nin: ['resolved', 'ai'] },
      ai_active: { $ne: true },
      $and: [
        { $or: [{ assignedAgent: { $exists: false } }, { assignedAgent: null }] },
        { $or: [{ assigned_agent_id: { $exists: false } }, { assigned_agent_id: null }] }
      ]
    }).populate('contactId', 'name phone').sort({ lastMessageAt: -1 });

    let assignedCount = 0;
    for (const conv of unassignedConvs) {
      const contactName = conv.contactId ? (conv.contactId.name || conv.contactId.phone) : 'Contact';
      const result = await assignConversationRoundRobin({
        conversation: conv,
        organizationId,
        ownerId: userId,
        io,
        contactName
      });
      if (result.agent) {
        assignedCount++;
      } else {
        // No agents available, stop loop
        break;
      }
    }

    return { assignedCount };
  } catch (error) {
    console.error('Error in distributeUnassignedConversations:', error.message);
    return { assignedCount: 0 };
  }
}

module.exports = {
  getNextRoundRobinAgent,
  assignConversationRoundRobin,
  recordAgentActivity,
  distributeUnassignedConversations
};

/**
 * Contact Scoring Service
 * 
 * Calculates engagement scores for contacts based on:
 * - Engagement (40%): message volume relative to other contacts
 * - Recency (30%): how recently the contact interacted
 * - Response Rate (30%): ratio of inbound to outbound messages
 * 
 * Segments contacts into: hot (70-100), warm (40-69), cold (1-39), new (0)
 */

const Contact = require('../models/Contact');
const Message = require('../models/Message');

/**
 * Calculate and update the engagement score for a single contact
 */
async function calculateContactScore(contactId) {
  try {
    const contact = await Contact.findById(contactId);
    if (!contact) return null;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get message stats for this contact
    const [messageStats] = await Message.aggregate([
      {
        $match: {
          contactId: contact._id,
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          inbound: { $sum: { $cond: [{ $eq: ['$direction', 'inbound'] }, 1, 0] } },
          outbound: { $sum: { $cond: [{ $eq: ['$direction', 'outbound'] }, 1, 0] } },
          lastMessageAt: { $max: '$createdAt' },
          recentMessages: {
            $sum: {
              $cond: [{ $gte: ['$createdAt', sevenDaysAgo] }, 1, 0]
            }
          }
        }
      }
    ]);

    const stats = messageStats || { totalMessages: 0, inbound: 0, outbound: 0, lastMessageAt: null, recentMessages: 0 };

    // 1. Engagement Score (0-40 points)
    // Based on total message volume in last 30 days
    let engagementScore = 0;
    if (stats.totalMessages >= 50) engagementScore = 40;
    else if (stats.totalMessages >= 20) engagementScore = 30;
    else if (stats.totalMessages >= 10) engagementScore = 22;
    else if (stats.totalMessages >= 5) engagementScore = 15;
    else if (stats.totalMessages >= 1) engagementScore = 8;

    // 2. Recency Score (0-30 points)
    // Based on how recently the contact interacted
    let recencyScore = 0;
    if (stats.lastMessageAt) {
      const daysSince = (Date.now() - new Date(stats.lastMessageAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince <= 1) recencyScore = 30;
      else if (daysSince <= 3) recencyScore = 25;
      else if (daysSince <= 7) recencyScore = 20;
      else if (daysSince <= 14) recencyScore = 12;
      else if (daysSince <= 30) recencyScore = 5;
    }

    // 3. Response Rate Score (0-30 points)
    // Based on inbound vs outbound ratio (higher inbound = more engaged)
    let responseRateScore = 0;
    if (stats.outbound > 0 && stats.inbound > 0) {
      const ratio = stats.inbound / stats.outbound;
      if (ratio >= 1) responseRateScore = 30;
      else if (ratio >= 0.7) responseRateScore = 25;
      else if (ratio >= 0.4) responseRateScore = 18;
      else if (ratio >= 0.2) responseRateScore = 10;
      else responseRateScore = 5;
    } else if (stats.inbound > 0) {
      responseRateScore = 30; // Contact initiated, very engaged
    }

    const totalScore = Math.min(100, Math.round(engagementScore + recencyScore + responseRateScore));

    // Determine segment
    let segment = 'new';
    if (totalScore >= 70) segment = 'hot';
    else if (totalScore >= 40) segment = 'warm';
    else if (totalScore >= 1) segment = 'cold';

    // Update contact
    await Contact.findByIdAndUpdate(contactId, {
      engagementScore: totalScore,
      segment,
      lastEngagementAt: stats.lastMessageAt || contact.lastEngagementAt,
      scoringBreakdown: {
        engagement: engagementScore,
        recency: recencyScore,
        responseRate: responseRateScore,
      }
    });

    return { score: totalScore, segment };
  } catch (err) {
    console.error('Error calculating contact score:', err.message);
    return null;
  }
}

/**
 * Batch recalculate scores for all contacts of a user
 */
async function recalculateAllScores(userId) {
  try {
    const contacts = await Contact.find({ userId, isDeleted: { $ne: true } }).select('_id');
    let updated = 0;

    for (const contact of contacts) {
      const result = await calculateContactScore(contact._id);
      if (result) updated++;
    }

    return { total: contacts.length, updated };
  } catch (err) {
    console.error('Error in batch score recalculation:', err.message);
    return { total: 0, updated: 0 };
  }
}

module.exports = {
  calculateContactScore,
  recalculateAllScores,
};

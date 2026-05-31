const mongoose = require('mongoose');

const conversationAiAnalysisSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    sentiment: { 
      type: String, 
      enum: ['positive', 'neutral', 'frustrated', 'angry'], 
      default: 'neutral' 
    },
    urgency: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'critical'], 
      default: 'low' 
    },
    risk: { 
      type: String, 
      enum: ['normal', 'escalation', 'churn'], 
      default: 'normal' 
    },
    confidence: { type: Number, default: 0.9 },
    aiReasoning: { type: String, default: '' },
    isComplaint: { type: Boolean, default: false },
    isRefundRequested: { type: Boolean, default: false },
    isLegalThreat: { type: Boolean, default: false },
    isVipCustomer: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Indexes for high-speed dashboard analytics
conversationAiAnalysisSchema.index({ orgId: 1, createdAt: -1 });
conversationAiAnalysisSchema.index({ conversationId: 1, createdAt: -1 });
conversationAiAnalysisSchema.index({ orgId: 1, sentiment: 1 });
conversationAiAnalysisSchema.index({ orgId: 1, urgency: 1 });

module.exports = mongoose.model('ConversationAiAnalysis', conversationAiAnalysisSchema);

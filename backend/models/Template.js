const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    metaTemplateId: { type: String },
    category: { type: String, enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'], default: 'MARKETING' },
    language: { type: String, default: 'en' },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    headerMediaId: { type: String },
    components: [
      {
        type: { type: String, enum: ['HEADER', 'BODY', 'FOOTER', 'BUTTONS'] },
        format: { type: String, enum: ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] },
        text: { type: String },
        example: { type: mongoose.Schema.Types.Mixed },
        buttons: [
          {
            type: { type: String, enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'] },
            text: { type: String },
            url: { type: String },
            phone_number: { type: String },
          },
        ],
      },
    ],
    variableCount: { type: Number, default: 0 },
    isCustom: { type: Boolean, default: false },
    isCarousel: { type: Boolean, default: false },
    carouselCards: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, strict: true }
);

templateSchema.index({ userId: 1 });
templateSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('Template', templateSchema);

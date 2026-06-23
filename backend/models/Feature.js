const mongoose = require('mongoose');

const featureSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    section: {
      type: String,
      enum: ['MAIN', 'MARKETING', 'AUTOMATION', 'INSIGHTS', 'SYSTEM'],
      required: true,
    },
    icon: { type: String, required: true, trim: true },
    route: { type: String, required: true, trim: true },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true }
);

featureSchema.index({ slug: 1 });
featureSchema.index({ sort_order: 1 });

module.exports = mongoose.model('Feature', featureSchema);

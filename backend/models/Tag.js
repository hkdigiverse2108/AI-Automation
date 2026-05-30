const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#3b82f6' }, // Hex color
  },
  { timestamps: true, strict: true }
);

tagSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Tag', tagSchema);

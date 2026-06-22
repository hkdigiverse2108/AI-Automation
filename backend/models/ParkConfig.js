const mongoose = require('mongoose');

const parkConfigSchema = new mongoose.Schema(
  {
    park_name: { type: String, required: true, trim: true },
    voice_id: { type: String, required: true, default: '21m00Tcm4TlvDq8ikWAM' },
    ticket_prices: { type: Map, of: Number, default: {} },
    timings: { type: String, default: '' },
    address: { type: String, default: '' },
    multilingual: {
      custom_texts: {
        en: { type: String, default: '' },
        hi: { type: String, default: '' },
        gu: { type: String, default: '' }
      }
    },
    audio_urls: {
      en: { type: String, default: '' },
      hi: { type: String, default: '' },
      gu: { type: String, default: '' }
    },
    organization_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true, strict: true }
);

module.exports = mongoose.model('ParkConfig', parkConfigSchema);

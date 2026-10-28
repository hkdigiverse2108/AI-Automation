require('./config/env');
const axios = require('axios');

(async () => {
  try {
    const res = await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
    });
    console.log('Available Groq Models:', res.data.data.map(m => m.id));
  } catch (err) {
    console.error('Groq error:', err.response ? err.response.data : err.message);
  }
})();

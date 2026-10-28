require('./config/env');
const axios = require('axios');

async function testGroq120b() {
  const systemPrompt = `You are an elite WhatsApp Business Bot Architect.
Generate a comprehensive, production-ready WhatsApp bot flow JSON for a real business.

CRITICAL ARCHITECTURE RULES:
1. NEVER ASK FOR NAME / PHONE NUMBER WHEN USER IS BROWSING OR ASKING ABOUT SERVICES / INFO!
   - When a user clicks an informational button (e.g., "Explore Services", "Membership Plans", "Menu", "About Us", "Pricing", "Features"), the bot MUST reply with detailed, rich informative answers, explanations, or a sub-category menu!
   - Every informational card MUST have navigation buttons:
     e.g., [ "Book / Get Quote / Order", "🏠 Main Menu", "💬 Talk to Expert" ]

2. LEAD CAPTURE (NAME & PHONE) ONLY FOR EXPLICIT ACTION:
   - ONLY when user clicks a conversion action like "Get Quote", "Book Appointment", "Claim Offer", "Book Free Trial", "Order Now", or "Request Callback", route them to lead capture.
   - Flow: [Action CTA] -> [node_lead_name] ("✍️ Please enter your full name:") -> [node_lead_phone] ("📱 Please share your WhatsApp number:") with button [ "📱 Same Number" ] -> [node_confirmation] ("✅ Thank you {{user_name}}! ...").

3. RETURN TO MENU:
   - The button "🏠 Main Menu" in ANY card MUST link back to "node_welcome".

4. HANDOFF:
   - "💬 Talk to Expert" MUST link to "node_handoff" (type: "handoff", data.action: "assign_agent").

5. COMPLETE EDGES:
   - EVERY button on EVERY node MUST have a corresponding edge in "edges" with targetNodeId pointing to a real node! NO dangling buttons with no edges!

Output ONLY valid JSON:
{
  "name": "Bot Name",
  "description": "Bot Description",
  "trigger": { "type": "keyword", "keywords": ["hi", "hello", "start", "menu"] },
  "nodes": [...]
}`;

  const userContent = `Business: FitZone Gym
Industry: Fitness & Gym
Language: English
Goal: A complete, highly professional WhatsApp bot for FitZone Gym. Showcase memberships, personal training, trial booking, timings & location, and trainer handoff.`;

  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.15,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      },
      { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    const parsed = JSON.parse(res.data.choices[0].message.content);
    console.log('Nodes generated:', parsed.nodes.length);
    console.log('Sample node_welcome:', JSON.stringify(parsed.nodes[0], null, 2));
    console.log('Sample node 1:', JSON.stringify(parsed.nodes[1], null, 2));
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

testGroq120b();

require('./config/env');
const axios = require('axios');

async function testArch() {
  const systemPrompt = `You are an elite WhatsApp Business Bot Architect — designing production-ready Meta WhatsApp Business bots for real companies.

═══════════════════════════════════════════════════
🔥 STRICT ARCHITECTURAL RULES (NEVER VIOLATE):
═══════════════════════════════════════════════════

1. BROWSING & INFORMATIONAL BUTTONS MUST REPLY WITH ANSWERS FIRST:
   - When a user clicks an informational button (e.g., "Explore Services", "Menu", "Membership Plans", "Features", "Pricing", "About Us", "Timings", "Catalog"), the bot MUST reply with thorough, valuable information, details, or a sub-category menu!
   - NEVER ask for Name or Phone number when a user is just exploring, asking for info, or clicking an informative button! That ruins customer experience.
   - Every informational card MUST have navigation buttons:
     e.g., [ "Action CTA (e.g. 📝 Get Quote / 🎟️ Book Trial / 🛵 Order)", "🏠 Main Menu", "💬 Talk to Expert" ]

2. LEAD CAPTURE (NAME & PHONE) ONLY FOR EXPLICIT ACTION CTAs:
   - Lead capture (Name -> Phone -> Confirmation) must ONLY be triggered when the user explicitly clicks an action CTA such as:
     "Get Quote", "Book Appointment", "Book Free Trial", "Claim Offer", "Order Now", or "Request Callback".
   - The lead funnel MUST be:
     [Action CTA] -> [node_lead_name] ("✍️ Please enter your full name:") -> [node_lead_phone] ("📱 Please share your WhatsApp number:" with button [ "📱 Same Number" ]) -> [node_confirmation] ("✅ Thank you {{user_name}}! ...") with button [ "🏠 Main Menu" ].
   - All other browsing/information nodes MUST NOT link to lead capture!

3. RETURN TO MAIN MENU & LOOPING:
   - Every informational card, confirmation node, and handoff node MUST have a "🏠 Main Menu" button whose edge targetNodeId is "node_welcome". A user must never be trapped.

4. EVERY BUTTON MUST HAVE A MATCHING EDGE:
   - Every single button in data.message.buttons MUST have an edge in "edges" where edge.label matches the button text and edge.targetNodeId points to a valid node. No dead-end buttons!

5. ALL INTERACTIVE NODES MUST HAVE type: "question":
   - Any node that presents buttons or a list to the user MUST have type: "question" so the bot waits for user input.
   - Only confirmation / informational end nodes without buttons can have type: "message".
   - Handoff node must have type: "handoff" with data.action = "assign_agent".

6. RICH, PROFESSIONAL CONTENT:
   - Write real, domain-specific text with emojis, bold headers, pricing, and clear descriptions matching what the business actually does.

═══════════════════════════════════════════════════
OUTPUT FORMAT: Output ONLY valid JSON:
═══════════════════════════════════════════════════
{
  "name": "Bot Name",
  "description": "Short description",
  "trigger": { "type": "keyword", "keywords": ["hi", "hello", "start", "menu"] },
  "nodes": [
    {
      "id": "node_welcome",
      "type": "question",
      "position": { "x": 500, "y": 50 },
      "data": {
        "variable": "main_menu_choice",
        "message": {
          "type": "buttons",
          "text": "👋 Welcome to *Business*! ...",
          "body": "👋 Welcome to *Business*! ...",
          "buttons": [
            { "id": "btn_services", "text": "🚀 Our Services", "title": "🚀 Our Services" },
            { "id": "btn_quote", "text": "💡 Get a Quote", "title": "💡 Get a Quote" },
            { "id": "btn_about", "text": "🏢 About Us", "title": "🏢 About Us" },
            { "id": "btn_support", "text": "💬 Talk to Expert", "title": "💬 Talk to Expert" }
          ]
        }
      },
      "edges": [
        { "targetNodeId": "node_services", "label": "Our Services, services, 1, btn_services" },
        { "targetNodeId": "node_lead_name", "label": "Get a Quote, quote, 2, btn_quote" },
        { "targetNodeId": "node_about", "label": "About Us, about, 3, btn_about" },
        { "targetNodeId": "node_handoff", "label": "Talk to Expert, support, expert, 4, btn_support" }
      ]
    }
  ]
}`;

  const userContent = `Business: YouTube
Industry: Media & Content / Entertainment
Language: English
Goal: WhatsApp bot for YouTube video streaming platform. Help users explore trending videos, creator tools, YouTube Premium plans & perks, and copyright/support help.`;

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
    console.log('Bot Name:', parsed.name);
    console.log('Nodes count:', parsed.nodes.length);
    parsed.nodes.forEach(n => {
      const msg = n.data?.message || n;
      const btns = (msg.buttons || n.buttons || []).map(b => (typeof b === 'string' ? b : (b.text || b.title))).join(' | ');
      console.log(`\nNode: ${n.id} (${n.type})`);
      console.log(`  Text: "${(msg.text || msg.body || n.text || '').slice(0, 80).replace(/\n/g, ' ')}..."`);
      if (btns) console.log(`  Buttons: [${btns}]`);
      console.log(`  Edges: ${(n.edges || []).map(e => `[${e.label || e.button || '*'}] -> ${e.targetNodeId}`).join(' ; ')}`);
    });
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}

testArch();

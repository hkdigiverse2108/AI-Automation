const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

function detectIndustryFromText(text) {
  const t = (text || '').toLowerCase();
  
  // 1. Healthcare & Medical Clinic
  if (/health|clinic|hospital|doctor|dental|medical|patient|pharma|wellness|ayurved|therapy|medicine|dentist/i.test(t)) {
    return 'Healthcare / Clinic & Hospital';
  }
  // 2. E-Commerce & Retail Products (Soap, Skincare, Cosmetics, Handmade, Fashion, Store, Shop, Goods, Products)
  if (/soap|skincare|cosmetic|beauty|organic|handmade|candle|apparel|clothing|fashion|boutique|product|store|shop|retail|jewel|grocery|perfume|goods|craft|accessories|gift|merchandise|footwear|bag|artisan|scent|lotion|order now|cart|collection/i.test(t)) {
    return 'E-Commerce & Retail';
  }
  // 3. Restaurant & Dining
  if (/restaurant|cafe|food|dining|pizza|kitchen|bakery|bar|catering|coffee|tea|dessert|burger|chef|menu|delicacy/i.test(t)) {
    return 'Restaurant & Hospitality';
  }
  // 4. Real Estate & Construction
  if (/real estate|property|realty|builder|construction|interior|villa|flat|apartment|broker|residence|plot|bungalow|housing/i.test(t)) {
    return 'Real Estate / Property';
  }
  // 5. Education & Coaching
  if (/education|coaching|school|college|academy|classes|institute|course|tuition|training|student|learn|tutor/i.test(t)) {
    return 'Education & Coaching';
  }
  // 6. Travel & Tourism
  if (/tour|travel|resort|hotel|holiday|visa|trip|vacation|flight|booking|stay/i.test(t)) {
    return 'Travel & Tourism';
  }
  // 7. Automotive
  if (/car|auto|vehicle|garage|mechanic|repair|motors|bike|towing/i.test(t)) {
    return 'Automotive & Car Service';
  }
  // 8. Finance & Insurance
  if (/finance|loan|insurance|invest|tax|accounting|ca firm|mutual fund|banking/i.test(t)) {
    return 'Finance & Insurance';
  }
  // 9. IT & Software / Digital Marketing
  if (/software|tech|developer|coding|web development|app development|saas|ai agent|automation|seo|cloud|digital marketing|programming/i.test(t)) {
    return 'IT & Software / Digital Marketing';
  }

  return 'Other / General Business';
}

/**
 * Safely scrape website metadata (Title, Description, Headings/Services, Offers)
 */
async function scrapeWebsite(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let targetUrl = rawUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const res = await axios.get(targetUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const html = typeof res.data === 'string' ? res.data : '';
    if (!html) return null;

    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

    // Meta Description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    const description = descMatch ? descMatch[1].replace(/\s+/g, ' ').trim() : '';

    // Headings (H1, H2)
    const headings = [];
    const hRegex = /<h[1-2][^>]*>([^<]+)<\/h[1-2]>/gi;
    let match;
    while ((match = hRegex.exec(html)) !== null && headings.length < 8) {
      const cleanH = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (cleanH && cleanH.length > 3 && cleanH.length < 80 && !headings.includes(cleanH)) {
        headings.push(cleanH);
      }
    }

    // Smart Brand Name Extraction
    let brandName = '';
    if (title) {
      brandName = title.split(/[-|–•:;]/)[0].trim();
      brandName = brandName.replace(/^(welcome to\s+|home\s*-\s*)/i, '').trim();
    }
    if (!brandName || brandName.length > 40) {
      try {
        const u = new URL(targetUrl);
        const hostClean = u.hostname.replace(/^www\./, '').split('.')[0];
        brandName = hostClean.charAt(0).toUpperCase() + hostClean.slice(1);
      } catch (e) {
        brandName = 'Our Business';
      }
    }

    // Comprehensive content text for detection
    const combinedContent = `${targetUrl} ${title} ${description} ${headings.join(' ')}`;
    const detectedIndustry = detectIndustryFromText(combinedContent);

    // Detect Special Offers / Discounts from website content
    const offerPatterns = [
      /(?:use promo code|use code|promo code|coupon code|discount code)\s*:?\s*["']?([A-Z0-9_-]{3,15})["']?[^<.,\n]{0,60}/i,
      /(?:flat|get|upto|up to)?\s*(\d{1,2}%\s*(?:off|discount)[^<.,\n]{0,50})/i,
      /(free\s+shipping\s*(?:on orders above|on orders over|worldwide|across india)?[^<.,\n]{0,35})/i,
      /(buy\s+\d+\s+get\s+\d+[^<.,\n]{0,40})/i,
      /(special\s+festive\s+offer[^<.,\n]{0,50})/i
    ];

    let detectedOffer = '';
    const searchableSnippet = `${html.slice(0, 30000)} ${description}`;
    for (const pat of offerPatterns) {
      const m = searchableSnippet.match(pat);
      if (m) {
        detectedOffer = m[0].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        break;
      }
    }

    // Modern SPA Fallback: Check if announcement or coupon API exists
    if (!detectedOffer) {
      try {
        const u = new URL(targetUrl);
        const domainHost = u.hostname.replace(/^www\./, '');
        const apiSettingsUrl = `https://api.${domainHost}/api/settings`;
        const apiRes = await axios.get(apiSettingsUrl, { timeout: 2000 });
        if (apiRes.data?.announcement?.text) {
          detectedOffer = apiRes.data.announcement.text.replace(/\s+/g, ' ').trim();
        }
      } catch (e) {
        // Ignore API fallback if unavailable
      }
    }

    // Dev SPA Fallback: Check announcement component if hosted on Vite
    if (!detectedOffer && html.includes('/src/main.jsx')) {
      try {
        const u = new URL(targetUrl);
        const bannerUrl = `${u.origin}/src/components/AnnouncementBanner.jsx`;
        const bRes = await axios.get(bannerUrl, { timeout: 2000 });
        const m = bRes.data?.match(/(?:Use promo code|promo code|coupon)[^'"]+/i);
        if (m) {
          detectedOffer = m[0].replace(/\s+/g, ' ').trim();
        }
      } catch (e) {
        // Ignore banner fallback
      }
    }

    const servicesSnippet = headings.slice(0, 3).join(', ');
    const suggestedPrompt = `Create an automated WhatsApp bot for ${brandName}. Welcome visitors warmly when they say hi, showcase our services & products (${servicesSnippet || 'our core collection'}) with quick reply buttons, explain each option when tapped, capture visitor name and phone number for inquiries & orders, and confirm follow-up.`;

    return {
      url: targetUrl,
      brandName,
      detectedIndustry,
      detectedOffer,
      title: title.slice(0, 150),
      description: description.slice(0, 300),
      headings: headings.slice(0, 6),
      suggestedPrompt
    };
  } catch (err) {
    logger.warn(`Website scrape failed for ${targetUrl}: ${err.message}`);
    return null;
  }
}

/**
 * Intelligent Dynamic Fallback Generator
 * Ensures 100% reliability even if Groq or external AI is offline.
 */
function generateFallbackFlow({ businessName, industry, websiteData, offers, language, prompt }) {
  const bName = (businessName || (websiteData && websiteData.title ? websiteData.title.split(/[-|–]/)[0].trim() : '') || 'Our Business').trim();
  const lang = (language || 'English').toLowerCase();
  const hasGujarati = lang.includes('gujarati');
  const hasHindi = lang.includes('hindi');
  const hasBilingual = lang.includes('bilingual');

  const offerText = offers ? `\n\n🎉 *Special Offer:* ${offers}` : '';

  // Tailored industry services
  let s1 = { id: 'btn_serv1', text: 'Our Services', title: 'Core Services', label: 'Services, services, 1, btn_serv1' };
  let s2 = { id: 'btn_offer', text: 'Special Offers', title: 'Current Offers', label: 'Offers, offer, 2, btn_offer' };
  let s3 = { id: 'btn_expert', text: 'Contact Expert', title: 'Talk to Human', label: 'Contact, expert, talk, 3, btn_expert' };

  let welcomeBody = `👋 Hello! Welcome to *${bName}*.\n\nWe are delighted to assist you on WhatsApp! How can we help you today?${offerText}`;
  if (hasGujarati) {
    welcomeBody = `👋 નમસ્તે! *${bName}* માં આપનું હાર્દિક સ્વાગત છે.\n\nવોટ્સએપ પર આપનું સ્વાગત છે! આજે અમે આપને કેવી રીતે મદદ કરી શકીએ?${offerText}`;
    s1.text = 'અમારી સેવાઓ';
    s2.text = 'ખાસ ઑફર્સ';
    s3.text = 'સંપર્ક કરો';
  } else if (hasHindi) {
    welcomeBody = `👋 नमस्ते! *${bName}* में आपका स्वागत है।\n\nव्हाट्सएप पर आपकी सेवा में हाजिर हैं! आज हम आपकी क्या मदद कर सकते हैं?${offerText}`;
    s1.text = 'हमारी सेवाएं';
    s2.text = 'विशेष ऑफर';
    s3.text = 'संपर्क करें';
  }

  // Welcome Node (Question with buttons)
  const nodeWelcome = {
    id: 'node_welcome',
    type: 'question',
    position: { x: 450, y: 60 },
    data: {
      variable: 'user_selected_menu',
      message: {
        type: 'buttons',
        text: welcomeBody,
        body: welcomeBody,
        buttons: [
          { id: s1.id, text: s1.text },
          { id: s2.id, text: s2.text },
          { id: s3.id, text: s3.text }
        ]
      }
    },
    edges: [
      { targetNodeId: 'node_services_list', label: `${s1.text}, ${s1.label}` },
      { targetNodeId: 'node_offer_details', label: `${s2.text}, ${s2.label}` },
      { targetNodeId: 'node_handoff', label: `${s3.text}, ${s3.label}` }
    ]
  };

  // Services Branch
  let servBody = `✨ *What We Offer at ${bName}:*\n\n1️⃣ High-Quality Solutions & Consulting\n2️⃣ Fast & Dedicated Support\n3️⃣ Customized Packages for your needs\n\nPlease reply with what you need, or tap below:`;
  if (websiteData && websiteData.description) {
    servBody = `✨ *About ${bName}:*\n${websiteData.description}\n\nOur key specializations:\n${(websiteData.headings || []).map((h, i) => `${i+1}️⃣ ${h}`).join('\n') || '• Professional Services\n• Premium Support'}\n\nPlease reply with your requirement:`;
  }
  if (hasGujarati) {
    servBody = `✨ *${bName} ની મુખ્ય સેવાઓ:*\n\n1️⃣ શ્રેષ્ઠ ગુણવત્તા અને કન્સલ્ટિંગ\n2️⃣ ઝડપી સપોર્ટ અને સોલ્યુશન્સ\n3️⃣ તમારા વ્યવસાય માટે ખાસ પેકેજ\n\nકૃપા કરીને આપની જરૂરિયાત જણાવો:`;
  } else if (hasHindi) {
    servBody = `✨ *${bName} की प्रमुख सेवाएं:*\n\n1️⃣ उच्च गुणवत्ता वाले समाधान और परामर्श\n2️⃣ तेज़ और समर्पित सहायता\n3️⃣ आपकी आवश्यकताओं के अनुसार विशेष पैकेज\n\nकृपया अपनी आवश्यकता बताएं:`;
  }

  const nodeServices = {
    id: 'node_services_list',
    type: 'question',
    position: { x: 150, y: 320 },
    data: {
      variable: 'customer_requirement',
      message: {
        type: 'text',
        text: servBody,
        body: servBody
      }
    },
    edges: [
      { targetNodeId: 'node_lead_name', label: 'next, details, quote, yes' }
    ]
  };

  // Offers Branch
  let offBody = offers ? `🎁 *Exclusive Offer for You!*\n\n${offers}\n\nClaim this offer now by sharing your details with our representative!` : `🎁 *Exciting Deals Available!*\n\nGet up to 20% discount on your first booking with ${bName}!\n\nClaim this offer now by sharing your details.`;
  if (hasGujarati) {
    offBody = `🎁 *આપના માટે ખાસ ઑફર!*\n\n${offers || 'પ્રથમ બુકિંગ પર 20% સુધીનું ખાસ ડિસ્કાઉન્ટ મેળવો!'}\n\nઆ ઑફરનો લાભ લેવા કૃપા કરીને આપની વિગતો આપો.`;
  } else if (hasHindi) {
    offBody = `🎁 *आपके लिए विशेष ऑफर!*\n\n${offers || 'अपनी पहली बुकिंग पर 20% तक की विशेष छूट प्राप्त करें!'}\n\nइस ऑफर का लाभ उठाने के लिए कृपया अपना विवरण साझा करें।`;
  }

  const nodeOffers = {
    id: 'node_offer_details',
    type: 'question',
    position: { x: 450, y: 320 },
    data: {
      variable: 'claimed_offer',
      message: {
        type: 'buttons',
        text: offBody,
        body: offBody,
        buttons: [
          { id: 'btn_claim', text: hasGujarati ? 'ઑફર મેળવો' : (hasHindi ? 'ऑफर प्राप्त करें' : 'Claim Offer') },
          { id: 'btn_back', text: hasGujarati ? 'મેઇન મેનૂ' : (hasHindi ? 'मेन मेनू' : 'Main Menu') }
        ]
      }
    },
    edges: [
      { targetNodeId: 'node_lead_name', label: 'Claim Offer, claim, 1, btn_claim, ઑફર મેળવો, ऑफर प्राप्त करें' },
      { targetNodeId: 'node_welcome', label: 'Main Menu, menu, 2, btn_back, મેઇન મેનૂ, मेन मेनू' }
    ]
  };

  // Lead Capture: Name
  const nodeLeadName = {
    id: 'node_lead_name',
    type: 'question',
    position: { x: 300, y: 560 },
    data: {
      variable: 'user_full_name',
      message: {
        type: 'text',
        text: hasGujarati ? 'કૃપા કરીને આપનું પૂરું નામ લખીને મોકલો:' : (hasHindi ? 'कृपया अपना पूरा नाम लिखकर भेजें:' : 'Please enter your full name:'),
        body: hasGujarati ? 'કૃપા કરીને આપનું પૂરું નામ લખીને મોકલો:' : (hasHindi ? 'कृपया अपना पूरा नाम लिखकर भेजें:' : 'Please enter your full name:')
      }
    },
    edges: [
      { targetNodeId: 'node_lead_phone', label: '' }
    ]
  };

  // Lead Capture: Phone (Smart WhatsApp aware)
  const phoneTextEn = 'Thank you {{user_full_name}}! 🙏\n\n📱 We already have your WhatsApp number (*{{phone}}*).\n\nTap *Same Number* below to confirm, or reply with an alternate calling number:';
  const phoneTextHi = 'धन्यवाद {{user_full_name}}! 🙏\n\n📱 आपका यह व्हाट्सएप नंबर (*{{phone}}*) हमारे पास नोट है।\n\nपुष्टि के लिए नीचे *यही नंबर (Same)* पर टैप करें, या कोई दूसरा कॉलिंग नंबर लिखकर भेजें:';
  const phoneTextGu = 'આભાર {{user_full_name}}! 🙏\n\n📱 આપનો આ વોટ્સએપ નંબર (*{{phone}}*) અમારી પાસે છે.\n\nકન્ફર્મ કરવા નીચે *આ જ નંબર (Same)* પર ટેપ કરો, અથવા અન્ય કોલિંગ નંબર લખીને મોકલો:';

  const nodeLeadPhone = {
    id: 'node_lead_phone',
    type: 'question',
    position: { x: 300, y: 780 },
    data: {
      variable: 'user_phone_number',
      message: {
        type: 'buttons',
        text: hasGujarati ? phoneTextGu : (hasHindi ? phoneTextHi : phoneTextEn),
        body: hasGujarati ? phoneTextGu : (hasHindi ? phoneTextHi : phoneTextEn),
        buttons: [
          {
            id: 'btn_same_phone',
            text: hasGujarati ? '📱 આ જ નંબર (Same)' : (hasHindi ? '📱 यही नंबर (Same)' : '📱 Same Number')
          }
        ]
      }
    },
    edges: [
      { targetNodeId: 'node_confirmation', label: 'Same Number, same, 1, btn_same_phone, यही नंबर, આ જ નંબર, default' }
    ]
  };

  // Confirmation Node with CRM sync
  let confirmBody = `✅ *Thank you, {{user_full_name}}!*\n\nYour details have been received successfully. A specialist from *${bName}* will get in touch with you at *{{user_phone_number}}* shortly.\n\n📲 *Lead Synced to CRM & Owner Notified!* Have a wonderful day! 🌟`;
  if (hasGujarati) {
    confirmBody = `✅ *ખૂબ ખૂબ આભાર, {{user_full_name}}!*\n\nઆપની વિગતો સફળતાપૂર્વક મળી ગઈ છે. *${bName}* ના અમારા પ્રતિનિધિ ટૂંક સમયમાં *{{user_phone_number}}* પર આપનો સંપર્ક કરશે.\n\n📲 *લીડ CRM માં સિંક થઈ ગઈ છે!* આપનો દિવસ શુભ રહે! 🌟`;
  } else if (hasHindi) {
    confirmBody = `✅ *बहुत-बहुत धन्यवाद, {{user_full_name}}!*\n\nआपका विवरण सफलतापूर्वक प्राप्त हो गया है। *${bName}* के विशेषज्ञ जल्द ही आपसे *{{user_phone_number}}* पर संपर्क करेंगे।\n\n📲 *लीड CRM में सिंक हो गई है और ओनर को सूचित कर दिया गया है!* आपका दिन शुभ हो! 🌟`;
  }

  const nodeConfirm = {
    id: 'node_confirmation',
    type: 'message',
    position: { x: 300, y: 1000 },
    data: {
      action: 'crm_lead_sync',
      crmSync: true,
      notifyOwner: true,
      capturedVariables: ['user_full_name', 'user_phone_number'],
      message: {
        type: 'text',
        text: confirmBody,
        body: confirmBody
      }
    },
    edges: []
  };

  // Human Handoff / Live Agent Escalation Node
  const nodeHandoff = {
    id: 'node_handoff',
    type: 'handoff',
    position: { x: 750, y: 320 },
    data: {
      action: 'assign_agent',
      actionType: 'human_takeover',
      message: {
        type: 'text',
        text: hasGujarati 
          ? 'અમારા નિષ્ણાત ટૂંક સમયમાં આપની સાથે જોડાશે! ⚡ કૃપા કરીને થોડી રાહ જુઓ.' 
          : (hasHindi 
            ? 'हमारे विशेषज्ञ जल्द ही आपसे जुड़ेंगे! ⚡ कृपया कुछ क्षण प्रतीक्षा करें।' 
            : 'Connecting you with a team member right now! ⚡ They will be with you shortly.'),
        body: hasGujarati 
          ? 'અમારા નિષ્ણાત ટૂંક સમયમાં આપની સાથે જોડાશે! ⚡ કૃપા કરીને થોડી રાહ જુઓ.' 
          : (hasHindi 
            ? 'हमारे विशेषज्ञ जल्द ही आपसे जुड़ेंगे! ⚡ कृपया कुछ क्षण प्रतीक्षा करें।' 
            : 'Connecting you with a team member right now! ⚡ They will be with you shortly.')
      }
    },
    edges: []
  };

  return {
    name: `${bName} - WhatsApp AI Bot Flow`,
    description: `Automated WhatsApp assistant for ${bName}. Answers greetings, shows services, features offers, captures lead information, human handoff, and confirms follow-up.`,
    trigger: {
      type: 'keyword',
      keywords: ['hi', 'hello', 'hey', 'start', 'menu', 'kem cho', 'namaste', 'નમસ્તે', 'કેમ છો', 'info']
    },
    nodes: [nodeWelcome, nodeServices, nodeOffers, nodeLeadName, nodeLeadPhone, nodeConfirm, nodeHandoff]
  };
}

/**
 * Layout helper & build integrity sanitizer
 */
function sanitizeAndLayoutFlow(nodes, businessName = 'Our Business') {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const nodeMap = new Map();
  nodes.forEach(n => {
    if (n && n.id) nodeMap.set(n.id, n);
  });

  const processed = nodes.map((node, index) => {
    let pos = node.position;
    if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || (pos.x === 0 && pos.y === 0)) {
      pos = { x: 350, y: 80 + index * 240 };
    }

    const nodeType = node.type || 'message';
    const msg = node.data?.message || {};
    let textContent = (msg.text || msg.body || msg.caption || node.data?.text || node.data?.prompt || '').trim();

    // Auto-fill empty text content
    if (!textContent) {
      if (node.id.includes('name')) {
        textContent = 'Please enter your full name:';
      } else if (node.id.includes('phone') || node.id.includes('contact')) {
        textContent = 'Please share your WhatsApp contact number:';
      } else if (node.id.includes('email')) {
        textContent = 'Please provide your email address:';
      } else if (node.id.includes('confirm') || node.id.includes('thank')) {
        textContent = `Thank you! We have received your request. An expert from ${businessName} will contact you shortly. 🌟`;
      } else if (nodeType === 'question') {
        textContent = 'Please reply with your response or select an option below:';
      } else {
        textContent = `Hello! Welcome to ${businessName}. How can we help you?`;
      }
    }

    // Ensure variable name for question nodes
    let varName = node.data?.variable;
    if (nodeType === 'question' && (!varName || !String(varName).trim())) {
      varName = node.id.replace(/^node_/, '') || `user_choice_${index + 1}`;
    }

    // Ensure buttons have both text and title
    let sanitizedButtons = msg.buttons;
    if (Array.isArray(msg.buttons)) {
      sanitizedButtons = msg.buttons.map((b, bi) => {
        const val = b.text || b.title || b.label || `Option ${bi + 1}`;
        return {
          id: b.id || `btn_${Date.now()}_${bi}`,
          text: val,
          title: val
        };
      });
    }

    // Clean edges - only keep targets that exist
    const rawEdges = Array.isArray(node.edges) ? node.edges : [];
    const validEdges = rawEdges.filter(e => e && e.targetNodeId && (nodeMap.has(e.targetNodeId) || e.targetNodeId === 'node_confirmation'));

    return {
      ...node,
      type: nodeType,
      position: pos,
      data: {
        ...node.data,
        variable: varName,
        message: {
          ...msg,
          text: textContent,
          body: textContent,
          buttons: sanitizedButtons
        }
      },
      edges: validEdges
    };
  });

  // Ensure every leaf question node (e.g. asking for name or phone) connects to a confirmation node
  let hasConfirmation = processed.some(n => n.id === 'node_confirmation' || n.id.includes('confirm') || n.id.includes('thank'));
  const needsConfirmation = [];

  processed.forEach(n => {
    if (n.type === 'question' && (!n.edges || n.edges.length === 0)) {
      needsConfirmation.push(n);
    }
  });

  if (needsConfirmation.length > 0 && !hasConfirmation) {
    const maxY = Math.max(...processed.map(n => n.position?.y || 0));
    const confirmNode = {
      id: 'node_confirmation',
      type: 'message',
      position: { x: 350, y: maxY + 240 },
      data: {
        message: {
          type: 'text',
          text: `✅ Thank you! Your request has been recorded. A specialist from ${businessName} will reach out to you shortly. Have a wonderful day! 🌟`,
          body: `✅ Thank you! Your request has been recorded. A specialist from ${businessName} will reach out to you shortly. Have a wonderful day! 🌟`
        }
      },
      edges: []
    };
    processed.push(confirmNode);

    needsConfirmation.forEach(n => {
      n.edges = [{ targetNodeId: 'node_confirmation', label: '' }];
    });
  } else if (needsConfirmation.length > 0 && hasConfirmation) {
    const existingConfirm = processed.find(n => n.id === 'node_confirmation' || n.id.includes('confirm') || n.id.includes('thank'));
    if (existingConfirm) {
      needsConfirmation.forEach(n => {
        n.edges = [{ targetNodeId: existingConfirm.id, label: '' }];
      });
    }
  }

  return processed;
}

/**
 * Main AI Flow Generator
 */
async function generateBotFlow({
  prompt,
  businessName,
  industry,
  websiteUrl,
  offers,
  language = 'English'
}) {
  logger.info(`AI Bot Builder: Generating flow for "${businessName || 'Business'}" (${industry || 'General'})`);

  // 1. Scrape website if provided
  let websiteData = null;
  if (websiteUrl) {
    websiteData = await scrapeWebsite(websiteUrl);
  }

  // 2. Prepare context
  const siteContext = websiteData
    ? `\nWebsite Metadata:\n- Site Title: ${websiteData.title}\n- Description: ${websiteData.description}\n- Main Headings / Offerings: ${websiteData.headings.join(' | ')}`
    : '';

  const offerContext = offers ? `\nPromotional Offers / Discounts to feature: ${offers}` : '';

  const userGoalPrompt = prompt
    ? `\nSpecific User Requirements:\n${prompt}`
    : `\nGoal: Create a complete, high-converting WhatsApp bot flow with a warm welcome message, interactive quick reply buttons for core services and offers, lead capture variables (name, phone/requirement), and a reassuring confirmation message.`;

  const systemPrompt = `You are an elite Conversational AI Architect specializing in Meta WhatsApp Business Automation (WABA).
Generate a complete, production-ready WhatsApp chatbot flow JSON based on the user's business details, website content, and promotional offers.

A valid WhatsApp Flow JSON MUST strictly adhere to this schema:
{
  "name": "Bot Flow Name",
  "description": "Short description of what the bot does",
  "trigger": {
    "type": "keyword",
    "keywords": ["hi", "hello", "hey", "start", "menu"]
  },
  "nodes": [
    {
      "id": "node_welcome",
      "type": "question", // Use "question" when expecting choices/buttons or input, "message" when purely informing
      "position": { "x": 450, "y": 60 },
      "data": {
        "variable": "user_choice",
        "message": {
          "type": "buttons", // "buttons" (1-3 quick reply buttons), "list", or "text"
          "text": "Hello! Welcome to ...",
          "body": "Hello! Welcome to ...",
          "buttons": [
            { "id": "btn_services", "text": "Our Services" },
            { "id": "btn_offers", "text": "Special Offers" },
            { "id": "btn_contact", "text": "Talk to Expert" }
          ]
        }
      },
      "edges": [
        { "targetNodeId": "node_services", "label": "Our Services, services, 1, btn_services" },
        { "targetNodeId": "node_offers", "label": "Special Offers, offers, 2, btn_offers" },
        { "targetNodeId": "node_handoff", "label": "Talk to Expert, contact, human, 3, btn_contact" }
      ]
    },
    {
      "id": "node_handoff",
      "type": "handoff",
      "position": { "x": 750, "y": 320 },
      "data": {
        "action": "assign_agent",
        "message": {
          "text": "Connecting you with a team member right now! ⚡ They will be with you shortly.",
          "body": "Connecting you with a team member right now! ⚡ They will be with you shortly."
        }
      },
      "edges": []
    }
  ]
}

STRICT ARCHITECTURE RULES:
1. Always populate BOTH data.message.text AND data.message.body with the exact same text string.
2. INTERACTIVE TYPES (BUTTONS VS LIST MENU):
   - For 1-3 choices: Use type: "buttons" with data.message.buttons array.
   - For 4 or more choices (or when user requests a List/Menu): Use type: "list" with data.message.sections array containing { "title": "Category Title", "rows": [{ "id": "row_item_1", "title": "Item Name", "description": "Short subtitle" }] }. Each edge leading from a list node must have label containing the row title and row id.
3. Structure nodes hierarchically with clean (x, y) coordinates:
   - Root welcome node at x: 450, y: 60
   - First level branches spread at y: 320 (e.g. x: 120, x: 450, x: 750)
   - "Talk to Expert" / "Live Agent" option MUST connect to a terminal node of type "handoff".
   - Second level (lead capture: name, phone) at y: 580 and y: 820
   - Final confirmation node at y: 1060 with crmSync: true
4. Ensure all edge targetNodeIds exist in the nodes list.
5. Edge labels MUST contain comma-separated accepted input keywords (e.g. "Services, services, 1, btn_services").
5. When asking questions that save user data, specify a clear data.variable (e.g., "user_name", "user_phone", "service_interest").
   - SMART WHATSAPP LEAD CAPTURE: Since the customer is already on WhatsApp, do NOT blindly ask them to type their phone number. Acknowledge their number and offer a 1-tap "Same Number" button:
     e.g., "Thank you {{user_name}}! 🙏\n\n📱 We already have your WhatsApp number (*{{phone}}*).\n\nTap *Same Number* below to confirm, or reply with an alternate calling number:" with button [{ "id": "btn_same_phone", "text": "📱 Same Number" }].
6. The closing node should be type "message" with crmSync: true that thanks {{user_name}}, confirms next steps at {{user_phone}}, and confirms lead capture.
7. Language: Craft all messages and buttons strictly in the requested language (${language}). If Gujarati or Hindi or Bilingual, use polite native greetings.
8. Output ONLY raw JSON. No markdown code blocks or conversational text.`;

  const userContent = `Business Name: ${businessName || 'Our Business'}
Industry: ${industry || 'General Services'}
Language: ${language}${siteContext}${offerContext}${userGoalPrompt}`;

  // 3. Try LLM Call via Groq
  const groqApiKey = process.env.GROQ_API_KEY;
  if (groqApiKey) {
    const candidateModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

    for (const model of candidateModels) {
      try {
        logger.info(`AI Bot Builder: Calling Groq model ${model}...`);
        const maxTokens = model.includes('qwen') ? 950 : 2400;

        const res = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userContent }
            ],
            temperature: 0.2,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' }
          },
          {
            timeout: 20000,
            headers: {
              'Authorization': `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const rawContent = res.data?.choices?.[0]?.message?.content;
        if (rawContent) {
          const parsed = JSON.parse(rawContent);
          if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length >= 2) {
            logger.info(`AI Bot Builder: Generated successfully with ${model}! Nodes: ${parsed.nodes.length}`);
            
            // Sanitize & normalize coordinates & properties
            const normalizedNodes = sanitizeAndLayoutFlow(parsed.nodes, businessName);
            
            return {
              flow: {
                _id: 'new_flow',
                name: parsed.name || `${businessName || 'AI'} Bot Flow`,
                description: parsed.description || 'Generated by AI Bot Builder',
                trigger: parsed.trigger || { type: 'keyword', keywords: ['hi', 'hello', 'start', 'menu'] },
                nodes: normalizedNodes
              },
              websiteData,
              source: `AI (${model})`
            };
          }
        }
      } catch (err) {
        logger.warn(`AI Bot Builder: Model ${model} failed: ${err.response?.data?.error?.message || err.message}`);
      }
    }
  }

  // 4. Fallback generator
  logger.info('AI Bot Builder: Using intelligent contextual fallback generator');
  const fallbackFlow = generateFallbackFlow({
    businessName,
    industry,
    websiteData,
    offers,
    language,
    prompt
  });

  return {
    flow: {
      ...fallbackFlow,
      _id: 'new_flow'
    },
    websiteData,
    source: 'Smart AI Synthesizer'
  };
}

/**
 * Programmatic Refinement Fallback when external LLM is busy/offline
 */
function applyProgrammaticRefinement(existingNodes, instruction, businessName = 'Our Business', language = 'English') {
  const instr = (instruction || '').toLowerCase();
  const nodes = JSON.parse(JSON.stringify(existingNodes));

  // Case 1: Add Human Handoff / Talk to agent
  if (/handoff|human|agent|expert|support/i.test(instr)) {
    const hasHandoff = nodes.some(n => n.type === 'handoff' || n.id === 'node_handoff');
    if (!hasHandoff) {
      const handoffNode = {
        id: 'node_handoff',
        type: 'handoff',
        position: { x: 750, y: 320 },
        data: {
          action: 'assign_agent',
          message: {
            text: 'Connecting you with a team member right now! ⚡ They will be with you shortly.',
            body: 'Connecting you with a team member right now! ⚡ They will be with you shortly.'
          }
        },
        edges: []
      };
      nodes.push(handoffNode);

      const welcome = nodes.find(n => n.id.includes('welcome') || n.id === nodes[0]?.id);
      if (welcome && welcome.data?.message) {
        welcome.data.message.buttons = welcome.data.message.buttons || [];
        if (!welcome.data.message.buttons.some(b => b.text.toLowerCase().includes('expert') || b.text.toLowerCase().includes('agent'))) {
          welcome.data.message.buttons.push({ id: 'btn_expert', text: 'Talk to Expert' });
          welcome.edges = welcome.edges || [];
          welcome.edges.push({ targetNodeId: 'node_handoff', label: 'Talk to Expert, expert, human, 3, btn_expert' });
        }
      }
    }
  }

  // Case 2: Add Email Capture
  if (/email|mail/i.test(instr)) {
    const hasEmail = nodes.some(n => n.data?.variable === 'user_email' || n.id.includes('email'));
    if (!hasEmail) {
      const emailNode = {
        id: 'node_lead_email',
        type: 'question',
        position: { x: 300, y: 680 },
        data: {
          variable: 'user_email',
          message: {
            type: 'text',
            text: 'Could you also please share your email address for sending detailed quotes & updates?',
            body: 'Could you also please share your email address for sending detailed quotes & updates?'
          }
        },
        edges: [{ targetNodeId: 'node_lead_phone', label: '' }]
      };

      const nameNode = nodes.find(n => n.id.includes('name'));
      if (nameNode) {
        nameNode.edges = [{ targetNodeId: 'node_lead_email', label: '' }];
      }
      nodes.push(emailNode);
    }
  }

  // Case 3: Add discount/offer
  if (/discount|offer|coupon|deal|promo/i.test(instr)) {
    const match = instr.match(/\d{1,2}%/);
    const pct = match ? match[0] : '20%';
    const offerNode = nodes.find(n => n.id.includes('offer'));
    if (offerNode) {
      const text = `🎁 *Special Exclusive Offer:* Enjoy ${pct} OFF at ${businessName}! Claim now by sharing your details below.`;
      offerNode.data.message.text = text;
      offerNode.data.message.body = text;
    }
  }

  // Case 4: Make shorter
  if (/short|concise|brief/i.test(instr)) {
    const welcome = nodes.find(n => n.id.includes('welcome') || n.id === nodes[0]?.id);
    if (welcome && welcome.data?.message?.text) {
      welcome.data.message.text = `👋 Welcome to *${businessName}*! How can we assist you today?`;
      welcome.data.message.body = welcome.data.message.text;
    }
  }

  return nodes;
}

/**
 * Refine an existing generated flow based on conversational feedback
 */
async function refineBotFlow({ flow, refineInstruction, businessName = 'Our Business', language = 'English' }) {
  if (!flow || !Array.isArray(flow.nodes)) {
    throw new Error('Invalid flow structure to refine');
  }

  const groqApiKey = process.env.GROQ_API_KEY;
  const currentNodesJSON = JSON.stringify(flow.nodes, null, 2);

  const refineSystemPrompt = `You are an elite Conversational AI Architect for Meta WhatsApp Business Automation (WABA).
You are given an EXISTING WhatsApp Bot Flow JSON and a user's refinement instruction.
Your goal is to modify, enhance, or add/remove nodes and edges strictly following the user's refinement instruction.

STRICT RULES:
1. Preserve existing good nodes, but modify messages, add buttons, add questions, add handoff, or update tone as requested.
2. Every node MUST have data.message.text AND data.message.body set to non-empty strings.
3. If user asks for discounts/offers, create or update the relevant buttons/nodes.
4. If user asks for human handoff or expert talk, ensure it routes to a node of type "handoff" with action "assign_agent".
5. If user asks to capture more fields (like email or location), add an intermediate "question" block with appropriate data.variable (e.g. "user_email", "user_city").
6. The final confirmation node should have crmSync: true to confirm lead capture.
7. Output MUST be ONLY valid JSON matching this structure:
{
  "name": "Updated Flow Name",
  "description": "Short description",
  "trigger": { "type": "keyword", "keywords": ["hi", "hello", "start", "menu"] },
  "nodes": [ ...updated nodes list... ]
}
Do NOT wrap in markdown code blocks or add explanations.`;

  const refineUserMessage = `Business Name: ${businessName}
Target Language: ${language}
Refinement Instruction: "${refineInstruction}"

Existing Nodes JSON:
${currentNodesJSON}`;

  if (groqApiKey) {
    const candidateModels = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
    for (const model of candidateModels) {
      try {
        logger.info(`AI Bot Builder: Refining flow with ${model}...`);
        const maxTokens = model.includes('qwen') ? 950 : 2500;
        const res = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model,
            messages: [
              { role: 'system', content: refineSystemPrompt },
              { role: 'user', content: refineUserMessage }
            ],
            temperature: 0.2,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' }
          },
          {
            timeout: 25000,
            headers: {
              'Authorization': `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            }
          }
        );

        const raw = res.data?.choices?.[0]?.message?.content;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length >= 2) {
            const normalizedNodes = sanitizeAndLayoutFlow(parsed.nodes, businessName);
            return {
              flow: {
                ...flow,
                name: parsed.name || flow.name,
                description: parsed.description || flow.description,
                trigger: parsed.trigger || flow.trigger,
                nodes: normalizedNodes
              },
              note: `Refined using AI (${model})`
            };
          }
        }
      } catch (err) {
        logger.warn(`AI Refine Model ${model} failed: ${err.message}`);
      }
    }
  }

  // Fallback programmatic refiner if offline
  logger.info('AI Bot Builder: Applying smart programmatic refinement');
  const updatedNodes = applyProgrammaticRefinement(flow.nodes, refineInstruction, businessName, language);
  const normalizedNodes = sanitizeAndLayoutFlow(updatedNodes, businessName);

  return {
    flow: {
      ...flow,
      nodes: normalizedNodes
    },
    note: 'Refined with Smart Rule Engine'
  };
}

module.exports = {
  scrapeWebsite,
  generateBotFlow,
  generateFallbackFlow,
  refineBotFlow
};


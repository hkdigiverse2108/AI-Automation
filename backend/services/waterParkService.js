const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const winston = require('winston');
const whatsapp = require('./whatsapp');
const Message = require('../models/Message');
const Lead = require('../models/Lead');
const Contact = require('../models/Contact');
const Conversation = require('../models/Conversation');
const { decryptField } = require('./encryption');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// In-memory cache for water park DALL-E generated images (topic -> local relative URL)
const imageCache = new Map();

/**
 * Ensures that a local physical placeholder image exists to prevent crashes.
 */
function ensurePlaceholderImage() {
  const uploadDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const destPath = path.join(uploadDir, 'waterpark-placeholder.jpg');
  if (!fs.existsSync(destPath)) {
    const base64Png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    fs.writeFileSync(destPath, Buffer.from(base64Png, 'base64'));
  }
  return '/uploads/waterpark-placeholder.jpg';
}

/**
 * Downloads OpenAI's DALL-E image locally to serve it permanently.
 */
async function downloadGeneratedImage(imageUrl) {
  try {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filename = `wp-ai-${crypto.randomBytes(8).toString('hex')}.png`;
    const destPath = path.join(uploadDir, filename);

    const response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return `/uploads/${filename}`;
  } catch (err) {
    logger.error('Failed to download DALL-E image locally:', err.message);
    return null;
  }
}

/**
 * Helper to natively upload and send a local media image file.
 */
async function sendLocalImage(localPath, captionText, waAccount, token, contact, io, conversation) {
  const userId = waAccount.userId;
  let metaMediaId = null;

  try {
    const filePath = path.join(__dirname, '..', localPath);
    if (fs.existsSync(filePath) && token !== 'demo' && token !== 'mock' && !token?.startsWith('mock_')) {
      const fileBuffer = fs.readFileSync(filePath);
      const uploadRes = await whatsapp.uploadMedia(waAccount.phoneNumberId, token, fileBuffer, 'image/png');
      if (uploadRes.success && uploadRes.data?.id) {
        metaMediaId = uploadRes.data.id;
      }
    }
  } catch (err) {
    logger.error('Failed to pre-upload image to Meta CDN:', err.message);
  }

  // Resolve absolute domain URL for local fallback
  const appUrl = process.env.NEXT_PUBLIC_API_URL 
    ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') 
    : 'http://localhost:5000';
  const finalMediaUrl = `${appUrl}${localPath}`;

  const sendResult = await whatsapp.sendImageMessage(
    waAccount.phoneNumberId,
    token,
    contact.phone,
    finalMediaUrl,
    captionText,
    metaMediaId
  );

  const message = await Message.create({
    userId,
    conversationId: conversation._id,
    contactId: contact._id,
    direction: 'outbound',
    type: 'image',
    content: {
      mediaUrl: localPath,
      caption: captionText,
    },
    status: sendResult.success ? 'sent' : 'failed',
    metaMessageId: sendResult.data?.messages?.[0]?.id,
    sentBy: 'bot',
    errorDetails: sendResult.error || undefined,
  });

  // Track the viewed image in CRM Contact customFields
  const viewedImagesStr = contact.customFields?.get('wp_viewed_images') || '';
  const viewedArr = viewedImagesStr ? viewedImagesStr.split(',') : [];
  if (!viewedArr.includes(captionText)) {
    viewedArr.push(captionText);
    contact.customFields = contact.customFields || new Map();
    contact.customFields.set('wp_viewed_images', viewedArr.join(','));
    await contact.save();
  }

  if (io) {
    io.to(`user_${userId}`).emit('new_message', {
      message: message.toObject(),
      contact: contact.toObject(),
      conversationId: conversation._id,
    });
  }
}

/**
 * Sends a standard text message.
 */
async function sendTextMessage(text, waAccount, token, contact, io, conversation) {
  const userId = waAccount.userId;
  const result = await whatsapp.sendTextMessage(waAccount.phoneNumberId, token, contact.phone, text);
  
  const message = await Message.create({
    userId,
    conversationId: conversation._id,
    contactId: contact._id,
    direction: 'outbound',
    type: 'text',
    content: { text },
    status: result.success ? 'sent' : 'failed',
    metaMessageId: result.data?.messages?.[0]?.id,
    sentBy: 'bot',
    errorDetails: result.error || undefined,
  });

  if (io) {
    io.to(`user_${userId}`).emit('new_message', {
      message: message.toObject(),
      contact: contact.toObject(),
      conversationId: conversation._id,
    });
  }
  return message;
}

/**
 * Dynamic AI DALL-E image generation coordinates.
 */
async function generateAndSendWaterParkImage(topic, promptText, captionText, waAccount, token, contact, io, conversation) {
  const userId = waAccount.userId;

  // Check memory cache
  if (imageCache.has(topic)) {
    const cachedUrl = imageCache.get(topic);
    logger.info(`[WP IMAGE CACHE] HIT for topic: ${topic}`);
    await sendLocalImage(cachedUrl, captionText, waAccount, token, contact, io, conversation);
    return;
  }

  const isGujarati = contact.customFields?.get('wp_lang') === 'gu';
  const loadingText = isGujarati 
    ? '✨ તમારી વિનંતી પરથી Chab Chabba Chab Water Park ની એક અદ્ભુત તસવીર બનાવી રહ્યા છીએ... કૃપા કરીને થોડીવાર રાહ જુઓ. 🌊📸'
    : '✨ Generating a realistic promotional image of Chab Chabba Chab Water Park for you... Please wait a moment. 🌊📸';
  
  await sendTextMessage(loadingText, waAccount, token, contact, io, conversation);

  let finalUrl = '';
  
  if (token === 'demo' || token === 'mock' || token?.startsWith('mock_')) {
    finalUrl = ensurePlaceholderImage();
  } else {
    try {
      const User = require('../models/User');
      const Organization = require('../models/Organization');
      const user = await User.findById(userId);
      const org = user ? await Organization.findById(user.organizationId).lean() : null;
      
      const customOpenAIKey = org?.aiConfig?.openaiApiKey ? decryptField(org.aiConfig.openaiApiKey) : null;
      const finalOpenAIKey = (customOpenAIKey && customOpenAIKey.trim() !== '') ? customOpenAIKey.trim() : process.env.OPENAI_API_KEY;

      if (!finalOpenAIKey || finalOpenAIKey.includes('your_openai_api_key')) {
        throw new Error('No valid OpenAI API key configured');
      }

      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: finalOpenAIKey });

      logger.info(`[WP DALL-E] Generating image for topic: ${topic}`);
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: `${promptText}, photorealistic, family friendly, bright and attractive, commercial marketing quality, suitable for WhatsApp and Instagram`,
        n: 1,
        size: '1024x1024'
      });

      const dallEUrl = response.data[0]?.url;
      if (dallEUrl) {
        const localPath = await downloadGeneratedImage(dallEUrl);
        if (localPath) {
          finalUrl = localPath;
          imageCache.set(topic, localPath);
        }
      }
    } catch (err) {
      logger.error(`[WP DALL-E] Failed to generate image: ${err.message}. Falling back to placeholder.`);
      finalUrl = ensurePlaceholderImage();
    }
  }

  if (finalUrl) {
    await sendLocalImage(finalUrl, captionText, waAccount, token, contact, io, conversation);
  }
}

/**
 * Main Entrance - State-Machine processing flow.
 */
async function processIncomingMessage(savedMsg, waAccount, token, io) {
  const userId = waAccount.userId;
  const conversationId = savedMsg.conversationId;
  const contactId = savedMsg.contactId;

  const contact = await Contact.findById(contactId);
  const conversation = await Conversation.findById(conversationId);
  if (!contact || !conversation) return;

  const text = (savedMsg.content?.text || '').trim();
  const lowerText = text.toLowerCase();
  
  // Track viewed products in Contact customFields
  const recordViewed = async (product) => {
    contact.customFields = contact.customFields || new Map();
    const viewedStr = contact.customFields.get('wp_viewed_products') || '';
    const viewedArr = viewedStr ? viewedStr.split(',') : [];
    if (!viewedArr.includes(product)) {
      viewedArr.push(product);
      contact.customFields.set('wp_viewed_products', viewedArr.join(','));
      await contact.save();
    }
  };

  // State Machine Init
  contact.customFields = contact.customFields || new Map();
  let state = contact.customFields.get('wp_state') || 'welcome';
  let lang = contact.customFields.get('wp_lang') || '';

  // Universal reset triggers
  if (lowerText === 'reset' || lowerText === 'hi' || lowerText === 'hello' || lowerText === 'ચાલુ કરો') {
    state = 'welcome';
    lang = '';
    contact.customFields.set('wp_state', 'welcome');
    contact.customFields.set('wp_lang', '');
    await contact.save();
  }

  // 1. WELCOME STATE (Language Selection)
  if (state === 'welcome') {
    if (lowerText === 'english' || lowerText === '🔘 english' || lowerText === 'lang_en') {
      lang = 'en';
      state = 'main_menu';
      contact.customFields.set('wp_lang', 'en');
      contact.customFields.set('wp_state', 'main_menu');
      await contact.save();
      return sendMainMenu(waAccount, token, contact, io, conversation);
    } 
    
    if (lowerText === 'ગુજરાતી' || lowerText === '🔘 ગુજરાતી' || lowerText === 'lang_gu') {
      lang = 'gu';
      state = 'main_menu';
      contact.customFields.set('wp_lang', 'gu');
      contact.customFields.set('wp_state', 'main_menu');
      await contact.save();
      return sendMainMenu(waAccount, token, contact, io, conversation);
    }

    // Otherwise, send interactive welcome buttons
    const welcomeBodyText = `Hello 👋\n\nWelcome to *Chab Chabba Chab Water Park* 🌊🎢\n\nThank you for contacting us.\n\nPlease select your preferred language.`;
    const buttons = [
      { id: 'lang_en', title: 'English' },
      { id: 'lang_gu', title: 'ગુજરાતી' }
    ];

    const result = await whatsapp.sendButtonMessage(waAccount.phoneNumberId, token, contact.phone, welcomeBodyText, buttons);
    await Message.create({
      userId,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'outbound',
      type: 'interactive',
      content: { text: welcomeBodyText, buttons },
      status: result.success ? 'sent' : 'failed',
      sentBy: 'bot'
    });
    return;
  }

  const isGujarati = lang === 'gu';

  // 2. STATE MACHINE BOOKING WIZARD STEPS
  if (state.startsWith('booking_')) {
    if (lowerText === 'cancel' || lowerText === 'રદ કરો') {
      contact.customFields.set('wp_state', 'main_menu');
      await contact.save();
      const cancelMsg = isGujarati 
        ? '❌ બુકિંગ પ્રક્રિયા રદ કરવામાં આવી છે.' 
        : '❌ Booking process has been cancelled.';
      await sendTextMessage(cancelMsg, waAccount, token, contact, io, conversation);
      return sendMainMenu(waAccount, token, contact, io, conversation);
    }

    if (state === 'booking_name') {
      contact.customFields.set('wp_name', text);
      contact.customFields.set('wp_state', 'booking_date');
      await contact.save();
      const promptDate = isGujarati
        ? '📅 કૃપા કરીને તમારી મુલાકાતની તારીખ દાખલ કરો (દા.ત. 15-06-2026):'
        : '📅 Please enter your Visit Date (e.g. 15-06-2026):';
      return sendTextMessage(promptDate, waAccount, token, contact, io, conversation);
    }

    if (state === 'booking_date') {
      contact.customFields.set('wp_date', text);
      contact.customFields.set('wp_state', 'booking_adults');
      await contact.save();
      const promptAdults = isGujarati
        ? '👨‍👩‍👦 કૃપા કરીને પુખ્ત વયના લોકોની સંખ્યા (Adults Count) દાખલ કરો:'
        : '👨‍👩‍👦 Please enter the Adults Count:';
      return sendTextMessage(promptAdults, waAccount, token, contact, io, conversation);
    }

    if (state === 'booking_adults') {
      contact.customFields.set('wp_adults', text);
      contact.customFields.set('wp_state', 'booking_children');
      await contact.save();
      const promptChildren = isGujarati
        ? '👶 કૃપા કરીને બાળકોની સંખ્યા (Children Count - 4 ફૂટથી નીચે) દાખલ કરો (બાળકો ન હોય તો 0 લખો):'
        : '👶 Please enter the Children Count (Below 4 Feet, write 0 if none):';
      return sendTextMessage(promptChildren, waAccount, token, contact, io, conversation);
    }

    if (state === 'booking_children') {
      contact.customFields.set('wp_children', text);
      contact.customFields.set('wp_state', 'booking_room');
      await contact.save();
      
      const promptRoom = isGujarati
        ? '🏨 શું તમારે રૂમ બુક કરવો છે? નીચેનામાંથી એક પસંદ કરો:\n\n1. Splashy Deluxe\n2. Marine Villa\n3. Luxury Cabana\n4. None (જો જરૂર ન હોય)'
        : '🏨 Do you require a Room? Select one of the options below:\n\n1. Splashy Deluxe\n2. Marine Villa\n3. Luxury Cabana\n4. None (If not required)';
      return sendTextMessage(promptRoom, waAccount, token, contact, io, conversation);
    }

    if (state === 'booking_room') {
      contact.customFields.set('wp_room', text);
      contact.customFields.set('wp_state', 'booking_requests');
      await contact.save();
      const promptRequests = isGujarati
        ? '✍️ શું તમારી કોઈ ખાસ વિનંતીઓ (Special Requests) છે? (ન હોય તો "None" લખો):'
        : '✍️ Any Special Requests? (Write "None" if none):';
      return sendTextMessage(promptRequests, waAccount, token, contact, io, conversation);
    }

    if (state === 'booking_requests') {
      contact.customFields.set('wp_requests', text);
      contact.customFields.set('wp_state', 'main_menu');
      await contact.save();

      // Collect variables for booking summary
      const wpName = contact.customFields.get('wp_name');
      const wpDate = contact.customFields.get('wp_date');
      const wpAdults = contact.customFields.get('wp_adults');
      const wpChildren = contact.customFields.get('wp_children');
      const wpRoom = contact.customFields.get('wp_room');
      const wpRequests = contact.customFields.get('wp_requests');

      // Generate dynamic welcome & pass assets
      await generateAndSendWaterParkImage(
        'booking_success',
        `Chab Chabba Chab Water Park welcome banner entry pass showing tickets for ${wpName} on ${wpDate}`,
        isGujarati ? '🎫 આપનું એન્ટ્રી પાસ અને બુકિંગ સ્વાગત બેનર' : '🎫 Your entry pass and booking welcome banner',
        waAccount, token, contact, io, conversation
      );

      // Create a Lead
      const leadDescription = `Water Park Tickets Booking:\n- Language: ${isGujarati ? 'Gujarati' : 'English'}\n- Adults: ${wpAdults}\n- Children: ${wpChildren}\n- Room Option: ${wpRoom}\n- Requests: ${wpRequests}`;
      await Lead.findOneAndUpdate(
        { userId, contactId: contact._id },
        {
          userId,
          contactId: contact._id,
          conversationId: conversation._id,
          name: wpName,
          phone: contact.phone,
          serviceRequired: 'Water Park Tickets Booking',
          projectDescription: leadDescription,
          notes: `Booking Status: Confirmed\nVisit Date: ${wpDate}\nViewed Products: ${contact.customFields.get('wp_viewed_products') || ''}`,
          status: 'new'
        },
        { upsert: true, new: true }
      );

      // Render Booking Summary
      const summaryText = isGujarati
        ? `✅ *બુકિંગ સફળતાપૂર્વક પૂર્ણ થયું છે!* 🎉\n\n📝 *બુકિંગ વિગતો:*\n• નામ: ${wpName}\n• મોબાઇલ નંબર: ${contact.phone}\n• મુલાકાત તારીખ: ${wpDate}\n• પુખ્ત: ${wpAdults}\n• બાળકો: ${wpChildren}\n• રૂમ: ${wpRoom}\n• ખાસ વિનંતીઓ: ${wpRequests}\n\nChab Chabba Chab Water Park માં આપનું હાર્દિક સ્વાગત છે! 🎢🌊`
        : `✅ *Booking Successfully Completed!* 🎉\n\n📝 *Booking Summary:*\n• Name: ${wpName}\n• Mobile Number: ${contact.phone}\n• Visit Date: ${wpDate}\n• Adults: ${wpAdults}\n• Children: ${wpChildren}\n• Room: ${wpRoom}\n• Special Requests: ${wpRequests}\n\nWe look forward to welcoming you to Chab Chabba Chab Water Park! 🎢🌊`;

      await sendTextMessage(summaryText, waAccount, token, contact, io, conversation);
      return sendMainMenu(waAccount, token, contact, io, conversation);
    }
  }

  // 3. MAIN MENU ROUTING (List triggers & inquiries)
  if (state === 'main_menu') {
    // Book Tickets Wizard Trigger
    if (lowerText.includes('book') || lowerText.includes('બુક') || lowerText.includes('ticket_book')) {
      contact.customFields.set('wp_state', 'booking_name');
      await contact.save();
      const promptName = isGujarati
        ? '📝 ચાલો ટિકિટ બુકિંગ શરૂ કરીએ!\n\n👨 કૃપા કરીને તમારું પૂરું નામ (Full Name) દાખલ કરો (રદ કરવા માટે "Cancel" લખો):'
        : '📝 Let\'s start your Tickets Booking!\n\n👨 Please enter your Full Name (or write "Cancel" to abort):';
      return sendTextMessage(promptName, waAccount, token, contact, io, conversation);
    }

    // Ticket Prices
    if (lowerText.includes('ticket') || lowerText.includes('ટિકિટ') || lowerText.includes('price')) {
      await recordViewed('ticket_prices');
      await generateAndSendWaterParkImage(
        'ticket_prices',
        'Realistic ticket counter at Chab Chabba Chab Water park with happy families entering under high resolution bright banner',
        isGujarati ? '🎟️ Chab Chabba Chab Water Park પ્રવેશદ્વાર અને ટિકિટ કાઉન્ટર' : '🎟️ Chab Chabba Chab Water Park Entrance & Ticket Counter',
        waAccount, token, contact, io, conversation
      );

      const ticketDetails = isGujarati
        ? `🎟️ *Chab Chabba Chab Water Park ટિકિટ દરો:*\n\n• પુખ્ત વયના (Adults): *₹800*\n• બાળકો (below 4 feet): *₹500*\n• વરિષ્ઠ નાગરિકો (Senior Citizen): *₹500*\n\n🎁 *લંચ શામેલ છે (Lunch Included)*`
        : `🎟️ *Chab Chabba Chab Water Park Ticket Prices:*\n\n• Adult: *₹800*\n• Child (Below 4 Feet): *₹500*\n• Senior Citizen: *₹500*\n\n🎁 *Lunch Included in Ticket*`;
      
      await sendTextMessage(ticketDetails, waAccount, token, contact, io, conversation);
      return sendMainMenu(waAccount, token, contact, io, conversation);
    }

    // Costume Charges
    if (lowerText.includes('costume') || lowerText.includes('કોસ્ચ્યુમ')) {
      await recordViewed('costumes');
      await generateAndSendWaterParkImage(
        'costumes',
        'Realistic water park costumes on display including ladies full,gents trunks and kids costumes next to a splashy pool background',
        isGujarati ? '🩱 Chab Chabba Chab કોસ્ચ્યુમ સંગ્રહ' : '🩱 Chab Chabba Chab Costumes Collection',
        waAccount, token, contact, io, conversation
      );

      const costumeDetails = isGujarati
        ? `🩱 *કોસ્ચ્યુમ ચાર્જિસ (ભાડા અને ડિપોઝિટ):*\n\n• *મહિલાઓ (Ladies Full Costume):*\n  ₹180 ભાડું + ₹120 ડિપોઝિટ\n• *મહિલાઓ (Ladies Half Costume):*\n  ₹120 ભાડું + ₹80 ડિપોઝિટ\n• *પુરુષો (Gents Costume):*\n  ₹110 ભાડું + ₹90 ડિપોઝિટ`
        : `🩱 *Costume Charges (Rent & Deposit):*\n\n• *Ladies Full Costume:*\n  ₹180 Rent + ₹120 Deposit\n• *Ladies Half Costume:*\n  ₹120 Rent + ₹80 Deposit\n• *Gents Costume:*\n  ₹110 Rent + ₹90 Deposit`;

      await sendTextMessage(costumeDetails, waAccount, token, contact, io, conversation);
      return sendMainMenu(waAccount, token, contact, io, conversation);
    }

    // Locker Charges
    if (lowerText.includes('locker') || lowerText.includes('લોકર') || lowerText.includes('changing')) {
      await recordViewed('lockers');
      await generateAndSendWaterParkImage(
        'lockers',
        'Clean large locker area secure changing room in a modern water park environment',
        isGujarati ? '🔐 સુરક્ષિત લોકર એરિયા અને ચેન્જિંગ રૂમ' : '🔐 Secure Locker Area & Changing Rooms',
        waAccount, token, contact, io, conversation
      );

      const lockerDetails = isGujarati
        ? `🔐 *લોકર રૂમ અને સુરક્ષા ચાર્જિસ:*\n\n• લોકર ભાડું: *₹50* (આખો દિવસ)\n• કી ડિપોઝિટ: *₹100* (બિલકુલ રિફંડપાત્ર)\n\n💼 તમારા કિંમતી સામાન માટે સીસીટીવી દ્વારા મોનિટર કરાયેલો અત્યંત સુરક્ષિત લોકર રૂમ અને ચેન્જિંગ રૂમ ઉપલબ્ધ છે.`
        : `🔐 *Locker Room & Safety Charges:*\n\n• Locker Rent: *₹50* (Full Day)\n• Key Deposit: *₹100* (Fully Refundable)\n\n💼 Highly secure lockers monitored via CCTV and changing rooms are available for your absolute comfort.`;

      await sendTextMessage(lockerDetails, waAccount, token, contact, io, conversation);
      return sendMainMenu(waAccount, token, contact, io, conversation);
    }

    // Room Details
    if (lowerText.includes('room') || lowerText.includes('રૂમ') || lowerText.includes('cabana') || lowerText.includes('stay')) {
      await recordViewed('rooms');
      await generateAndSendWaterParkImage(
        'rooms',
        'Sleek modern water park villas luxury cabana and stay rooms with private splash pool access',
        isGujarati ? '🏨 Chab Chabba Chab લક્ઝુરિયસ રહેવા માટેના રૂમ' : '🏨 Chab Chabba Chab Luxury Cabanas & Villas',
        waAccount, token, contact, io, conversation
      );

      const roomDetails = isGujarati
        ? `🏨 *Chab Chabba Chab રૂમ રહેવાની વિગતો:*\n\n• *Splashy Deluxe Room (AC):*\n  ₹1100 + ₹200 ડિપોઝિટ\n• *Marine Villa AC Room:*\n  ₹1800 + ₹600 ડિપોઝિટ\n• *Luxury Cabana:*\n  ₹2800 + ₹1000 ડિપોઝિટ`
        : `🏨 *Chab Chabba Chab Stay Rooms & Villa Details:*\n\n• *Splashy Deluxe Room (AC):*\n  ₹1100 + ₹200 Deposit\n• *Marine Villa AC Room:*\n  ₹1800 + ₹600 Deposit\n• *Luxury Cabana:*\n  ₹2800 + ₹1000 Deposit`;

      await sendTextMessage(roomDetails, waAccount, token, contact, io, conversation);
      return sendMainMenu(waAccount, token, contact, io, conversation);
    }

    // Food Information
    if (lowerText.includes('food') || lowerText.includes('ભોજન') || lowerText.includes('menu') || lowerText.includes('lunch') || lowerText.includes('ખાવા')) {
      await recordViewed('food');
      await generateAndSendWaterParkImage(
        'food',
        'Indian lunch platters with delicious Chole Puri, Pav Bhaji, Manchurian, Veg Biryani, Noodles and soft drinks',
        isGujarati ? '🍽️ ચટાકેદાર ભોજન મેનુ (ચોલે પુરી, પાવ ભાજી, મંચુરિયન, બિરયાની)' : '🍽️ Delicious Multi-Cuisine Lunch Menu',
        waAccount, token, contact, io, conversation
      );

      const foodDetails = isGujarati
        ? `🍽️ *ભોજન અને ફૂડ કોર્ટની માહિતી:*\n\n• *લંચ ટિકિટમાં બિલકુલ મફત શામેલ છે!*\n• તમે નીચેનામાંથી કોઈ એક મુખ્ય આઇટમ પસંદ કરી શકો છો:\n  1. ગરમા-ગરમ ચોલે પુરી\n  2. મસાલેદાર પાવ ભાજી\n  3. વેજ બિરયાની\n  4. ચાઇનીઝ મંચુરિયન અથવા નૂડલ્સ`
        : `🍽️ *Food Court & Dining Information:*\n\n• *Delicious Lunch is completely INCLUDED in your Ticket!*\n• You can choose any ONE of the following items:\n  1. Hot Chole Puri\n  2. Spicy Pav Bhaji\n  3. Authentic Veg Biryani\n  4. Chinese Manchurian or Noodles`;

      await sendTextMessage(foodDetails, waAccount, token, contact, io, conversation);
      return sendMainMenu(waAccount, token, contact, io, conversation);
    }

    // Water Park Gallery
    if (lowerText.includes('gallery') || lowerText.includes('ગેલેરી') || lowerText.includes('photo')) {
      await recordViewed('gallery');
      await generateAndSendWaterParkImage(
        'gallery_slides',
        'Thrilling giant water slide, beautiful wave pool, energetic rain dance at Chab Chabba Chab water park with splashy waves',
        isGujarati ? '📸 ગેલેરી: વિશાળ વોટર સ્લાઇડ્સ, રેન ડાન્સ અને વેવ પૂલ' : '📸 Gallery: Giant Water Slides, Rain Dance, and Wave Pool',
        waAccount, token, contact, io, conversation
      );

      const galleryText = isGujarati
        ? `📸 *વોટર પાર્ક ગેલેરી:*\n\nChab Chabba Chab માં રોમાંચક વોટર રાઈડ્સ, મજેદાર રેન ડાન્સ, વેવ પૂલ અને ઘણું બધું એન્જોય કરો!`
        : `📸 *Water Park Gallery:*\n\nEnjoy exciting water rides, family attractions, rain dance, wave pools, and much more at Chab Chabba Chab!`;

      await sendTextMessage(galleryText, waAccount, token, contact, io, conversation);
      return sendMainMenu(waAccount, token, contact, io, conversation);
    }

    // Water Rides
    if (lowerText.includes('ride') || lowerText.includes('રાઈડ')) {
      await recordViewed('rides');
      await generateAndSendWaterParkImage(
        'rides',
        'Giant water slide, spiral tube slide, kids splash zone at a water park with happy kids playing',
        isGujarati ? '🎢 Chab Chabba Chab રોમાંચક વોટર રાઈડ્સ' : '🎢 Chab Chabba Chab Extreme Water Rides',
        waAccount, token, contact, io, conversation
      );

      const rideText = isGujarati
        ? `🎢 *Chab Chabba Chab મુખ્ય વોટર રાઈડ્સ:*\n\n1. *વેવ પૂલ (Wave Pool):* સમુદ્ર જેવો મોજાનો આનંદ.\n2. *રેન ડાન્સ (Rain Dance Area):* લાઇવ ડીજે સંગીત સાથે વરસાદનો નૃત્ય.\n3. *ઝિગઝેગ સ્લાઇડ (Spiral Slide):* અત્યંત રોમાંચક ગોળ-ગોળ સ્લાઇડ્સ.\n4. *કિડ્સ ઝોન (Kids Splash Zone):* બાળકો માટે નાના પૂલ અને ફુવારા.`
        : `🎢 *Chab Chabba Chab Main Water Rides:*\n\n1. *Wave Pool:* Experience realistic ocean-like waves.\n2. *Rain Dance:* Groove to live DJ music under continuous rain showers.\n3. *Spiral Slide:* Fast-paced, thrilling spiral tube slides.\n4. *Kids Splash Zone:* Mini pools and splash fountains custom designed for toddlers.`;

      await sendTextMessage(rideText, waAccount, token, contact, io, conversation);
      return sendMainMenu(waAccount, token, contact, io, conversation);
    }

    // Park Timing
    if (lowerText.includes('time') || lowerText.includes('સમય') || lowerText.includes('timing')) {
      await recordViewed('timings');
      await generateAndSendWaterParkImage(
        'timings',
        'Daytime high resolution beautiful view of Chab Chabba Chab water park with clear blue sky and sparkling pools',
        isGujarati ? '⏰ વોટર પાર્ક ખુલવાનો અને બંધ થવાનો સમય' : '⏰ Water Park Timings & Day Schedule',
        waAccount, token, contact, io, conversation
      );

      const timingText = isGujarati
        ? `⏰ *વોટર પાર્ક ખુલ્લો રહેવાનો સમય:*\n\n• સવારે *10:00 AM* થી સાંજે *6:00 PM*\n• આખું અઠવાડિયું ખુલ્લું (તમામ શનિ-રવિ અને રજાઓ સહિત)\n\n📌 મોડી રાઈડ્સ બપોરે 5:30 વાગ્યે બંધ થઈ જાય છે.`
        : `⏰ *Water Park Daily Operating Hours:*\n\n• Open Daily: *10:00 AM* to *6:00 PM*\n• Open 7 days a week (including all weekends and public holidays)\n\n📌 Water rides and slides shut down at 5:30 PM for scheduled safety inspections.`;

      await sendTextMessage(timingText, waAccount, token, contact, io, conversation);
      return sendMainMenu(waAccount, token, contact, io, conversation);
    }



    // Talk To Executive (Human Handoff)
    if (lowerText.includes('talk') || lowerText.includes('વાત') || lowerText.includes('human') || lowerText.includes('executive')) {
      await recordViewed('human_handoff');
      await generateAndSendWaterParkImage(
        'executive',
        'Warm friendly customer service executive representative smiling ready to help in water park front office',
        isGujarati ? '📞 ગ્રાહક સેવા એક્ઝિક્યુટિવ સંપર્ક' : '📞 Customer Service Executive Representative',
        waAccount, token, contact, io, conversation
      );

      // Save a Lead in system
      await Lead.findOneAndUpdate(
        { userId, contactId: contact._id },
        {
          userId,
          contactId: contact._id,
          conversationId: conversation._id,
          name: contact.name || 'WhatsApp Customer',
          phone: contact.phone,
          serviceRequired: 'Human Executive Support',
          projectDescription: 'Customer requested human takeover support for water park questions.',
          notes: 'Human Handoff Triggered. Booking Status: Waiting',
          status: 'new'
        },
        { upsert: true, new: true }
      );

      // Takeover Conversation
      conversation.status = 'human';
      conversation.lock_status = true;
      conversation.assignedAgent = userId; // Assign automatically to the account owner
      conversation.takeover_status = 'human';
      await conversation.save();

      const executiveMsg = isGujarati
        ? '🤝 *અમારા એક્ઝિક્યુટિવ જોડાય રહ્યા છે!* ⚡\nઅમારા ટીમના સભ્ય ટૂંક સમયમાં જ તમારી સાથે અહીં ચેટમાં વાત કરશે. કૃપા કરીને થોડીવાર રાહ જુઓ.'
        : '🤝 *Connecting to a Live Executive!* ⚡\nOne of our team members is reviewing your inquiry and will chat with you here shortly. Please wait.';

      await sendTextMessage(executiveMsg, waAccount, token, contact, io, conversation);

      if (io) {
        io.to(`user_${userId}`).emit('conversation_assigned', { conversationId: conversation._id });
      }
      return;
    }

    // School / College / Group / Corporate Event inquiries in Conversational AI
    if (lowerText.includes('school') || lowerText.includes('college') || lowerText.includes('corporate') || lowerText.includes('group') || lowerText.includes('package')) {
      return runConversationalAI(text, waAccount, token, contact, io, conversation);
    }

    // If nothing else matches, run conversational AI executive
    return runConversationalAI(text, waAccount, token, contact, io, conversation);
  }
}

/**
 * Renders and sends the Main Menu options as a List.
 */
async function sendMainMenu(waAccount, token, contact, io, conversation) {
  const userId = waAccount.userId;
  const isGujarati = contact.customFields?.get('wp_lang') === 'gu';

  const menuTitle = isGujarati 
    ? '🎡 *Chab Chabba Chab મુખ્ય મેનુ*' 
    : '🎡 *Chab Chabba Chab Main Menu*';
  
  const menuBody = isGujarati
    ? 'કૃપા કરીને નીચે આપેલા બટન પર ક્લિક કરીને અમારી સુવિધાઓ, રાઇડ્સ, કોસ્ચ્યુમ ચાર્જ અથવા ટિકિટ બુકિંગની બધી માહિતી મેળવો:'
    : 'Please click the button below to explore our rides, costume rentals, stay villa details, or easily book your entry passes:';

  const sections = [
    {
      title: isGujarati ? 'માહિતી સંગ્રહ' : 'Park Details',
      rows: [
        { id: 'menu_tickets', title: isGujarati ? 'ટિકિટના દરો' : 'Ticket Prices', description: isGujarati ? '₹800 પુખ્ત / ₹500 બાળક' : '₹800 Adult / ₹500 Child' },
        { id: 'menu_gallery', title: isGujarati ? 'વોટર પાર્ક ગેલેરી' : 'Water Park Gallery', description: isGujarati ? 'તમામ આકર્ષક ફોટા જુઓ' : 'View exciting park photos' },
        { id: 'menu_rides', title: isGujarati ? 'વોટર રાઈડ્સ' : 'Water Rides', description: isGujarati ? 'તમામ રોમાંચક સ્લાઇડ્સ' : 'View extreme water slides' },
        { id: 'menu_costumes', title: isGujarati ? 'કોસ્ચ્યુમ ચાર્જિસ' : 'Costume Charges', description: isGujarati ? 'ભાડા અને ડિપોઝિટના દરો' : 'View costume rental rates' },
        { id: 'menu_lockers', title: isGujarati ? 'લોકર ચાર્જિસ' : 'Locker Charges', description: isGujarati ? 'લોકર રૂમ ભાડા પત્રક' : 'Secure locker room rates' },
        { id: 'menu_rooms', title: isGujarati ? 'રૂમની વિગતો' : 'Room Details', description: isGujarati ? 'Splashy Deluxe અને વિલા' : 'AC Deluxe Rooms & Villas' },
        { id: 'menu_food', title: isGujarati ? 'ભોજનની માહિતી' : 'Food Information', description: isGujarati ? 'લંચ મેનુ વિગતો' : 'Multi-cuisine lunch menu' },
        { id: 'menu_timing', title: isGujarati ? 'પાર્કનો સમય' : 'Park Timing', description: isGujarati ? 'ખુલવા અને બંધ થવાનો સમય' : '10:00 AM to 6:00 PM daily' }
      ]
    },
    {
      title: isGujarati ? 'ઝડપી પ્રક્રિયા' : 'Actions',
      rows: [
        { id: 'menu_book', title: isGujarati ? 'ટિકિટ બુક કરો' : 'Book Tickets', description: isGujarati ? 'ઝડપી ઓનલાઇન બુકિંગ' : 'Start interactive booking' },
        { id: 'menu_executive', title: isGujarati ? 'એક્ઝિક્યુટિવ સાથે વાત કરો' : 'Talk To Executive', description: isGujarati ? 'સીધા અમારા સ્ટાફ સાથે ચેટ કરો' : 'Human customer support takeover' }
      ]
    }
  ];

  const result = await whatsapp.sendListMessage(
    waAccount.phoneNumberId,
    token,
    contact.phone,
    menuBody,
    sections,
    menuTitle,
    isGujarati ? 'Chab Chabba Chab Water Park 🌊' : 'Chab Chabba Chab Water Park 🌊'
  );

  await Message.create({
    userId,
    conversationId: conversation._id,
    contactId: contact._id,
    direction: 'outbound',
    type: 'interactive',
    content: { text: menuBody, sections },
    status: result.success ? 'sent' : 'failed',
    sentBy: 'bot'
  });
}

/**
 * Natural Language AI Conversational executive with dynamic DALL-E prompt injections.
 */
async function runConversationalAI(userText, waAccount, token, contact, io, conversation) {
  const userId = waAccount.userId;
  const isGujarati = contact.customFields?.get('wp_lang') === 'gu';

  try {
    const historyDocs = await Message.find({ userId, conversationId: conversation._id })
      .sort({ timestamp: -1 })
      .limit(8)
      .lean();
    historyDocs.reverse();

    const User = require('../models/User');
    const Organization = require('../models/Organization');
    const user = await User.findById(userId);
    const org = user ? await Organization.findById(user.organizationId).lean() : null;

    const { decryptField } = require('./encryption');
    const customOpenAIKey = org?.aiConfig?.openaiApiKey ? decryptField(org.aiConfig.openaiApiKey) : null;
    const finalOpenAIKey = (customOpenAIKey && customOpenAIKey.trim() !== '') ? customOpenAIKey.trim() : process.env.OPENAI_API_KEY;

    if (!finalOpenAIKey || finalOpenAIKey.includes('your_openai_api_key')) {
      throw new Error('OpenAI key missing');
    }

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: finalOpenAIKey });

    const systemPrompt = `You are a professional, enthusiastic water park sales executive for "Chab Chabba Chab Water Park".
You speak in ${isGujarati ? 'Gujarati' : 'English'}.
You help customers with inquiries about water rides, tickets, costumes, food, lockers, villas, stay rooms, corporate bookings, packages, and park details.

RULES:
1. Always behave politely and professionally like a front office executive.
2. If the user asks about ANY attraction, ride, food item, костюмы, corporate event, villa room, or group activity, you MUST automatically return a JSON response with:
   - "imagePrompt": a detailed, vivid prompt (in English) describing a beautiful promotional photo of that attraction, ride, food, costume, or cabana.
   - "text": your friendly customer reply details (in ${isGujarati ? 'Gujarati' : 'English'}) to send to them.
3. If they ask about standard details without any specific visual, just return:
   - "text": your friendly customer reply details.
4. Keep the output strictly in valid JSON format:
   {
      "imagePrompt": "vivid prompt describing the visual, or empty if none",
      "text": "friendly executive response"
   }
Never include markdown wrapper code blocks around JSON in the response. Only send the raw JSON string.

PARK DETAILS:
- Ticket: Adult ₹800, Child below 4ft ₹500, Senior ₹500. Free multi-cuisine lunch included.
- Rides: Wave pool, DJ Rain dance, Zigzag spiral slides, kids zones.
- Costume: Ladies full (180 rent + 120 deposit), half (120+80), Gents trunk (110+90).
- Stay Rooms: Splashy Deluxe AC (1100 + 200), Marine AC (1800+600), Luxury Cabana (2800+1000).
- Location: Chab Chabba Chab Water Park, Surat, Gujarat.`;

    const messages = [{ role: 'system', content: systemPrompt }];
    for (const msg of historyDocs) {
      messages.push({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content?.text || '[image payload]',
      });
    }
    messages.push({ role: 'user', content: userText });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      temperature: 0.7,
    });

    const reply = (completion.choices[0]?.message?.content || '').trim();
    let replyObj = { text: reply };

    try {
      replyObj = JSON.parse(reply.replace(/```json/g, '').replace(/```/g, ''));
    } catch (_) {}

    if (replyObj.imagePrompt && replyObj.imagePrompt.trim()) {
      // Dynamic AI image generation
      await generateAndSendWaterParkImage(
        replyObj.imagePrompt.slice(0, 30),
        replyObj.imagePrompt,
        isGujarati ? '📸 Chab Chabba Chab Water Park અદ્ભુત દ્રશ્ય' : '📸 Chab Chabba Chab Water Park Visual',
        waAccount, token, contact, io, conversation
      );
    }

    if (replyObj.text) {
      await sendTextMessage(replyObj.text, waAccount, token, contact, io, conversation);
    }
  } catch (err) {
    logger.error('[WP AI] Conversational error:', err.message);
    const errText = isGujarati
      ? 'હું અત્યારે થોડી મુશ્કેલીમાં છું. કૃપા કરીને થોડીવાર પછી ફરી પ્રયાસ કરો અથવા સીધા એક્ઝિક્યુટિવ સાથે જોડાવા "Executive" લખો.'
      : 'I\'m having trouble processing your query right now. Write "Executive" to talk to a team member.';
    await sendTextMessage(errText, waAccount, token, contact, io, conversation);
  }
}

module.exports = {
  processIncomingMessage,
  sendMainMenu
};

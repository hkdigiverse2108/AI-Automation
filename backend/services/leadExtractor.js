const env = require('../config/env');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Clean up and parse JSON response from LLM
 */
function cleanAndParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    // Attempt to extract JSON block using regex
    const jsonMatch = str.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (err) {}
    }
    throw new Error('Failed to parse JSON response from LLM: ' + str);
  }
}

/**
 * Asynchronously extract and store lead information from conversation messages
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 */
async function extractLeadInfo(userId, conversationId) {
  try {
    logger.info(`Starting lead extraction for conversation: ${conversationId}`);

    // 1. Fetch contact & messages
    const messages = await Message.find({ userId, conversationId })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    if (!messages.length) {
      logger.info('No messages found for conversation');
      return;
    }

    // Get the first message's contactId
    const contactId = messages[0].contactId;
    const contact = await Contact.findById(contactId);
    if (!contact) {
      logger.warn(`Contact not found for ID: ${contactId}`);
      return;
    }

    // Sort chronologically
    messages.reverse();

    // 2. Fetch existing lead if any. If it doesn't exist, create it immediately!
    let existingLead = await Lead.findOne({ userId, contactId });
    if (!existingLead) {
      // Check organization plan limits for leads
      const User = require('../models/User');
      const Organization = require('../models/Organization');
      const adminUser = await User.findById(userId);
      const org = adminUser ? await Organization.findById(adminUser.organizationId) : null;
      
      let allowed = true;
      if (org) {
        const totalLeads = await Lead.countDocuments({ userId });
        if (totalLeads >= org.maxLeads) {
          logger.warn(`Max leads limit of ${org.maxLeads} reached for organization ${org.name}. Skipping lead creation.`);
          allowed = false;
        }
      }

      if (allowed) {
        existingLead = await Lead.create({
          userId,
          contactId,
          conversationId,
          name: contact.name || '',
          phone: contact.phone || '',
          email: contact.email || '',
          status: 'new',
          conversationDateTime: new Date()
        });
        logger.info(`Direct lead captured and saved to dashboard for contact: ${contact.phone}`);
      }
    } else {
      existingLead.conversationId = conversationId;
      existingLead.conversationDateTime = new Date();
      await existingLead.save();
    }

    // 3. Compile transcript
    const transcriptText = messages.map(msg => {
      const role = msg.direction === 'inbound' ? 'Customer' : 'Assistant';
      const text = msg.content?.text || '[Media/Attachment]';
      return `${role}: ${text}`;
    }).join('\n');

    // 4. Initialize LLM Client from Database Organization Config
    const User = require('../models/User');
    const Organization = require('../models/Organization');
    const { decryptField } = require('./encryption');

    const user = await User.findById(userId);
    const org = user ? await Organization.findById(user.organizationId) : null;
    const customGrokKey = org?.aiConfig?.grokApiKey ? decryptField(org.aiConfig.grokApiKey) : null;
    const finalGrokKey = (customGrokKey && customGrokKey.trim() !== '') ? customGrokKey.trim() : null;

    let clientOptions = {};
    let modelName = 'grok-2';

    if (finalGrokKey) {
      const isGroq = finalGrokKey.startsWith('gsk_');
      if (isGroq) {
        clientOptions = {
          apiKey: finalGrokKey,
          baseURL: 'https://api.groq.com/openai/v1'
        };
        modelName = 'llama-3.1-8b-instant';
      } else {
        clientOptions = {
          apiKey: finalGrokKey,
          baseURL: 'https://api.x.ai/v1'
        };
        modelName = 'grok-2';
      }
    } else {
      logger.warn(`AI extractor cannot run: Grok API key not configured for organization ${org?.name || 'unknown'}`);
      return;
    }

    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI(clientOptions);

    // Setup existing values context
    const currentValues = existingLead ? {
      name: existingLead.name || '',
      companyName: existingLead.companyName || '',
      phone: existingLead.phone || contact.phone || '',
      email: existingLead.email || contact.email || '',
      serviceRequired: existingLead.serviceRequired || '',
      projectDescription: existingLead.projectDescription || '',
      budget: existingLead.budget || '',
      numericBudget: existingLead.numericBudget || 0,
      timeline: existingLead.timeline || '',
      preferredTechnology: existingLead.preferredTechnology || '',
      specialRequirements: existingLead.specialRequirements || '',
      status: existingLead.status || 'new',
      aiSummary: existingLead.aiSummary || ''
    } : {
      name: contact.name || '',
      companyName: '',
      phone: contact.phone || '',
      email: contact.email || '',
      serviceRequired: '',
      projectDescription: '',
      budget: '',
      numericBudget: 0,
      timeline: '',
      preferredTechnology: '',
      specialRequirements: '',
      status: 'new',
      aiSummary: ''
    };

    const systemPrompt = `You are an expert CRM lead extraction assistant.
Analyze the following conversation transcript between a Customer and an Assistant.
Extract all key business details and output them strictly as a valid JSON object matching the schema below.
Only update fields when new information is clearly stated in the transcript.
Keep the existing values if nothing new contradicts them or is added.
Do not invent or assume values.

Here are the current values:
${JSON.stringify(currentValues, null, 2)}

Transcript:
${transcriptText}

Rules for Fields:
- "name": Customer's full name.
- "companyName": Name of their business/company.
- "phone": Customer's phone number.
- "email": Contact email address.
- "serviceRequired": Specific service (e.g. "Website", "Mobile App", "E-commerce Store", "CRM", "AI Solution").
- "projectDescription": Brief details of the requested project.
- "budget": Raw text budget value matching the currency mentioned (e.g. "₹10,000", "$500", etc.).
- "numericBudget": Integer representation of the budget for sorting (e.g. 10000). Set to 0 if not specified.
- "timeline": Timeline / delivery requirement (e.g. "2 Weeks", "1 Month", "Immediate").
- "preferredTechnology": Tech stack mentioned (e.g. React, Node.js, PHP, WordPress).
- "specialRequirements": Any special requests or integrations.
- "status": One of: 'new', 'qualified', 'proposal_sent', 'closed'. Maintain the current status, but if it is 'new' and you have extracted clear project requirements (serviceRequired) along with budget or timeline, upgrade status to 'qualified'.
- "aiSummary": A concise summary paragraph of the client requirements and status.

You MUST respond ONLY with a valid raw JSON object. Do not wrap it in markdown block quotes (e.g. do not write \`\`\`json). Do not output any other text.`;

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: systemPrompt }],
      max_tokens: 800,
      temperature: 0.2, // low temperature for precise extraction
    });

    const reply = completion.choices[0]?.message?.content || '';
    const extractedData = cleanAndParseJSON(reply);

    logger.info(`Extracted lead details successfully for contact ${contact.phone}: ${JSON.stringify(extractedData)}`);

    // Check organization plan limits for leads
    const User = require('../models/User');
    const Organization = require('../models/Organization');
    const adminUser = await User.findById(userId);
    const org = adminUser ? await Organization.findById(adminUser.organizationId) : null;
    if (!existingLead && org) {
      const totalLeads = await Lead.countDocuments({ userId });
      if (totalLeads >= org.maxLeads) {
        logger.warn(`Max leads limit of ${org.maxLeads} reached for organization ${org.name}. Skipping lead creation.`);
        return;
      }
    }

    // 5. Save or update Lead in Database
    const updatedLead = await Lead.findOneAndUpdate(
      { userId, contactId },
      {
        userId,
        contactId,
        conversationId,
        name: extractedData.name || currentValues.name,
        companyName: extractedData.companyName || currentValues.companyName,
        phone: extractedData.phone || currentValues.phone,
        email: (extractedData.email || currentValues.email || '').toLowerCase().trim(),
        serviceRequired: extractedData.serviceRequired || currentValues.serviceRequired,
        projectDescription: extractedData.projectDescription || currentValues.projectDescription,
        budget: extractedData.budget || currentValues.budget,
        numericBudget: Number(extractedData.numericBudget) || currentValues.numericBudget,
        timeline: extractedData.timeline || currentValues.timeline,
        preferredTechnology: extractedData.preferredTechnology || currentValues.preferredTechnology,
        specialRequirements: extractedData.specialRequirements || currentValues.specialRequirements,
        status: extractedData.status || currentValues.status,
        aiSummary: extractedData.aiSummary || currentValues.aiSummary,
        notes: existingLead ? existingLead.notes : '', // Keep manual notes
        conversationDateTime: new Date()
      },
      { upsert: true, new: true }
    );

    // 6. Sync contact details if they were empty
    let contactNeedsSave = false;
    if (updatedLead.name && !contact.name) {
      contact.name = updatedLead.name;
      contactNeedsSave = true;
    }
    if (updatedLead.email && !contact.email) {
      contact.email = updatedLead.email;
      contactNeedsSave = true;
    }
    if (contactNeedsSave) {
      await contact.save();
    }

    logger.info(`Lead record saved successfully: ${updatedLead._id}`);
  } catch (error) {
    logger.error('extractLeadInfo error:', error.message);
  }
}

module.exports = { extractLeadInfo };

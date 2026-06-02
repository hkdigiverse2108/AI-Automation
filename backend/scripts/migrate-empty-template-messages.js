const { connectDB, disconnectDB } = require('../config/db');
const Message = require('../models/Message');
const Template = require('../models/Template');

async function run() {
  try {
    await connectDB();
    console.log('Scanning for template-type messages with empty text fields...');

    const emptyMessages = await Message.find({
      type: 'template',
      $or: [
        { 'content.text': { $exists: false } },
        { 'content.text': '' },
        { 'content.text': null }
      ]
    });

    console.log(`Found ${emptyMessages.length} empty template messages in history.`);
    let migratedCount = 0;

    for (const msg of emptyMessages) {
      const templateName = msg.content?.template?.name;
      const variables = msg.content?.template?.variables || [];
      if (!templateName) {
        // Safe fallback
        msg.content.text = '[Template Message]';
        msg.markModified('content');
        await msg.save();
        migratedCount++;
        continue;
      }

      const tmpl = await Template.findOne({ userId: msg.userId, name: templateName });
      let templateText = '';

      if (tmpl) {
        const bodyComp = tmpl.components?.find(c => c.type === 'BODY' || c.type?.toLowerCase() === 'body');
        if (bodyComp && bodyComp.text) {
          templateText = bodyComp.text;
          if (variables.length > 0) {
            templateText = templateText.replace(/\{\{([0-9]+)\}\}/g, (_, num) => {
              const idx = parseInt(num, 10) - 1;
              return variables[idx] !== undefined ? variables[idx] : `{{${num}}}`;
            });
          }
        }
      }

      msg.content.text = templateText || `[Template: ${templateName}]`;
      msg.markModified('content');
      await msg.save();
      migratedCount++;
      console.log(`Migrated message ${msg._id} (Template: ${templateName}) -> text: "${msg.content.text.substring(0, 60)}..."`);
    }

    console.log(`\nSuccessfully backfilled/migrated ${migratedCount} template messages!`);
    await disconnectDB();
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

run();

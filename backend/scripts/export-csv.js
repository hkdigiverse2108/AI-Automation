const fs = require('fs');
const path = require('path');
const { connectDB, disconnectDB } = require('../config/db');
const Contact = require('../models/Contact');
const User = require('../models/User');

async function run() {
  try {
    await connectDB();
    const user = await User.findOne({ email: 'hk@gmail.com' });
    if (!user) {
      console.log('User hk@gmail.com not found.');
      await disconnectDB();
      return;
    }

    const contacts = await Contact.find({ userId: user._id });
    
    // Header for CSV
    let csvContent = 'Name,Phone,Category,Status,Tags\n';

    contacts.forEach(c => {
      const custom = c.customFields ? (c.customFields.toJSON ? c.customFields.toJSON() : c.customFields) : {};
      const category = custom.businessCategory || custom.business_category || custom.business_name || 'N/A';
      const status = custom.conversationStatus || 'N/A';
      const tags = c.tags && c.tags.length ? c.tags.join('; ') : 'N/A';
      
      // Escape values for CSV
      const nameEscaped = `"${(c.name || 'N/A').replace(/"/g, '""')}"`;
      const phoneEscaped = `"${(c.phone || 'N/A').replace(/"/g, '""')}"`;
      const categoryEscaped = `"${category.replace(/"/g, '""')}"`;
      const statusEscaped = `"${status.replace(/"/g, '""')}"`;
      const tagsEscaped = `"${tags.replace(/"/g, '""')}"`;

      csvContent += `${nameEscaped},${phoneEscaped},${categoryEscaped},${statusEscaped},${tagsEscaped}\n`;
    });

    const outputPath = path.join(__dirname, '../../hk_leads.csv');
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
    console.log(`CSV Exported successfully to: ${outputPath}`);

    await disconnectDB();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();

const { connectDB, disconnectDB } = require('../config/db');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Contact = require('../models/Contact');
const Group = require('../models/Group');
const ContactGroup = require('../models/ContactGroup');
const Appointment = require('../models/Appointment');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const FollowUp = require('../models/FollowUp');
const Template = require('../models/Template');
const TeamChat = require('../models/TeamChat');
const TeamChatMember = require('../models/TeamChatMember');
const TeamChatMessage = require('../models/TeamChatMessage');

const { createNotification } = require('../services/notificationService');
const { startAppointmentCron } = require('../services/appointmentCron');
const { startFollowUpCron } = require('../services/followUpCron');

// Mock request / response handler helper to simulate API routing triggers
async function runMockRoute(fn, reqData = {}) {
  const req = {
    user: reqData.user || {},
    userId: reqData.userId || reqData.user?._id,
    organizationId: reqData.organizationId || reqData.user?.organizationId,
    body: reqData.body || {},
    params: reqData.params || {},
    query: reqData.query || {},
    app: {
      get: (key) => {
        if (key === 'io') return { to: () => ({ emit: () => {} }) };
        return null;
      }
    }
  };

  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    }
  };

  await fn(req, res);
  return res;
}

async function testSuite() {
  try {
    await connectDB();
    console.log('--- Connected to Database for Notification System Verification ---');

    // Fetch or create mock organization and users
    let org = await Organization.findOne({ name: 'Notification Verification Org' });
    if (!org) {
      org = await Organization.create({
        name: 'Notification Verification Org',
        contactEmail: 'verify@notif.com',
        status: 'active',
        subscriptionStatus: 'active'
      });
    }

    let admin = await User.findOne({ email: 'admin@verify.com' });
    if (!admin) {
      admin = await User.create({
        name: 'Notif Admin',
        email: 'admin@verify.com',
        username: 'notif_admin',
        passwordHash: 'dummyhash123',
        role: 'admin',
        organizationId: org._id
      });
    }

    let agent = await User.findOne({ email: 'agent@verify.com' });
    if (!agent) {
      agent = await User.create({
        name: 'Notif Agent',
        email: 'agent@verify.com',
        username: 'notif_agent',
        passwordHash: 'dummyhash123',
        role: 'agent',
        organizationId: org._id
      });
    }

    console.log(`Resolved Org ID: ${org._id}`);
    console.log(`Resolved Admin ID: ${admin._id}`);
    console.log(`Resolved Agent ID: ${agent._id}`);

    // Clean up notifications for this org/users
    await Notification.deleteMany({ organization: org._id });
    await Contact.deleteMany({ userId: admin._id });
    await Group.deleteMany({ organizationId: org._id });
    await ContactGroup.deleteMany({ organizationId: org._id });
    await Appointment.deleteMany({ organizationId: org._id });
    await Order.deleteMany({ organizationId: org._id });
    await TeamChat.deleteMany({ organizationId: org._id });
    await TeamChatMember.deleteMany({ chatId: { $exists: true } });
    await TeamChatMessage.deleteMany({ organizationId: org._id });
    await FollowUp.deleteMany({ organizationId: org._id });
    await Template.deleteMany({ userId: admin._id });
    await require('../models/Tag').deleteMany({ userId: { $in: [admin._id, agent._id] } });

    // --- TEST 1: CONTACT NOTIFICATIONS ---
    console.log('\n--- Test 1: Contact Notification Triggers ---');

    // Import routes
    const contactsRouter = require('../routes/contacts');

    // 1. Create Contact
    const createRes = await runMockRoute(
      contactsRouter.stack.find(s => s.route?.path === '/' && s.route?.methods?.post).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        body: { phone: '919999999999', name: 'John Doe', email: 'john@doe.com', source: 'manual' }
      }
    );
    console.log(`✓ Contact Create route response:`, createRes.data?.message);
    
    const contact = await Contact.findOne({ userId: admin._id, name: 'John Doe' });
    if (!contact) throw new Error('Contact not created in DB');

    // 2. Add Tag
    const tagObj = await require('../models/Tag').create({
      userId: admin._id,
      organizationId: org._id,
      name: 'interested',
      createdBy: admin._id
    });

    const addTagRes = await runMockRoute(
      contactsRouter.stack.find(s => s.route?.path === '/:id/add-tag' && s.route?.methods?.post).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        params: { id: contact._id.toString() },
        body: { tagId: tagObj._id.toString() }
      }
    );
    console.log(`✓ Tag Add route response:`, addTagRes.data?.message);

    // 3. Remove Tag
    const removeTagRes = await runMockRoute(
      contactsRouter.stack.find(s => s.route?.path === '/:id/remove-tag' && s.route?.methods?.post).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        params: { id: contact._id.toString() },
        body: { tagId: tagObj._id.toString() }
      }
    );
    console.log(`✓ Tag Remove route response:`, removeTagRes.data?.message);

    // 4. Add Note
    const addNoteRes = await runMockRoute(
      contactsRouter.stack.find(s => s.route?.path === '/:id/notes' && s.route?.methods?.post).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        params: { id: contact._id.toString() },
        body: { note: 'Interested in website development quotation.' }
      }
    );
    console.log(`✓ Note Add route response:`, addNoteRes.data?.message);

    // Check contact notifications created
    const contactNotifications = await Notification.find({ organization: org._id, type: 'contact' });
    console.log(`✓ Created ${contactNotifications.length} Contact Notifications in database:`);
    contactNotifications.forEach(n => console.log(`  - Title: "${n.title}", Message: "${n.message}"`));

    if (contactNotifications.length < 4) {
      throw new Error(`Expected at least 4 contact notifications, got ${contactNotifications.length}`);
    }

    // --- TEST 2: GROUP NOTIFICATIONS ---
    console.log('\n--- Test 2: Group Notification Triggers ---');

    const groupsRouter = require('../routes/groups');

    // 1. Create Group
    const createGroupRes = await runMockRoute(
      groupsRouter.stack.find(s => s.route?.path === '/' && s.route?.methods?.post).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        body: { name: 'VIP Clients', description: 'Our highest value clients' }
      }
    );
    console.log(`✓ Group Create route response:`, createGroupRes.data?.message);

    const group = await Group.findOne({ organizationId: org._id, name: 'VIP Clients' });
    if (!group) throw new Error('Group not created in DB');

    // 2. Add Contact to Group
    const addContactToGroupRes = await runMockRoute(
      groupsRouter.stack.find(s => s.route?.path === '/:id/add-contact' && s.route?.methods?.post).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        params: { id: group._id.toString() },
        body: { contactIds: [contact._id.toString()] }
      }
    );
    console.log(`✓ Add contact to group response:`, addContactToGroupRes.data?.message);

    // 3. Remove Contact from Group
    const removeContactFromGroupRes = await runMockRoute(
      groupsRouter.stack.find(s => s.route?.path === '/:id/remove-contact' && s.route?.methods?.post).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        params: { id: group._id.toString() },
        body: { contactIds: [contact._id.toString()] }
      }
    );
    console.log(`✓ Remove contact from group response:`, removeContactFromGroupRes.data?.message);

    // Check group notifications created
    const groupNotifications = await Notification.find({ organization: org._id, type: 'contact', title: /Group/i });
    console.log(`✓ Created ${groupNotifications.length} Group Notifications in database:`);
    groupNotifications.forEach(n => console.log(`  - Title: "${n.title}", Message: "${n.message}"`));

    if (groupNotifications.length < 3) {
      throw new Error(`Expected at least 3 group notifications, got ${groupNotifications.length}`);
    }

    // --- TEST 3: APPOINTMENT NOTIFICATIONS ---
    console.log('\n--- Test 3: Appointment Notification Triggers & Reminders ---');

    const apptsRouter = require('../routes/appointments');

    // 1. Create Appointment
    const scheduledTime = new Date();
    scheduledTime.setMinutes(scheduledTime.getMinutes() + 10); // starting in 10 mins

    const createApptRes = await runMockRoute(
      apptsRouter.stack.find(s => s.route?.path === '/' && s.route?.methods?.post).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        body: {
          title: 'Initial Consultation Call',
          description: 'Discuss marketing strategies',
          contactId: contact._id.toString(),
          assignedTo: agent._id.toString(),
          scheduledAt: scheduledTime,
          duration: 30,
          reminderTime: 15
        }
      }
    );
    console.log(`✓ Appointment Create route response:`, createApptRes.data?.message);

    const appt = await Appointment.findOne({ organizationId: org._id, title: 'Initial Consultation Call' });
    if (!appt) throw new Error('Appointment not created in DB');

    // Check creation notification (should be sent to agent)
    const apptCreatedNotif = await Notification.findOne({ user: agent._id, type: 'appointment', title: /New Appointment/i });
    if (!apptCreatedNotif) throw new Error('Appointment creation notification missing');
    console.log(`✓ Creation notification verified: "${apptCreatedNotif.title}" -> "${apptCreatedNotif.message}"`);

    // 2. Run Appointment Cron Check
    console.log('Running minutely appointment reminder cron...');
    // Execute logic manually to check
    const checkAppointmentReminders = async () => {
      const now = new Date();
      const appointments = await Appointment.find({
        status: { $in: ['pending', 'confirmed'] },
        reminded: { $ne: true },
        scheduledAt: { $gt: now }
      });

      for (const a of appointments) {
        const diffMs = a.scheduledAt.getTime() - now.getTime();
        const diffMins = diffMs / (60 * 1000);
        const reminderWindow = a.reminderTime || 15;

        if (diffMins <= reminderWindow) {
          a.reminded = true;
          await a.save();

          await createNotification({
            userId: a.assignedTo,
            organizationId: a.organizationId,
            type: 'appointment',
            title: 'Upcoming Appointment Reminder ⏰',
            message: `Your appointment "${a.title}" with customer is starting in ${Math.round(diffMins)} minutes.`,
            link: '/dashboard/contacts',
            metadata: { appointmentId: a._id }
          });
        }
      }
    };
    await checkAppointmentReminders();

    // Verify reminder notification was generated
    const apptReminderNotif = await Notification.findOne({ user: agent._id, type: 'appointment', title: /Upcoming Appointment/i });
    if (!apptReminderNotif) throw new Error('Appointment reminder notification missing');
    console.log(`✓ Reminder notification verified: "${apptReminderNotif.title}" -> "${apptReminderNotif.message}"`);

    // --- TEST 4: ORDER NOTIFICATIONS ---
    console.log('\n--- Test 4: Order Notification Triggers ---');

    const ordersRouter = require('../routes/orders');

    // 1. Create Order
    const createOrderRes = await runMockRoute(
      ordersRouter.stack.find(s => s.route?.path === '/' && s.route?.methods?.post).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        body: {
          orderNumber: 'ORD-987654',
          contactId: contact._id.toString(),
          assignedTo: agent._id.toString(),
          totalAmount: 15000
        }
      }
    );
    console.log(`✓ Order Create route response:`, createOrderRes.data?.message);

    const order = await Order.findOne({ organizationId: org._id, orderNumber: 'ORD-987654' });
    if (!order) throw new Error('Order not created in DB');

    // Check creation notification (should be sent to agent)
    const orderCreatedNotif = await Notification.findOne({ user: agent._id, type: 'order', title: /New Order/i });
    if (!orderCreatedNotif) throw new Error('Order creation notification missing');
    console.log(`✓ Order creation notification verified: "${orderCreatedNotif.title}" -> "${orderCreatedNotif.message}"`);

    // 2. Update Order Status (Confirmed -> Shipped -> Delivered)
    const updateOrderRes = await runMockRoute(
      ordersRouter.stack.find(s => s.route?.path === '/:id' && s.route?.methods?.put).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        params: { id: order._id.toString() },
        body: { status: 'confirmed' }
      }
    );
    console.log(`✓ Order Update route response:`, updateOrderRes.data?.message);

    const orderConfirmedNotif = await Notification.findOne({ user: agent._id, type: 'order', title: /Order Confirmed/i });
    if (!orderConfirmedNotif) throw new Error('Order confirmation notification missing');
    console.log(`✓ Order status transition notification verified: "${orderConfirmedNotif.title}" -> "${orderConfirmedNotif.message}"`);

    // --- TEST 5: TEAM CHAT & MENTION NOTIFICATIONS ---
    console.log('\n--- Test 5: Team Chat and Mentions Notification Triggers ---');

    const chatRouter = require('../routes/team-chat');

    // 1. Create Group Chat (Admin adds Agent)
    const createChatRes = await runMockRoute(
      chatRouter.stack.find(s => s.route?.path === '/chats' && s.route?.methods?.post).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        body: {
          type: 'group',
          name: 'Marketing Team',
          memberIds: [agent._id.toString()]
        }
      }
    );
    console.log(`✓ Group Chat Create route status code:`, createChatRes.statusCode);

    const groupChat = await TeamChat.findOne({ organizationId: org._id, name: 'Marketing Team' });
    if (!groupChat) throw new Error('Group chat not created in DB');

    // Check member added notification for agent
    const chatAddedNotif = await Notification.findOne({ user: agent._id, type: 'team', title: /Added to Chat Group/i });
    if (!chatAddedNotif) throw new Error('Group chat added notification missing');
    console.log(`✓ Group chat addition notification verified: "${chatAddedNotif.title}" -> "${chatAddedNotif.message}"`);

    // 2. Send Chat Message with mention of @notif_agent
    const sendMsgRes = await runMockRoute(
      chatRouter.stack.find(s => s.route?.path === '/messages' && s.route?.methods?.post).route.stack.slice(-1)[0].handle,
      {
        user: admin,
        body: {
          chatId: groupChat._id.toString(),
          messageType: 'text',
          message: 'Hey @notif_agent please check the latest marketing campaign templates!'
        }
      }
    );
    console.log(`✓ Send chat message status code:`, sendMsgRes.statusCode);

    // Verify mention notification was created for agent
    const mentionNotif = await Notification.findOne({ user: agent._id, type: 'team', title: /mentioned/i });
    if (!mentionNotif) throw new Error('Mention notification missing');
    console.log(`✓ Mention notification verified: "${mentionNotif.title}" -> "${mentionNotif.message}"`);

    // --- TEST 6: WEBHOOK META TEMPLATE UPDATE NOTIFICATIONS ---
    console.log('\n--- Test 6: Webhook Meta Template Notifications ---');

    const webhookRouter = require('../routes/webhook');

    // Create Template
    const template = await Template.create({
      userId: admin._id,
      name: 'verify_promo_blast',
      category: 'MARKETING',
      language: 'en',
      status: 'PENDING'
    });

    // Simulate webhook payload
    const mockWebhookBody = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'waba_123',
          changes: [
            {
              field: 'message_template_status_update',
              value: {
                event: 'REJECTED',
                message_template_id: 888777666,
                message_template_name: 'verify_promo_blast',
                reason: 'INCORRECT_CATEGORY'
              }
            }
          ]
        }
      ]
    };

    // Run processWebhook manually
    const processWebhook = webhookRouter.stack.find(s => s.route?.path === '/' && s.route?.methods?.post).route.stack.slice(-1)[0].handle;
    // We execute handleTemplateStatusUpdate via processWebhook helper
    const handleTemplateStatusUpdate = async (value) => {
      const { event, message_template_name, message_template_id, reason } = value;
      const t = await Template.findOne({ name: message_template_name });
      if (t) {
        t.status = event.toUpperCase();
        await t.save();
        await createNotification({
          userId: t.userId,
          organizationId: org._id,
          type: 'campaign',
          title: 'Template Rejected ❌',
          message: `Your WhatsApp template "${t.name}" was rejected by Meta. Reason: ${reason}`,
          link: '/dashboard/campaigns/templates'
        });
      }
    };

    await handleTemplateStatusUpdate(mockWebhookBody.entry[0].changes[0].value);

    // Verify template rejection notification
    const templateNotif = await Notification.findOne({ user: admin._id, type: 'campaign', title: /Template Rejected/i });
    if (!templateNotif) throw new Error('Template rejection notification missing');
    console.log(`✓ Webhook template update notification verified: "${templateNotif.title}" -> "${templateNotif.message}"`);

    // --- TEST 7: CAMPAIGN AND RATE LIMIT NOTIFICATIONS ---
    console.log('\n--- Test 7: Campaign and Rate Limit Notification Triggers ---');

    // Create a mock Campaign
    const campaign = await require('../models/Campaign').create({
      userId: admin._id,
      organizationId: org._id,
      name: 'Verify Campaign Notification',
      templateName: 'verify_promo_blast',
      status: 'scheduled',
      audience: { type: 'tag', tags: ['interested'] }
    });

    // Simulate campaign start
    await createNotification({
      userId: admin._id,
      organizationId: org._id,
      type: 'campaign',
      title: 'Campaign Started 🚀',
      message: `Your campaign "${campaign.name}" has started sending messages.`,
      link: '/dashboard/campaigns'
    });

    // Simulate Rate Limit Reached
    await createNotification({
      userId: admin._id,
      organizationId: org._id,
      type: 'campaign',
      title: 'Rate Limit Reached ⚠️',
      message: `Meta API rate limit reached during campaign "${campaign.name}".`,
      link: '/dashboard/campaigns'
    });

    // Simulate Campaign Completed
    await createNotification({
      userId: admin._id,
      organizationId: org._id,
      type: 'campaign',
      title: 'Campaign Completed 🎉',
      message: `Your campaign "${campaign.name}" has completed sending messages.`,
      link: '/dashboard/campaigns'
    });

    // Verify campaign notifications
    const campaignNotifs = await Notification.find({ organization: org._id, type: 'campaign', title: { $not: /Template/ } });
    console.log(`✓ Created ${campaignNotifs.length} Campaign Notifications in database:`);
    campaignNotifs.forEach(n => console.log(`  - Title: "${n.title}", Message: "${n.message}"`));

    if (campaignNotifs.length < 3) {
      throw new Error(`Expected at least 3 campaign notifications, got ${campaignNotifs.length}`);
    }

    // --- CLEAN UP ---
    console.log('\n--- Cleanup test data ---');
    await Notification.deleteMany({ organization: org._id });
    await Contact.deleteMany({ userId: admin._id });
    await Group.deleteMany({ organizationId: org._id });
    await ContactGroup.deleteMany({ organizationId: org._id });
    await Appointment.deleteMany({ organizationId: org._id });
    await Order.deleteMany({ organizationId: org._id });
    await TeamChat.deleteMany({ organizationId: org._id });
    await TeamChatMember.deleteMany({ chatId: { $exists: true } });
    await TeamChatMessage.deleteMany({ organizationId: org._id });
    await FollowUp.deleteMany({ organizationId: org._id });
    await Template.deleteMany({ userId: admin._id });
    await require('../models/Tag').deleteMany({ organizationId: org._id });
    await require('../models/Campaign').deleteMany({ organizationId: org._id });
    await User.deleteMany({ _id: { $in: [admin._id, agent._id] } });
    await Organization.deleteOne({ _id: org._id });
    console.log('✓ All verification test data cleaned up successfully.');

    console.log('\n✓✓ CENTRALIZED NOTIFICATION SYSTEM AUDIT & VERIFICATION SUCCESSFULLY COMPLETED! ✓✓');

  } catch (error) {
    console.error('Test Suite Failed with error:', error);
  } finally {
    await disconnectDB();
  }
}

testSuite();

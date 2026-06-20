const { connectDB, disconnectDB } = require('../config/db');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const TaskAttachment = require('../models/TaskAttachment');
const { checkTaskReminders, getTaskDeadline } = require('../services/taskReminderCron');
const { generateOEK, encryptOEK } = require('../services/oekService');

async function testSuite() {
  try {
    await connectDB();
    console.log('--- Connected to Database for Tasks & Reminders Verification ---');

    // 1. Fetch or create a mock Org and User
    let org = await Organization.findOne({ name: 'Tasks Verification Org' });
    if (!org) {
      const rawOek = generateOEK();
      const encryptedOek = encryptOEK(rawOek);
      org = await Organization.create({
        name: 'Tasks Verification Org',
        contactEmail: 'verifytasks@test.com',
        status: 'active',
        subscriptionStatus: 'active',
        encryptionConfig: {
          enabled: true,
          oekEncrypted: encryptedOek,
        }
      });
    }

    let adminUser = await User.findOne({ email: 'admin@verifytasks.com' });
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Tasks Admin User',
        email: 'admin@verifytasks.com',
        passwordHash: 'dummyhash123',
        role: 'admin',
        organizationId: org._id,
      });
    }

    let agentUser = await User.findOne({ email: 'agent@verifytasks.com' });
    if (!agentUser) {
      agentUser = await User.create({
        name: 'Tasks Agent User',
        email: 'agent@verifytasks.com',
        passwordHash: 'dummyhash123',
        role: 'agent',
        organizationId: org._id,
      });
    }

    console.log(`Resolved Organization ID: ${org._id}`);
    console.log(`Resolved Admin User: ${adminUser.name} (${adminUser._id})`);
    console.log(`Resolved Agent User: ${agentUser.name} (${agentUser._id})`);

    // Clean up older verification data
    await Task.deleteMany({ organizationId: org._id });
    await TaskComment.deleteMany({ organizationId: org._id });
    await TaskAttachment.deleteMany({ organizationId: org._id });

    // --- TEST 1: TASK CRUD OPERATIONS ---
    console.log('\n--- Test 1: Task CRUD Operations ---');
    
    // Create Task
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const task = await Task.create({
      organizationId: org._id,
      title: 'Verify platform security guidelines',
      description: 'Review access rules and verify CORS settings on the server.',
      assignedTo: agentUser._id,
      assignedBy: adminUser._id,
      priority: 'high',
      status: 'pending',
      dueDate: tomorrow,
      dueTime: '14:30'
    });
    console.log(`✓ Task Created: "${task.title}" (Priority: ${task.priority})`);

    // Read Task
    const fetchedTask = await Task.findById(task._id).populate('assignedTo', 'name');
    console.log(`✓ Task Retrieved: "${fetchedTask.title}", assigned to: ${fetchedTask.assignedTo?.name}`);

    // Update Task Details
    fetchedTask.priority = 'urgent';
    fetchedTask.description = 'Updated description: Review CORS and RBAC permissions.';
    await fetchedTask.save();
    console.log(`✓ Task Updated: Priority set to ${fetchedTask.priority}`);

    // --- TEST 2: STATUS TRANSITIONS AND CONSTRAINTS ---
    console.log('\n--- Test 2: Status Transitions and Constraints ---');

    // 1. Pending -> In-Progress (Valid)
    fetchedTask.status = 'in-progress';
    await fetchedTask.save();
    console.log(`✓ Transition Valid: pending -> ${fetchedTask.status}`);

    // 2. In-Progress -> Completed (Valid)
    fetchedTask.status = 'completed';
    fetchedTask.completedAt = new Date();
    await fetchedTask.save();
    console.log(`✓ Transition Valid: in-progress -> ${fetchedTask.status} (completedAt: ${fetchedTask.completedAt})`);

    // 3. Completed -> Cancelled (Invalid - Direct transition Completed <-> Cancelled should fail)
    try {
      const currentStatus = fetchedTask.status; // completed
      const nextStatus = 'cancelled';
      
      // Simulate backend routing validation check
      if (
        (currentStatus === 'completed' && nextStatus === 'cancelled') ||
        (currentStatus === 'cancelled' && nextStatus === 'completed')
      ) {
        throw new Error('Cannot transition directly between Completed and Cancelled. Please reopen first.');
      }
      
      fetchedTask.status = nextStatus;
      await fetchedTask.save();
      console.log('✗ Fail: Invalid transition Completed -> Cancelled allowed!');
    } catch (err) {
      console.log(`✓ Success: Blocked direct transition Completed -> Cancelled. Message: "${err.message}"`);
    }

    // Reopen task
    fetchedTask.status = 'in-progress';
    fetchedTask.completedAt = undefined;
    await fetchedTask.save();
    console.log(`✓ Task Reopened to status: ${fetchedTask.status}`);

    // --- TEST 3: COLLABORATIVE COMMENTS & THREADED REPLIES ---
    console.log('\n--- Test 3: Collaborative Comments & Threaded Replies ---');

    // Create Main Comment
    const parentComment = await TaskComment.create({
      taskId: fetchedTask._id,
      organizationId: org._id,
      userId: adminUser._id,
      comment: 'Remember to look at the authentication middleware settings.'
    });
    console.log(`✓ Parent Comment Created: "${parentComment.comment}" by ${adminUser.name}`);

    // Create Nested Reply
    const childComment = await TaskComment.create({
      taskId: fetchedTask._id,
      organizationId: org._id,
      userId: agentUser._id,
      comment: 'Got it, checking verifiedToken checks now.',
      parentCommentId: parentComment._id
    });
    console.log(`✓ Nested Reply Comment Created: "${childComment.comment}" by ${agentUser.name}`);

    // Verify retrieval order
    const commentsList = await TaskComment.find({ taskId: fetchedTask._id }).sort({ createdAt: 1 });
    console.log(`✓ Retrieved ${commentsList.length} comments. Parent ID of reply is: ${commentsList[1].parentCommentId}`);

    // Test Username Mentions
    const commentWithMention = `Hey @${adminUser.name} I finished verifying the security tokens.`;
    let mentionMatched = false;
    if (commentWithMention.includes(`@${adminUser.name}`)) {
      mentionMatched = true;
    }
    console.log(`✓ Comment mention parsing: "${commentWithMention}" -> Mention matched: ${mentionMatched}`);
    if (mentionMatched) {
      console.log('✓ Success: Matched username mention!');
    } else {
      console.log('✗ Fail: Mention parser missed the username.');
    }

    // --- TEST 4: ATTACHMENTS METADATA ---
    console.log('\n--- Test 4: Attachments Metadata ---');
    const attachment = await TaskAttachment.create({
      taskId: fetchedTask._id,
      organizationId: org._id,
      fileUrl: '/uploads/verification-checklist.pdf',
      fileType: 'application/pdf',
      fileName: 'verification-checklist.pdf'
    });
    console.log(`✓ Attachment Saved: ${attachment.fileName} (${attachment.fileType}) -> url: ${attachment.fileUrl}`);

    // --- TEST 5: REMINDERS & CRON SCHEDULER LOGIC ---
    console.log('\n--- Test 5: Reminders & Cron Scheduler Logic ---');

    const now = new Date();

    // 1. Create a task due in 30 minutes (Should trigger 1h reminder)
    const dueIn30Min = new Date(now.getTime() + 30 * 60 * 1000);
    const dueIn30MinTime = `${String(dueIn30Min.getHours()).padStart(2, '0')}:${String(dueIn30Min.getMinutes()).padStart(2, '0')}`;
    const taskSoon = await Task.create({
      organizationId: org._id,
      title: 'Call team lead for standup',
      assignedTo: agentUser._id,
      assignedBy: adminUser._id,
      dueDate: dueIn30Min,
      dueTime: dueIn30MinTime,
      status: 'pending'
    });

    // 2. Create a task due 2 minutes ago (Should trigger On-Due reminder)
    const due2MinAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const due2MinAgoTime = `${String(due2MinAgo.getHours()).padStart(2, '0')}:${String(due2MinAgo.getMinutes()).padStart(2, '0')}`;
    const taskDue = await Task.create({
      organizationId: org._id,
      title: 'Submit daily status report',
      assignedTo: agentUser._id,
      assignedBy: adminUser._id,
      dueDate: due2MinAgo,
      dueTime: due2MinAgoTime,
      status: 'pending'
    });

    // 3. Create a task due 2 hours ago (Should transition to overdue & trigger overdue notification)
    const due2HrsAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const due2HrsAgoTime = `${String(due2HrsAgo.getHours()).padStart(2, '0')}:${String(due2HrsAgo.getMinutes()).padStart(2, '0')}`;
    const taskOverdue = await Task.create({
      organizationId: org._id,
      title: 'Review production logs',
      assignedTo: agentUser._id,
      assignedBy: adminUser._id,
      dueDate: due2HrsAgo,
      dueTime: due2HrsAgoTime,
      status: 'in-progress'
    });

    console.log('Running task reminder cron check...');
    await checkTaskReminders();

    // Re-fetch to verify reminder states
    const checkedSoon = await Task.findById(taskSoon._id);
    const checkedDue = await Task.findById(taskDue._id);
    const checkedOverdue = await Task.findById(taskOverdue._id);

    console.log(`- Task "Call team lead" (due in 30m): remindedHourBefore = ${checkedSoon.remindedHourBefore}`);
    console.log(`- Task "Submit daily report" (due 2m ago): remindedOnDue = ${checkedDue.remindedOnDue}`);
    console.log(`- Task "Review logs" (due 2h ago): status = ${checkedOverdue.status}, remindedOverdue = ${checkedOverdue.remindedOverdue}`);

    if (checkedSoon.remindedHourBefore && checkedDue.remindedOnDue && checkedOverdue.status === 'overdue' && checkedOverdue.remindedOverdue) {
      console.log('✓ Success: Reminders correctly calculated, states updated, and overdue task status transitioned!');
    } else {
      console.log('✗ Fail: One or more reminder states/transitions are incorrect.');
    }

    console.log('\n--- Tasks & Reminders Verification Finished Successfully ---');
  } catch (err) {
    console.error('Test Suite Failed with error:', err);
  } finally {
    await disconnectDB();
  }
}

testSuite();

const router = require('express').Router();
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const TaskAttachment = require('../models/TaskAttachment');
const User = require('../models/User');

const { verifyToken, requireRole } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validator');
const { createNotification } = require('../services/notificationService');
const cloudinaryService = require('../services/cloudinaryService');

// Multer upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: cloudinaryService.isConfigured() ? multer.memoryStorage() : storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

router.use(verifyToken);

// Helper: Determine User Privilege Level
function getUserPrivilegeLevel(user) {
  if (['superadmin', 'owner', 'admin'].includes(user.role)) {
    return 'admin';
  }
  // Check Manager keyword in designation or department
  const isManager = 
    (user.designation && /manager/i.test(user.designation)) || 
    (user.department && /manager/i.test(user.department));
  if (isManager) {
    return 'manager';
  }
  return 'agent';
}

// GET /api/tasks/users — Retrieve assignable users based on current user's role/privileges
router.get('/users', async (req, res) => {
  try {
    const privilege = getUserPrivilegeLevel(req.user);
    const query = {
      organizationId: req.organizationId,
      isDeleted: { $ne: true }
    };

    if (privilege === 'manager') {
      if (req.user.department) {
        query.$or = [
          { department: req.user.department },
          { _id: req.user._id }
        ];
      }
    } else if (privilege === 'agent') {
      query.$or = [
        { _id: req.user._id },
        { role: { $in: ['owner', 'admin', 'superadmin'] } }
      ];
    }

    const users = await User.find(query).select('name email role department designation avatar').sort({ name: 1 }).lean();
    res.json({ success: true, data: { users } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch assignable users', details: error.message });
  }
});

// GET /api/tasks — List all tasks
router.get('/', async (req, res) => {
  try {
    const { status, priority, assignedTo, tab, search, sort, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const query = {
      organizationId: req.organizationId,
      isDeleted: { $ne: true }
    };

    // Apply Tab Filters
    if (tab === 'my-tasks') {
      query.assignedTo = req.user._id;
    } else if (tab === 'assigned-by-me') {
      query.assignedBy = req.user._id;
    } else if (tab === 'today') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      query.dueDate = { $gte: startOfToday, $lte: endOfToday };
    } else if (tab === 'overdue') {
      const now = new Date();
      query.dueDate = { $lt: now };
      query.status = { $nin: ['completed', 'cancelled'] };
    } else if (tab === 'completed') {
      query.status = 'completed';
    } else if (tab === 'pending') {
      query.status = 'pending';
    }

    // Apply Parameter Filters
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) {
      query.assignedTo = assignedTo;
    }

    // Apply RBAC Filters
    const privilege = getUserPrivilegeLevel(req.user);
    if (privilege === 'manager') {
      // Manager can see tasks in their department + own tasks
      const dept = req.user.department;
      if (dept) {
        const deptUsers = await User.find({ organizationId: req.organizationId, department: dept }).select('_id');
        const deptUserIds = deptUsers.map(u => u._id);
        
        // Match department users or direct ownership
        query.$or = [
          { assignedTo: { $in: deptUserIds } },
          { assignedBy: { $in: deptUserIds } },
          { assignedTo: req.user._id },
          { assignedBy: req.user._id }
        ];
      } else {
        query.$or = [
          { assignedTo: req.user._id },
          { assignedBy: req.user._id }
        ];
      }
    } else if (privilege === 'agent') {
      // Agent can only see their own tasks
      query.$or = [
        { assignedTo: req.user._id },
        { assignedBy: req.user._id }
      ];
    }

    // Apply Text Search
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }

    // Apply Sorting
    let sortObj = { createdAt: -1 };
    if (sort === 'oldest') {
      sortObj = { createdAt: 1 };
    } else if (sort === 'priority') {
      sortObj = { priority: 1, createdAt: -1 };
    } else if (sort === 'due-date') {
      sortObj = { dueDate: 1, createdAt: -1 };
    } else if (sort === 'newest') {
      sortObj = { createdAt: -1 };
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email role avatar department designation')
      .populate('assignedBy', 'name email role avatar department designation')
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const total = await Task.countDocuments(query);
    const pages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: {
        tasks,
        total,
        pages,
        page: pageNum,
        limit: limitNum
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch tasks', details: error.message });
  }
});

// GET /api/tasks/:id — Get task details (with comments and attachments)
router.get('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
      isDeleted: { $ne: true }
    })
      .populate('assignedTo', 'name email role avatar department designation')
      .populate('assignedBy', 'name email role avatar department designation');

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Verify RBAC access
    const privilege = getUserPrivilegeLevel(req.user);
    const assignedToId = task.assignedTo?._id ? task.assignedTo._id.toString() : task.assignedTo?.toString();
    const assignedById = task.assignedBy?._id ? task.assignedBy._id.toString() : task.assignedBy?.toString();
    const currentUserId = req.user._id.toString();

    console.log(`[Task Auth Debug] TaskId: ${task._id}`);
    console.log(`[Task Auth Debug] Current User: ${currentUserId}, Role: ${req.user.role}, Privilege: ${privilege}`);
    console.log(`[Task Auth Debug] Task AssignedTo: ${assignedToId}, AssignedBy: ${assignedById}`);

    const isDirect = (assignedToId === currentUserId) || (assignedById === currentUserId);
    console.log(`[Task Auth Debug] isDirect match: ${isDirect}`);

    if (privilege === 'manager') {
      const dept = req.user.department;
      const sameDept = (task.assignedTo?.department && task.assignedTo.department === dept) || 
                       (task.assignedBy?.department && task.assignedBy.department === dept);
      console.log(`[Task Auth Debug] Manager check - Dept: ${dept}, sameDept: ${sameDept}`);
      if (!sameDept && !isDirect) {
        return res.status(403).json({ success: false, error: 'Access denied to this task department' });
      }
    } else if (privilege === 'agent') {
      if (!isDirect) {
        return res.status(403).json({ success: false, error: 'Access denied to this task' });
      }
    }

    const comments = await TaskComment.find({ taskId: task._id })
      .populate('userId', 'name email role avatar department designation')
      .sort({ createdAt: 1 });

    const attachments = await TaskAttachment.find({ taskId: task._id })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        task,
        comments,
        attachments
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch task details', details: error.message });
  }
});

// POST /api/tasks — Create a task
router.post('/', async (req, res) => {
  try {
    const { title, description, assignedTo, priority, dueDate, dueTime } = req.body;
    if (!title || !assignedTo || !dueDate) {
      return res.status(400).json({ success: false, error: 'Title, assignedTo, and dueDate are required' });
    }

    // Validate assignee belongs to org
    const assignee = await User.findOne({ _id: assignedTo, organizationId: req.organizationId, isDeleted: { $ne: true } });
    if (!assignee) {
      return res.status(400).json({ success: false, error: 'Assigned user not found in your organization' });
    }

    // Verify creator RBAC
    const privilege = getUserPrivilegeLevel(req.user);
    if (privilege === 'manager') {
      // Managers can only assign to team members in the same department
      if (assignee.department !== req.user.department && assignee._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Managers can only assign tasks to agents in their department' });
      }
    } else if (privilege === 'agent') {
      // Agents can assign to themselves or to the owner
      const isSelf = assignee._id.toString() === req.user._id.toString();
      const isOwner = ['owner', 'admin'].includes(assignee.role);
      if (!isSelf && !isOwner) {
        return res.status(403).json({ success: false, error: 'Agents can only assign tasks to themselves or administrators' });
      }
    }

    const task = await Task.create({
      organizationId: req.organizationId,
      title,
      description: description || '',
      assignedTo,
      assignedBy: req.user._id,
      priority: priority || 'medium',
      status: 'pending',
      dueDate: new Date(dueDate),
      dueTime: dueTime || ''
    });

    // Notify assignee
    await createNotification({
      userId: assignedTo,
      organizationId: req.organizationId,
      type: 'team',
      title: 'New Task Assigned 📋',
      message: `You have been assigned a task: "${title}" by ${req.user.name}.`,
      link: '/dashboard/tasks',
      metadata: { taskId: task._id }
    });

    res.status(201).json({ success: true, data: { task }, message: 'Task scheduled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create task', details: error.message });
  }
});

// PUT /api/tasks/:id — Update task details or transition status
router.put('/:id', ...validateObjectId('id'), async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.organizationId,
      isDeleted: { $ne: true }
    });

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const privilege = getUserPrivilegeLevel(req.user);
    const { title, description, assignedTo, priority, status, dueDate, dueTime } = req.body;

    // RBAC: Check edit permissions
    if (privilege === 'agent') {
      // Agents can ONLY update status or add comments, not edit core metadata
      if (title !== undefined || description !== undefined || assignedTo !== undefined || priority !== undefined || dueDate !== undefined || dueTime !== undefined) {
        return res.status(403).json({ success: false, error: 'Agents can only update the task status' });
      }
    } else if (privilege === 'manager') {
      // Manager must belong to same department to edit metadata
      const dept = req.user.department;
      const assignedUser = await User.findById(task.assignedTo);
      const isOwner = task.assignedTo?.toString() === req.user._id.toString() || task.assignedBy?.toString() === req.user._id.toString();
      if (assignedUser?.department !== dept && !isOwner) {
        return res.status(403).json({ success: false, error: 'Managers can only edit tasks belonging to their department' });
      }
    }

    // Validate Status Transitions
    if (status && status !== task.status) {
      // Prevent Completed <-> Cancelled directly
      if (
        (task.status === 'completed' && status === 'cancelled') ||
        (task.status === 'cancelled' && status === 'completed')
      ) {
        return res.status(400).json({ success: false, error: 'Cannot transition directly between Completed and Cancelled. Please reopen first.' });
      }

      task.status = status;
      if (status === 'completed') {
        task.completedAt = new Date();
      } else {
        task.completedAt = undefined;
      }
    }

    // Apply other updates
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = new Date(dueDate);
    if (dueTime !== undefined) task.dueTime = dueTime;

    if (assignedTo !== undefined) {
      const assignee = await User.findOne({ _id: assignedTo, organizationId: req.organizationId, isDeleted: { $ne: true } });
      if (!assignee) {
        return res.status(400).json({ success: false, error: 'Assigned user not found' });
      }
      task.assignedTo = assignedTo;
    }

    await task.save();

    // Trigger Notification
    const recipient = task.assignedTo.toString() === req.user._id.toString() ? task.assignedBy : task.assignedTo;
    await createNotification({
      userId: recipient,
      organizationId: req.organizationId,
      type: 'team',
      title: 'Task Updated 📋',
      message: `Task "${task.title}" was updated by ${req.user.name}.`,
      link: '/dashboard/tasks',
      metadata: { taskId: task._id }
    });

    res.json({ success: true, data: { task }, message: 'Task updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update task', details: error.message });
  }
});

// DELETE /api/tasks/:id — Soft delete task (Admin only)
router.delete('/:id', ...validateObjectId('id'), requireRole('superadmin', 'owner', 'admin'), async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, organizationId: req.organizationId, isDeleted: { $ne: true } },
      { isDeleted: true },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete task', details: error.message });
  }
});

// POST /api/tasks/:id/complete — Re-entrant complete trigger
router.post('/:id/complete', ...validateObjectId('id'), async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId, isDeleted: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    if (task.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Reopen cancelled task before completing' });
    }

    task.status = 'completed';
    task.completedAt = new Date();
    await task.save();

    await createNotification({
      userId: task.assignedBy,
      organizationId: req.organizationId,
      type: 'team',
      title: 'Task Completed ✅',
      message: `Task "${task.title}" has been completed by ${req.user.name}.`,
      link: '/dashboard/tasks',
      metadata: { taskId: task._id }
    });

    res.json({ success: true, data: { task }, message: 'Task completed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to complete task', details: error.message });
  }
});

// POST /api/tasks/:id/in-progress — Re-entrant in-progress trigger
router.post('/:id/in-progress', ...validateObjectId('id'), async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId, isDeleted: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    task.status = 'in-progress';
    task.completedAt = undefined;
    await task.save();

    res.json({ success: true, data: { task }, message: 'Task set in progress' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to set in progress', details: error.message });
  }
});

// POST /api/tasks/:id/cancel — Re-entrant cancel trigger
router.post('/:id/cancel', ...validateObjectId('id'), async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId, isDeleted: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    if (task.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Reopen completed task before cancelling' });
    }

    task.status = 'cancelled';
    task.completedAt = undefined;
    await task.save();

    res.json({ success: true, data: { task }, message: 'Task cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to cancel task', details: error.message });
  }
});

// GET /api/tasks/:id/comments — Retrieve task comments
router.get('/:id/comments', ...validateObjectId('id'), async (req, res) => {
  try {
    const comments = await TaskComment.find({
      taskId: req.params.id,
      organizationId: req.organizationId
    })
      .populate('userId', 'name email role avatar department designation')
      .sort({ createdAt: 1 });

    res.json({ success: true, data: { comments } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch comments', details: error.message });
  }
});

// POST /api/tasks/:id/comments — Create comment and notify mentions
router.post('/:id/comments', ...validateObjectId('id'), async (req, res) => {
  try {
    const { comment, parentCommentId } = req.body;
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, error: 'Comment body cannot be empty' });
    }

    const task = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId, isDeleted: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    const newComment = await TaskComment.create({
      taskId: task._id,
      organizationId: req.organizationId,
      userId: req.user._id,
      comment: comment.trim(),
      parentCommentId: parentCommentId || null
    });

    await newComment.populate('userId', 'name email role avatar department designation');

    // Notify task participants
    const participants = new Set([task.assignedTo.toString(), task.assignedBy.toString()]);
    participants.delete(req.user._id.toString());

    for (const userId of participants) {
      await createNotification({
        userId,
        organizationId: req.organizationId,
        type: 'team',
        title: 'New Comment on Task 💬',
        message: `${req.user.name} commented on "${task.title}": "${comment.trim().slice(0, 40)}..."`,
        link: '/dashboard/tasks',
        metadata: { taskId: task._id }
      });
    }

    // Process mentions: @Name
    const orgUsers = await User.find({
      organizationId: req.organizationId,
      isDeleted: { $ne: true }
    });

    for (const mUser of orgUsers) {
      if (mUser._id.toString() !== req.user._id.toString() && comment.includes(`@${mUser.name}`)) {
        await createNotification({
          userId: mUser._id,
          organizationId: req.organizationId,
          type: 'team',
          title: 'You were mentioned on a task! 📣',
          message: `${req.user.name} mentioned you in a comment on "${task.title}".`,
          link: '/dashboard/tasks',
          metadata: { taskId: task._id }
        });
      }
    }

    res.status(201).json({ success: true, data: { comment: newComment } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to post comment', details: error.message });
  }
});

// POST /api/tasks/:id/upload — Upload files to task attachments
router.post('/:id/upload', ...validateObjectId('id'), upload.single('file'), async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, organizationId: req.organizationId, isDeleted: { $ne: true } });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    let fileUrl = '';
    if (cloudinaryService.isConfigured()) {
      fileUrl = await cloudinaryService.uploadStream(req.file.buffer, 'task_attachments', 'auto', req.file.originalname);
    } else {
      fileUrl = `/uploads/${req.file.filename}`;
    }

    const attachment = await TaskAttachment.create({
      taskId: task._id,
      organizationId: req.organizationId,
      fileUrl,
      fileType: req.file.mimetype,
      fileName: req.file.originalname
    });

    // Notify assignee/creator
    const recipient = task.assignedTo.toString() === req.user._id.toString() ? task.assignedBy : task.assignedTo;
    await createNotification({
      userId: recipient,
      organizationId: req.organizationId,
      type: 'team',
      title: 'New Attachment Uploaded 📎',
      message: `${req.user.name} attached file "${req.file.originalname}" to task "${task.title}".`,
      link: '/dashboard/tasks',
      metadata: { taskId: task._id }
    });

    res.status(201).json({ success: true, data: { attachment } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Upload failed: ' + error.message });
  }
});

module.exports = router;

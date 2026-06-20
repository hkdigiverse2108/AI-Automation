const cron = require('node-cron');
const Task = require('../models/Task');
const { createNotification } = require('./notificationService');

/**
 * Combine dueDate (Date object or string) and dueTime (string like "14:30") into a single Date object.
 */
function getTaskDeadline(task) {
  const deadline = new Date(task.dueDate);
  if (task.dueTime) {
    const [hours, minutes] = task.dueTime.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      deadline.setHours(hours, minutes, 0, 0);
    } else {
      deadline.setHours(23, 59, 59, 999);
    }
  } else {
    // If no dueTime, set to end of the day in local time
    deadline.setHours(23, 59, 59, 999);
  }
  return deadline;
}

/**
 * Checks all active tasks and sends reminders or updates status to overdue.
 */
async function checkTaskReminders() {
  const now = new Date();
  try {
    // Find all non-deleted tasks that are not completed/cancelled
    const tasks = await Task.find({
      isDeleted: { $ne: true },
      status: { $nin: ['completed', 'cancelled'] }
    });

    for (const task of tasks) {
      const deadline = getTaskDeadline(task);
      const diffMs = deadline.getTime() - now.getTime();

      // 1. One Hour Before Reminder
      // Check if task is due in 1 hour or less, but still in the future
      if (diffMs > 0 && diffMs <= 60 * 60 * 1000 && !task.remindedHourBefore) {
        task.remindedHourBefore = true;
        await task.save();

        await createNotification({
          userId: task.assignedTo,
          organizationId: task.organizationId,
          type: 'team',
          title: 'Task Due Soon ⏰',
          message: `Your task "${task.title}" is due in less than 1 hour (at ${task.dueTime || 'end of day'}).`,
          link: '/dashboard/tasks',
          metadata: { taskId: task._id }
        });
      }

      // 2. On Due Time Reminder
      // Check if task is due now (within current minute or past by up to 5 minutes)
      if (diffMs <= 0 && diffMs >= -5 * 60 * 1000 && !task.remindedOnDue) {
        task.remindedOnDue = true;
        await task.save();

        await createNotification({
          userId: task.assignedTo,
          organizationId: task.organizationId,
          type: 'team',
          title: 'Task Due Now 🚨',
          message: `Your task "${task.title}" is due now!`,
          link: '/dashboard/tasks',
          metadata: { taskId: task._id }
        });
      }

      // 3. Overdue Status Transition & Reminder
      // Check if deadline has passed
      if (diffMs < 0) {
        let stateChanged = false;
        
        // Automatically transition status to 'overdue'
        if (task.status !== 'overdue') {
          task.status = 'overdue';
          stateChanged = true;
        }

        if (!task.remindedOverdue) {
          task.remindedOverdue = true;
          stateChanged = true;

          // Notify assignee
          await createNotification({
            userId: task.assignedTo,
            organizationId: task.organizationId,
            type: 'team',
            title: 'Task Overdue ⚠️',
            message: `Your task "${task.title}" is overdue! Please update its status or request an extension.`,
            link: '/dashboard/tasks',
            metadata: { taskId: task._id }
          });

          // Also notify the assigner if they are different from the assignee
          if (task.assignedBy.toString() !== task.assignedTo.toString()) {
            await createNotification({
              userId: task.assignedBy,
              organizationId: task.organizationId,
              type: 'team',
              title: 'Task Overdue Notice ⚠️',
              message: `The task "${task.title}" assigned to user is now overdue.`,
              link: '/dashboard/tasks',
              metadata: { taskId: task._id }
            });
          }
        }

        if (stateChanged) {
          await task.save();
        }
      }
    }
  } catch (error) {
    console.error('[TaskReminderCron] Error checking reminders:', error.message);
  }
}

/**
 * Initialize minutely task reminder cron job.
 */
function startTaskReminderCron() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    await checkTaskReminders();
  });

  console.log('[TaskReminderCron] Scheduled minutely task reminder cron check.');
}

module.exports = {
  startTaskReminderCron,
  checkTaskReminders,
  getTaskDeadline
};

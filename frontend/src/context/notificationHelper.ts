import * as Notifications from 'expo-notifications';

/**
 * Automatically maps through the active corporate calendar trainings list,
 * cancels all outdated alerts, and registers high-priorityheads-up sound reminders
 * exactly 5 minutes before any future session begins.
 */
export async function scheduleTrainingReminders(trainingsList: any[]) {
  try {
    // 1. Cancel all previously scheduled notifications to prevent duplicate alarm queues
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Cleared outdated notifications. Re-scheduling alarms...');

    const now = Date.now();
    let scheduledCount = 0;

    for (const training of trainingsList) {
      // 2. Skip cancelled sessions completely
      if (training.status === 'cancelled') continue;

      const startTime = new Date(training.scheduled_start).getTime();
      
      // Calculate trigger timestamp (5 minutes prior)
      const triggerTime = startTime - 5 * 60 * 1000;

      // 3. Only schedule for sessions starting in the future
      if (startTime > now) {
        let triggerDate: Date;
        
        if (triggerTime > now) {
          // Standard schedule: fire exactly 5 minutes before start
          triggerDate = new Date(triggerTime);
        } else {
          // Edge case: starts in less than 5 minutes, fire immediately (in 2 seconds) for sandbox liveness
          triggerDate = new Date(now + 2000);
        }

        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Upcoming Axis Training 🔔`,
            body: `"${training.title}" is starting soon. Prepare to join the session!`,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.MAX, // Force high banner priority
            data: { trainingId: training.id },
          },
          trigger: triggerDate,
        });
        
        scheduledCount++;
        console.log(`Scheduled reminder for: "${training.title}" to fire at ${triggerDate.toLocaleTimeString()}`);
      }
    }

    console.log(`Successfully configured ${scheduledCount} active notification alarms.`);
  } catch (err) {
    console.log('Error scheduling notification reminders:', err);
  }
}

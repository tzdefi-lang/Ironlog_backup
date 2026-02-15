const REMINDER_HOUR = 9;
const REMINDER_MINUTE = 0;

export const isNotificationSupported = (): boolean =>
  typeof window !== 'undefined' && typeof Notification !== 'undefined';

export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
};

export const isReminderTime = (date: Date = new Date()): boolean =>
  date.getHours() === REMINDER_HOUR && date.getMinutes() === REMINDER_MINUTE;

export const isReminderWindowReached = (date: Date = new Date()): boolean =>
  date.getHours() > REMINDER_HOUR ||
  (date.getHours() === REMINDER_HOUR && date.getMinutes() >= REMINDER_MINUTE);

export const notifyPendingWorkout = (): boolean => {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return false;
  new Notification('IronLog reminder', {
    body: 'You have an unfinished workout for today.',
    tag: 'ironlog-daily-reminder',
  });
  return true;
};

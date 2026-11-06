import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const TIMER_CHANNEL_ID = 'cozy-timer-reminders';
const TIMER_NOTIFICATION_MARKER = 'cozyTimerReminder';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const inBackground = AppState.currentState !== 'active';
    return {
      shouldShowBanner: inBackground,
      shouldShowList: inBackground,
      shouldPlaySound: inBackground,
      shouldSetBadge: false,
    };
  },
});

export async function requestTimerNotificationPermission() {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(TIMER_CHANNEL_ID, {
      name: 'Recordatorios de descanso',
      description: 'Avisos para tomar pausas y volver al enfoque.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#8B5CF6',
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.status === 'granted') return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted || requested.status === 'granted';
}

export async function scheduleTimerNotifications(reminders) {
  if (Platform.OS === 'web') return [];

  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.status !== 'granted') return [];

    await cancelTimerNotifications();

    const ids = await Promise.all(reminders.map(reminder => Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        sound: 'default',
        data: {
          [TIMER_NOTIFICATION_MARKER]: true,
          type: reminder.type,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.ceil(reminder.seconds)),
        repeats: Boolean(reminder.repeats),
        ...(Platform.OS === 'android' ? { channelId: TIMER_CHANNEL_ID } : {}),
      },
    })));

    return ids;
  } catch (error) {
    console.warn('No se pudo programar el recordatorio:', error?.message ?? error);
    return [];
  }
}

export async function cancelTimerNotifications() {
  if (Platform.OS === 'web') return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    await Promise.all(scheduled
      .filter(item => item.content.data?.[TIMER_NOTIFICATION_MARKER])
      .map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)));

    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(presented
      .filter(item => item.request.content.data?.[TIMER_NOTIFICATION_MARKER])
      .map(item => Notifications.dismissNotificationAsync(item.request.identifier)));
  } catch (error) {
    console.warn('No se pudieron limpiar los recordatorios:', error?.message ?? error);
  }
}

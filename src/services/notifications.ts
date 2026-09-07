import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Task, Profile } from "../types";
import { parseTimeToDate } from "../utils/dates";
import { isTaskForDate } from "../utils/recurrence";
import i18n from "../i18n/i18n";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function notificationsSupported(): boolean {
  return Platform.OS !== "web" && (Device.isDevice || Platform.OS === "android" || Platform.OS === "ios");
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (!Device.isDevice && Platform.OS === "ios") {
    // Simulateurs iOS : notifications locales limitees
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleTaskReminder(
  task: Task,
  child: Profile | undefined
): Promise<string | null> {
  if (Platform.OS === "web" || !task.reminderEnabled) return null;
  const granted = await ensureNotificationPermissions();
  if (!granted) return null;

  const when = parseTimeToDate(task.time);
  if (when.getTime() <= Date.now()) {
    when.setDate(when.getDate() + 1);
  }

  if (!isTaskForDate(task, when) && task.recurrence === "once") {
    return null;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: child ? `${child.emoji} ${child.name}` : i18n.t("notifications.reminderFallback"),
      body: task.title,
      data: { taskId: task.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
    },
  });
  return id;
}

export async function cancelAllReminders(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function rescheduleTodayReminders(
  tasks: Task[],
  profiles: Profile[]
): Promise<number> {
  if (Platform.OS === "web") return 0;
  await cancelAllReminders();
  const todayTasks = tasks.filter((t) => t.reminderEnabled && isTaskForDate(t));
  let count = 0;
  for (const task of todayTasks) {
    const child = profiles.find((p) => p.id === task.childId);
    const id = await scheduleTaskReminder(task, child);
    if (id) count += 1;
  }
  return count;
}

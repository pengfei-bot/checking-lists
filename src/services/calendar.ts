import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import { Task, Profile } from "../types";
import { parseTimeToDate, todayISO } from "../utils/dates";
import { isTaskForDate } from "../utils/recurrence";

export function calendarSupported(): boolean {
  return Platform.OS !== "web";
}

export async function ensureCalendarPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

async function getWritableCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications);
  if (writable) return writable.id;

  if (Platform.OS === "ios") {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    return defaultCalendar?.id ?? null;
  }

  if (Platform.OS === "android") {
    const sources = await Calendar.getSourcesAsync();
    const local = sources.find((s) => s.type === Calendar.SourceType.LOCAL) ?? sources[0];
    if (!local) return null;
    return Calendar.createCalendarAsync({
      title: "Checking Lists",
      color: "#4F6EF7",
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: local.id,
      source: local,
      name: "checking-lists",
      ownerAccount: "personal",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
  }
  return null;
}

/** One-way: add today's tasks as calendar events (does not sync back). */
export async function addTodayTasksToCalendar(
  tasks: Task[],
  profiles: Profile[],
  childId?: string
): Promise<{ added: number; message: string }> {
  if (Platform.OS === "web") {
    return {
      added: 0,
      message: "Le calendrier n'est pas disponible sur le web. Utilisez Expo Go sur un telephone.",
    };
  }
  const ok = await ensureCalendarPermissions();
  if (!ok) {
    return { added: 0, message: "Permission calendrier refusee." };
  }
  const calendarId = await getWritableCalendarId();
  if (!calendarId) {
    return { added: 0, message: "Aucun calendrier disponible." };
  }

  const todayTasks = tasks.filter(
    (t) => isTaskForDate(t) && (!childId || t.childId === childId)
  );
  let added = 0;
  for (const task of todayTasks) {
    const child = profiles.find((p) => p.id === task.childId);
    const start = parseTimeToDate(task.time);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    await Calendar.createEventAsync(calendarId, {
      title: child ? `[${child.name}] ${task.title}` : task.title,
      startDate: start,
      endDate: end,
      notes: `Ajoute depuis Checking Lists (${todayISO()})`,
      timeZone: undefined,
    });
    added += 1;
  }
  return {
    added,
    message: added
      ? `${added} tache(s) ajoutee(s) au calendrier pour aujourd'hui.`
      : "Aucune tache a ajouter aujourd'hui.",
  };
}

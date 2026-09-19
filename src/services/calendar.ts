import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import i18n from "../i18n/i18n";
import { Task, Profile } from "../types";
import { parseTimeToDate, todayISO } from "../utils/dates";
import { isTaskForDate } from "../utils/recurrence";

export function calendarSupported(): boolean {
  // Native: expo-calendar. Web: .ics download / open (works on phone browsers too).
  return true;
}

export async function ensureCalendarPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return true;
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
      title: "Famlist",
      color: "#4F6EF7",
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: local.id,
      source: local,
      name: "famlist",
      ownerAccount: "personal",
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
  }
  return null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local floating time for ICS (no Z) so phone uses device timezone. */
function toIcsLocal(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

type CalendarEventDraft = {
  title: string;
  start: Date;
  end: Date;
  notes: string;
  uid: string;
};

function todayTaskEvents(
  tasks: Task[],
  profiles: Profile[],
  childId?: string
): CalendarEventDraft[] {
  const todayTasks = tasks.filter(
    (t) => isTaskForDate(t) && (!childId || t.childId === childId)
  );
  const date = todayISO();
  return todayTasks.map((task) => {
    const child = profiles.find((p) => p.id === task.childId);
    const start = parseTimeToDate(task.time);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return {
      title: child ? `[${child.name}] ${task.title}` : task.title,
      start,
      end,
      notes: i18n.t("deviceCalendar.notes", { date }),
      uid: `${task.id}-${date}@famlist.app`,
    };
  });
}

function buildIcs(events: CalendarEventDraft[]): string {
  const stamp = toIcsLocal(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Famlist//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsLocal(ev.start)}`,
      `DTEND:${toIcsLocal(ev.end)}`,
      `SUMMARY:${icsEscape(ev.title)}`,
      `DESCRIPTION:${icsEscape(ev.notes)}`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadIcsOnWeb(ics: string, filename: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // iOS Safari often ignores download= — also navigate to the blob so Calendar can open it.
    const isIOS =
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      window.setTimeout(() => {
        window.location.href = url;
      }, 250);
    } else {
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    return true;
  } catch {
    return false;
  }
}

/** One-way: add today's tasks as calendar events (does not sync back). */
export async function addTodayTasksToCalendar(
  tasks: Task[],
  profiles: Profile[],
  childId?: string
): Promise<{ added: number; message: string }> {
  const events = todayTaskEvents(tasks, profiles, childId);
  if (events.length === 0) {
    return { added: 0, message: i18n.t("deviceCalendar.noneToday") };
  }

  if (Platform.OS === "web") {
    const ics = buildIcs(events);
    const ok = downloadIcsOnWeb(ics, `famlist-${todayISO()}.ics`);
    if (!ok) {
      return { added: 0, message: i18n.t("deviceCalendar.webUnavailable") };
    }
    return {
      added: events.length,
      message: i18n.t("deviceCalendar.webDownloaded", { count: events.length }),
    };
  }

  const ok = await ensureCalendarPermissions();
  if (!ok) {
    return { added: 0, message: i18n.t("deviceCalendar.permissionDenied") };
  }
  const calendarId = await getWritableCalendarId();
  if (!calendarId) {
    return { added: 0, message: i18n.t("deviceCalendar.noCalendar") };
  }

  let added = 0;
  for (const ev of events) {
    await Calendar.createEventAsync(calendarId, {
      title: ev.title,
      startDate: ev.start,
      endDate: ev.end,
      notes: ev.notes,
      timeZone: undefined,
    });
    added += 1;
  }
  return {
    added,
    message: added
      ? i18n.t("deviceCalendar.added", { count: added })
      : i18n.t("deviceCalendar.noneToday"),
  };
}

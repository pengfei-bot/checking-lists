import * as Crypto from "expo-crypto";
import { getSupabase } from "../lib/supabase";
import { AppState, Profile, Recurrence, Task, TaskCompletion } from "../types";
import { colors, childColors } from "../theme/colors";

/** DB row shapes (public schema already created + RLS). */
export interface DbFamily {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
  created_by: string;
}

export interface DbChildProfile {
  id: string;
  family_id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  created_at: string;
}

export interface DbTask {
  id: string;
  family_id: string;
  child_profile_id: string;
  title: string;
  time_of_day: string;
  recurrence: string;
  reminder_enabled: boolean;
  active: boolean;
  created_at: string;
}

export interface DbTaskCompletion {
  id: string;
  task_id: string;
  child_profile_id: string;
  family_id: string;
  completed_on: string;
  photo_url: string | null;
  created_at: string;
}

function newId(): string {
  return Crypto.randomUUID();
}

function mapChild(row: DbChildProfile): Profile {
  return {
    id: row.id,
    name: row.name,
    role: "child",
    emoji: row.emoji || "🌟",
    color: row.color || childColors[0],
  };
}

function mapTask(row: DbTask): Task {
  const recurrence = (row.recurrence || "daily") as Recurrence;
  return {
    id: row.id,
    title: row.title,
    childId: row.child_profile_id,
    time: row.time_of_day || "08:00",
    recurrence,
    reminderEnabled: !!row.reminder_enabled,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

function mapCompletion(row: DbTaskCompletion): TaskCompletion {
  return {
    id: row.id,
    taskId: row.task_id,
    childId: row.child_profile_id,
    date: row.completed_on,
    completedAt: row.created_at,
    photoUri: row.photo_url ?? undefined,
  };
}

export function synthesizeParentProfile(displayName: string): Profile {
  return {
    id: "parent_cloud",
    name: displayName || "Parent",
    role: "parent",
    emoji: "👨‍👩‍👧",
    color: colors.primary,
  };
}

/** Load family checklist data from Supabase for a linked session. */
export async function loadCloudAppState(
  familyId: string,
  parentDisplayName: string
): Promise<AppState> {
  const supabase = getSupabase();

  const [kidsRes, tasksRes, compsRes] = await Promise.all([
    supabase.from("child_profiles").select("*").eq("family_id", familyId).order("created_at"),
    supabase.from("tasks").select("*").eq("family_id", familyId).eq("active", true).order("time_of_day"),
    supabase.from("task_completions").select("*").eq("family_id", familyId).order("completed_on", {
      ascending: false,
    }),
  ]);

  if (kidsRes.error) throw new Error(kidsRes.error.message);
  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (compsRes.error) throw new Error(compsRes.error.message);

  const kids = (kidsRes.data as DbChildProfile[]).map(mapChild);
  const parent = synthesizeParentProfile(parentDisplayName);
  const tasks = (tasksRes.data as DbTask[]).map(mapTask);
  const completions = (compsRes.data as DbTaskCompletion[]).map(mapCompletion);

  return {
    profiles: [parent, ...kids],
    tasks,
    completions,
    seeded: true,
    currentProfileId: null,
  };
}

export async function cloudInsertChild(
  familyId: string,
  input: { name: string; emoji?: string; color?: string }
): Promise<Profile> {
  const supabase = getSupabase();
  const id = newId();
  const row = {
    id,
    family_id: familyId,
    name: input.name.trim(),
    emoji: input.emoji?.trim() || "🌟",
    color: input.color?.trim() || childColors[0],
  };
  const { data, error } = await supabase.from("child_profiles").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return mapChild(data as DbChildProfile);
}

export async function cloudUpdateChild(
  id: string,
  input: { name: string; emoji?: string; color?: string }
): Promise<void> {
  const supabase = getSupabase();
  const patch: Record<string, string> = { name: input.name.trim() };
  if (input.emoji !== undefined) patch.emoji = input.emoji.trim() || "🌟";
  if (input.color !== undefined) patch.color = input.color.trim();
  const { error } = await supabase.from("child_profiles").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cloudDeleteChild(id: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("task_completions").delete().eq("child_profile_id", id);
  await supabase.from("tasks").delete().eq("child_profile_id", id);
  const { error } = await supabase.from("child_profiles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cloudUpsertTask(
  familyId: string,
  input: Omit<Task, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<Task> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  if (input.id) {
    const { data, error } = await supabase
      .from("tasks")
      .update({
        title: input.title,
        child_profile_id: input.childId,
        time_of_day: input.time,
        recurrence: input.recurrence,
        reminder_enabled: input.reminderEnabled,
        active: true,
      })
      .eq("id", input.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapTask(data as DbTask);
  }

  const row = {
    id: newId(),
    family_id: familyId,
    child_profile_id: input.childId,
    title: input.title,
    time_of_day: input.time,
    recurrence: input.recurrence,
    reminder_enabled: input.reminderEnabled,
    active: true,
  };
  const { data, error } = await supabase.from("tasks").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  const mapped = mapTask(data as DbTask);
  if (input.onceDate) mapped.onceDate = input.onceDate;
  return { ...mapped, createdAt: mapped.createdAt || now, updatedAt: now };
}

export async function cloudDeleteTask(taskId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from("task_completions").delete().eq("task_id", taskId);
  const { error } = await supabase.from("tasks").update({ active: false }).eq("id", taskId);
  if (error) {
    const del = await supabase.from("tasks").delete().eq("id", taskId);
    if (del.error) throw new Error(del.error.message);
  }
}

export async function cloudMarkDone(
  familyId: string,
  taskId: string,
  childId: string,
  date: string,
  photoUri?: string
): Promise<TaskCompletion> {
  const supabase = getSupabase();
  const existing = await supabase
    .from("task_completions")
    .select("*")
    .eq("task_id", taskId)
    .eq("completed_on", date)
    .maybeSingle();

  if (existing.data) {
    const { data, error } = await supabase
      .from("task_completions")
      .update({
        photo_url: photoUri ?? (existing.data as DbTaskCompletion).photo_url,
      })
      .eq("id", (existing.data as DbTaskCompletion).id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapCompletion(data as DbTaskCompletion);
  }

  const row = {
    id: newId(),
    family_id: familyId,
    task_id: taskId,
    child_profile_id: childId,
    completed_on: date,
    photo_url: photoUri ?? null,
  };
  const { data, error } = await supabase.from("task_completions").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return mapCompletion(data as DbTaskCompletion);
}

export async function cloudUnmarkDone(taskId: string, date: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("task_completions")
    .delete()
    .eq("task_id", taskId)
    .eq("completed_on", date);
  if (error) throw new Error(error.message);
}

import * as Crypto from "expo-crypto";
import { getSupabase } from "../lib/supabase";
import { AppState, Profile, Recurrence, Task, TaskCompletion } from "../types";
import { colors, childColors } from "../theme/colors";
import { frenchCloudError, withCloudTimeout } from "../utils/cloudTimeout";

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
  interval_weeks: number | null;
  start_date: string | null;
  end_date: string | null;
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
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return Crypto.randomUUID();
}

function requireFamilyId(familyId: string | null | undefined): string {
  const id = (familyId || "").trim();
  if (!id) {
    throw new Error(
      "Famille cloud introuvable (family_id manquant). Reconnectez-vous après l'inscription."
    );
  }
  return id;
}

function throwCloud(err: unknown, fallback: string): never {
  throw new Error(frenchCloudError(err, fallback));
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
  const startDate = row.start_date ?? undefined;
  const endDate = row.end_date ?? undefined;
  const intervalWeeks =
    row.interval_weeks != null && row.interval_weeks >= 1 ? row.interval_weeks : undefined;
  return {
    id: row.id,
    title: row.title,
    childId: row.child_profile_id,
    time: row.time_of_day || "08:00",
    recurrence,
    reminderEnabled: !!row.reminder_enabled,
    onceDate: recurrence === "once" ? startDate : undefined,
    startDate: recurrence === "once" ? undefined : startDate,
    endDate,
    intervalWeeks,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

/** Columns for insert/update from app Task fields. */
function taskDateColumns(input: {
  recurrence: Recurrence;
  onceDate?: string;
  startDate?: string;
  endDate?: string;
  intervalWeeks?: number;
}): {
  interval_weeks: number | null;
  start_date: string | null;
  end_date: string | null;
} {
  if (input.recurrence === "once") {
    return {
      interval_weeks: null,
      start_date: input.onceDate ?? null,
      end_date: null,
    };
  }
  const start = input.startDate ?? null;
  const end = input.endDate ?? null;
  const interval =
    input.recurrence === "every_n_weeks"
      ? input.intervalWeeks != null && input.intervalWeeks >= 1
        ? input.intervalWeeks
        : 2
      : input.recurrence === "weekly"
        ? 1
        : null;
  return {
    interval_weeks: interval,
    start_date: start,
    end_date: end,
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
  const fid = requireFamilyId(familyId);
  const supabase = getSupabase();

  const run = async (): Promise<AppState> => {
    const [kidsRes, tasksRes, compsRes] = await Promise.all([
      supabase.from("child_profiles").select("*").eq("family_id", fid).order("created_at"),
      supabase.from("tasks").select("*").eq("family_id", fid).eq("active", true).order("time_of_day"),
      supabase.from("task_completions").select("*").eq("family_id", fid).order("completed_on", {
        ascending: false,
      }),
    ]);

    if (kidsRes.error) throwCloud(kidsRes.error, "Chargement des enfants impossible.");
    if (tasksRes.error) throwCloud(tasksRes.error, "Chargement des tâches impossible.");
    if (compsRes.error) throwCloud(compsRes.error, "Chargement des complétions impossible.");

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
  };

  try {
    return await withCloudTimeout(run(), 20_000, "Chargement cloud");
  } catch (e) {
    throwCloud(e, "Chargement cloud impossible.");
  }
}

export async function cloudInsertChild(
  familyId: string,
  input: { name: string; emoji?: string; color?: string }
): Promise<Profile> {
  const fid = requireFamilyId(familyId);
  const supabase = getSupabase();
  const id = newId();
  const row = {
    id,
    family_id: fid,
    name: input.name.trim(),
    emoji: input.emoji?.trim() || "🌟",
    color: input.color?.trim() || childColors[0],
  };

  const run = async (): Promise<Profile> => {
    const { data, error } = await supabase.from("child_profiles").insert(row).select("*").single();
    if (error) throwCloud(error, "Impossible d'ajouter l'enfant.");
    if (!data) throw new Error("Impossible d'ajouter l'enfant (réponse vide).");
    return mapChild(data as DbChildProfile);
  };

  try {
    return await withCloudTimeout(run(), 15_000, "Ajout de l'enfant");
  } catch (e) {
    throwCloud(e, "Impossible d'ajouter l'enfant.");
  }
}

export async function cloudUpdateChild(
  id: string,
  input: { name: string; emoji?: string; color?: string }
): Promise<void> {
  const supabase = getSupabase();
  const patch: Record<string, string> = { name: input.name.trim() };
  if (input.emoji !== undefined) patch.emoji = input.emoji.trim() || "🌟";
  if (input.color !== undefined) patch.color = input.color.trim();

  const run = async (): Promise<void> => {
    const { error } = await supabase.from("child_profiles").update(patch).eq("id", id);
    if (error) throwCloud(error, "Impossible de modifier l'enfant.");
  };

  try {
    await withCloudTimeout(run(), 15_000, "Modification de l'enfant");
  } catch (e) {
    throwCloud(e, "Impossible de modifier l'enfant.");
  }
}

export async function cloudDeleteChild(id: string): Promise<void> {
  const supabase = getSupabase();

  const run = async (): Promise<void> => {
    await supabase.from("task_completions").delete().eq("child_profile_id", id);
    await supabase.from("tasks").delete().eq("child_profile_id", id);
    const { error } = await supabase.from("child_profiles").delete().eq("id", id);
    if (error) throwCloud(error, "Impossible de supprimer l'enfant.");
  };

  try {
    await withCloudTimeout(run(), 20_000, "Suppression de l'enfant");
  } catch (e) {
    throwCloud(e, "Impossible de supprimer l'enfant.");
  }
}

export async function cloudUpsertTask(
  familyId: string,
  input: Omit<Task, "id" | "createdAt" | "updatedAt"> & { id?: string }
): Promise<Task> {
  const fid = requireFamilyId(familyId);
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const run = async (): Promise<Task> => {
    if (input.id) {
      const dates = taskDateColumns(input);
      const { data, error } = await supabase
        .from("tasks")
        .update({
          title: input.title,
          child_profile_id: input.childId,
          time_of_day: input.time,
          recurrence: input.recurrence,
          reminder_enabled: input.reminderEnabled,
          active: true,
          interval_weeks: dates.interval_weeks,
          start_date: dates.start_date,
          end_date: dates.end_date,
        })
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throwCloud(error, "Impossible d'enregistrer la tâche.");
      return mapTask(data as DbTask);
    }

    const dates = taskDateColumns(input);
    const row = {
      id: newId(),
      family_id: fid,
      child_profile_id: input.childId,
      title: input.title,
      time_of_day: input.time,
      recurrence: input.recurrence,
      reminder_enabled: input.reminderEnabled,
      active: true,
      interval_weeks: dates.interval_weeks,
      start_date: dates.start_date,
      end_date: dates.end_date,
    };
    const { data, error } = await supabase.from("tasks").insert(row).select("*").single();
    if (error) throwCloud(error, "Impossible d'enregistrer la tâche.");
    const mapped = mapTask(data as DbTask);
    return { ...mapped, createdAt: mapped.createdAt || now, updatedAt: now };
  };

  try {
    return await withCloudTimeout(run(), 15_000, "Enregistrement de la tâche");
  } catch (e) {
    throwCloud(e, "Impossible d'enregistrer la tâche.");
  }
}

export async function cloudDeleteTask(taskId: string): Promise<void> {
  const supabase = getSupabase();

  const run = async (): Promise<void> => {
    await supabase.from("task_completions").delete().eq("task_id", taskId);
    const { error } = await supabase.from("tasks").update({ active: false }).eq("id", taskId);
    if (error) {
      const del = await supabase.from("tasks").delete().eq("id", taskId);
      if (del.error) throwCloud(del.error, "Impossible de supprimer la tâche.");
    }
  };

  try {
    await withCloudTimeout(run(), 15_000, "Suppression de la tâche");
  } catch (e) {
    throwCloud(e, "Impossible de supprimer la tâche.");
  }
}

export async function cloudMarkDone(
  familyId: string,
  taskId: string,
  childId: string,
  date: string,
  photoUri?: string
): Promise<TaskCompletion> {
  const fid = requireFamilyId(familyId);
  const supabase = getSupabase();

  const run = async (): Promise<TaskCompletion> => {
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
      if (error) throwCloud(error, "Impossible de marquer la tâche.");
      return mapCompletion(data as DbTaskCompletion);
    }

    const row = {
      id: newId(),
      family_id: fid,
      task_id: taskId,
      child_profile_id: childId,
      completed_on: date,
      photo_url: photoUri ?? null,
    };
    const { data, error } = await supabase.from("task_completions").insert(row).select("*").single();
    if (error) throwCloud(error, "Impossible de marquer la tâche.");
    return mapCompletion(data as DbTaskCompletion);
  };

  try {
    return await withCloudTimeout(run(), 15_000, "Marquage de la tâche");
  } catch (e) {
    throwCloud(e, "Impossible de marquer la tâche.");
  }
}

export async function cloudUnmarkDone(taskId: string, date: string): Promise<void> {
  const supabase = getSupabase();

  const run = async (): Promise<void> => {
    const { error } = await supabase
      .from("task_completions")
      .delete()
      .eq("task_id", taskId)
      .eq("completed_on", date);
    if (error) throwCloud(error, "Impossible d'annuler la complétion.");
  };

  try {
    await withCloudTimeout(run(), 15_000, "Annulation de la complétion");
  } catch (e) {
    throwCloud(e, "Impossible d'annuler la complétion.");
  }
}

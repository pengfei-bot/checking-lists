import * as Crypto from "expo-crypto";
import { getSupabase } from "../lib/supabase";
import {
  AppState,
  Profile,
  Recurrence,
  RewardChildSettings,
  RewardLedgerEntry,
  RewardLedgerKind,
  RewardSettings,
  RewardTask,
  RewardUnitKind,
  Task,
  TaskCompletion,
} from "../types";
import { colors, childColors } from "../theme/colors";
import { frenchCloudError, withCloudTimeout } from "../utils/cloudTimeout";
import {
  deleteProofPhoto,
  isLocalPhotoUri,
  resolvePhotoDisplayUrls,
  storagePathFromPhotoUrl,
  toStoredPhotoRef,
  uploadProofPhoto,
} from "./proofPhotos";

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
  photo_required: boolean | null;
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

export interface DbRewardSettings {
  family_id: string;
  enabled: boolean;
  unit_label: string;
  updated_at: string;
}

export interface DbRewardChildSettings {
  child_profile_id: string;
  family_id: string;
  unit_kind: string;
  updated_at: string;
}

export interface DbRewardTask {
  id: string;
  family_id: string;
  task_id: string;
  points: number;
  active: boolean;
  created_at: string;
}

export interface DbRewardLedger {
  id: string;
  family_id: string;
  child_profile_id: string;
  amount: number;
  kind: string;
  task_id: string | null;
  completion_id: string | null;
  note: string | null;
  created_by: string | null;
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
    photoRequired: !!row.photo_required,
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

function mapRewardSettings(row: DbRewardSettings): RewardSettings {
  return {
    familyId: row.family_id,
    enabled: !!row.enabled,
    unitLabel: row.unit_label || "⭐",
    updatedAt: row.updated_at,
  };
}

function mapRewardChildSettings(row: DbRewardChildSettings): RewardChildSettings {
  const kind: RewardUnitKind = row.unit_kind === "money" ? "money" : "points";
  return {
    childProfileId: row.child_profile_id,
    familyId: row.family_id,
    unitKind: kind,
    updatedAt: row.updated_at,
  };
}

function mapRewardTask(row: DbRewardTask): RewardTask {
  return {
    id: row.id,
    familyId: row.family_id,
    taskId: row.task_id,
    points: row.points,
    active: !!row.active,
    createdAt: row.created_at,
  };
}

function mapRewardLedger(row: DbRewardLedger): RewardLedgerEntry {
  return {
    id: row.id,
    familyId: row.family_id,
    childProfileId: row.child_profile_id,
    amount: row.amount,
    kind: row.kind as RewardLedgerKind,
    taskId: row.task_id ?? undefined,
    completionId: row.completion_id ?? undefined,
    note: row.note ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
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
    const [kidsRes, tasksRes, compsRes, settingsRes, childSettingsRes, rewardTasksRes, ledgerRes] =
      await Promise.all([
        supabase.from("child_profiles").select("*").eq("family_id", fid).order("created_at"),
        supabase.from("tasks").select("*").eq("family_id", fid).eq("active", true).order("time_of_day"),
        supabase.from("task_completions").select("*").eq("family_id", fid).order("completed_on", {
          ascending: false,
        }),
        supabase.from("reward_settings").select("*").eq("family_id", fid).maybeSingle(),
        supabase.from("reward_child_settings").select("*").eq("family_id", fid),
        supabase.from("reward_tasks").select("*").eq("family_id", fid).order("created_at"),
        supabase
          .from("reward_ledger")
          .select("*")
          .eq("family_id", fid)
          .order("created_at", { ascending: false }),
      ]);

    if (kidsRes.error) throwCloud(kidsRes.error, "Chargement des enfants impossible.");
    if (tasksRes.error) throwCloud(tasksRes.error, "Chargement des tâches impossible.");
    if (compsRes.error) throwCloud(compsRes.error, "Chargement des complétions impossible.");
    if (settingsRes.error) throwCloud(settingsRes.error, "Chargement des récompenses impossible.");
    if (childSettingsRes.error) throwCloud(childSettingsRes.error, "Chargement des unités enfant impossible.");
    if (rewardTasksRes.error) throwCloud(rewardTasksRes.error, "Chargement des points tâches impossible.");
    if (ledgerRes.error) throwCloud(ledgerRes.error, "Chargement du journal récompenses impossible.");

    const kids = (kidsRes.data as DbChildProfile[]).map(mapChild);
    const parent = synthesizeParentProfile(parentDisplayName);
    const tasks = (tasksRes.data as DbTask[]).map(mapTask);
    const rawComps = (compsRes.data as DbTaskCompletion[]) || [];
    const displayMap = await resolvePhotoDisplayUrls(rawComps.map((r) => r.photo_url));
    const completions = rawComps.map((row) => {
      const base = mapCompletion(row);
      if (!row.photo_url) return base;
      const display = displayMap.get(row.photo_url);
      // Keep durable storage ref in photoUri for clear/delete; UI needs signed URL.
      // Prefer signed/display URL when available so Image works cross-device.
      return { ...base, photoUri: display ?? base.photoUri };
    });

    const rewardSettings = settingsRes.data
      ? mapRewardSettings(settingsRes.data as DbRewardSettings)
      : null;
    const rewardChildSettings = ((childSettingsRes.data as DbRewardChildSettings[]) || []).map(
      mapRewardChildSettings
    );
    const rewardTasks = ((rewardTasksRes.data as DbRewardTask[]) || []).map(mapRewardTask);
    const rewardLedger = ((ledgerRes.data as DbRewardLedger[]) || []).map(mapRewardLedger);

    return {
      profiles: [parent, ...kids],
      tasks,
      completions,
      rewardSettings,
      rewardChildSettings,
      rewardTasks,
      rewardLedger,
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
    const dates = taskDateColumns(input);
    const id = input.id || newId();
    const row = {
      id,
      family_id: fid,
      child_profile_id: input.childId,
      title: input.title,
      time_of_day: input.time,
      recurrence: input.recurrence,
      reminder_enabled: input.reminderEnabled,
      photo_required: !!input.photoRequired,
      active: true,
      interval_weeks: dates.interval_weeks,
      start_date: dates.start_date,
      end_date: dates.end_date,
    };
    // Upsert so offline-created tasks keep their client id on flush.
    const { data, error } = await supabase
      .from("tasks")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();
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
  photoUri?: string,
  opts?: { completionId?: string }
): Promise<TaskCompletion> {
  const fid = requireFamilyId(familyId);
  const supabase = getSupabase();

  const run = async (): Promise<TaskCompletion> => {
    let durablePhoto: string | null | undefined = undefined;
    if (photoUri !== undefined) {
      if (!photoUri) {
        durablePhoto = null;
      } else if (isLocalPhotoUri(photoUri)) {
        durablePhoto = await uploadProofPhoto({
          familyId: fid,
          childId,
          taskId,
          date,
          localUri: photoUri,
        });
      } else {
        // Already a storage ref or remote URL — normalize to storage ref when possible
        const path = storagePathFromPhotoUrl(photoUri);
        durablePhoto = path ? toStoredPhotoRef(path) : photoUri;
      }
    }

    const existing = await supabase
      .from("task_completions")
      .select("*")
      .eq("task_id", taskId)
      .eq("completed_on", date)
      .maybeSingle();

    if (existing.data) {
      const prev = existing.data as DbTaskCompletion;
      const nextPhoto =
        durablePhoto !== undefined ? durablePhoto : prev.photo_url;
      if (
        durablePhoto !== undefined &&
        prev.photo_url &&
        prev.photo_url !== nextPhoto
      ) {
        await deleteProofPhoto(prev.photo_url);
      }
      const { data, error } = await supabase
        .from("task_completions")
        .update({ photo_url: nextPhoto })
        .eq("id", prev.id)
        .select("*")
        .single();
      if (error) throwCloud(error, "Impossible de marquer la tâche.");
      const mapped = mapCompletion(data as DbTaskCompletion);
      if (mapped.photoUri) {
        const display = (await resolvePhotoDisplayUrls([mapped.photoUri])).get(mapped.photoUri);
        if (display) mapped.photoUri = display;
      }
      return mapped;
    }

    const row = {
      id: opts?.completionId || newId(),
      family_id: fid,
      task_id: taskId,
      child_profile_id: childId,
      completed_on: date,
      photo_url: durablePhoto ?? null,
    };
    const { data, error } = await supabase.from("task_completions").insert(row).select("*").single();
    if (error) throwCloud(error, "Impossible de marquer la tâche.");
    const mapped = mapCompletion(data as DbTaskCompletion);
    if (mapped.photoUri) {
      const display = (await resolvePhotoDisplayUrls([mapped.photoUri])).get(mapped.photoUri);
      if (display) mapped.photoUri = display;
    }
    return mapped;
  };

  try {
    return await withCloudTimeout(run(), 60_000, "Marquage de la tâche");
  } catch (e) {
    throwCloud(e, "Impossible de marquer la tâche.");
  }
}

export async function cloudUnmarkDone(taskId: string, date: string): Promise<void> {
  const supabase = getSupabase();

  const run = async (): Promise<void> => {
    const existing = await supabase
      .from("task_completions")
      .select("id, photo_url")
      .eq("task_id", taskId)
      .eq("completed_on", date)
      .maybeSingle();
    if (existing.data) {
      await deleteProofPhoto((existing.data as { photo_url: string | null }).photo_url);
    }
    const { error } = await supabase
      .from("task_completions")
      .delete()
      .eq("task_id", taskId)
      .eq("completed_on", date);
    if (error) throwCloud(error, "Impossible d'annuler la complétion.");
  };

  try {
    await withCloudTimeout(run(), 20_000, "Annulation de la complétion");
  } catch (e) {
    throwCloud(e, "Impossible d'annuler la complétion.");
  }
}

export async function cloudClearCompletionPhoto(completionId: string): Promise<void> {
  const supabase = getSupabase();
  const run = async (): Promise<void> => {
    const existing = await supabase
      .from("task_completions")
      .select("photo_url")
      .eq("id", completionId)
      .maybeSingle();
    if (existing.data) {
      await deleteProofPhoto((existing.data as { photo_url: string | null }).photo_url);
    }
    const { error } = await supabase
      .from("task_completions")
      .update({ photo_url: null })
      .eq("id", completionId);
    if (error) throwCloud(error, "Impossible de retirer la photo.");
  };
  try {
    await withCloudTimeout(run(), 20_000, "Retrait de la photo");
  } catch (e) {
    throwCloud(e, "Impossible de retirer la photo.");
  }
}

export async function cloudUpsertRewardSettings(
  familyId: string,
  input: { enabled: boolean; unitLabel?: string }
): Promise<RewardSettings> {
  const fid = requireFamilyId(familyId);
  const supabase = getSupabase();
  const now = new Date().toISOString();

  const run = async (): Promise<RewardSettings> => {
    let unitLabel = input.unitLabel;
    if (unitLabel === undefined) {
      const existing = await supabase
        .from("reward_settings")
        .select("unit_label")
        .eq("family_id", fid)
        .maybeSingle();
      if (existing.error) throwCloud(existing.error, "Impossible de lire les récompenses.");
      unitLabel = (existing.data as { unit_label?: string } | null)?.unit_label || "⭐";
    }
    const row = {
      family_id: fid,
      enabled: !!input.enabled,
      unit_label: (unitLabel ?? "⭐").trim() || "⭐",
      updated_at: now,
    };
    const { data, error } = await supabase
      .from("reward_settings")
      .upsert(row, { onConflict: "family_id" })
      .select("*")
      .single();
    if (error) throwCloud(error, "Impossible d'enregistrer les récompenses.");
    return mapRewardSettings(data as DbRewardSettings);
  };

  try {
    return await withCloudTimeout(run(), 15_000, "Récompenses");
  } catch (e) {
    throwCloud(e, "Impossible d'enregistrer les récompenses.");
  }
}

/** Ensure a settings row exists (defaults: enabled, ⭐). */
export async function cloudEnsureRewardSettings(familyId: string): Promise<RewardSettings> {
  const fid = requireFamilyId(familyId);
  const supabase = getSupabase();

  const run = async (): Promise<RewardSettings> => {
    const existing = await supabase
      .from("reward_settings")
      .select("*")
      .eq("family_id", fid)
      .maybeSingle();
    if (existing.error) throwCloud(existing.error, "Impossible de lire les récompenses.");
    if (existing.data) return mapRewardSettings(existing.data as DbRewardSettings);
    const { data, error } = await supabase
      .from("reward_settings")
      .insert({ family_id: fid, enabled: true, unit_label: "⭐" })
      .select("*")
      .single();
    if (error) throwCloud(error, "Impossible d'activer les récompenses.");
    return mapRewardSettings(data as DbRewardSettings);
  };

  try {
    return await withCloudTimeout(run(), 15_000, "Activation récompenses");
  } catch (e) {
    throwCloud(e, "Impossible d'activer les récompenses.");
  }
}

export async function cloudUpsertRewardTask(
  familyId: string,
  input: { taskId: string; points: number; active?: boolean; id?: string }
): Promise<RewardTask> {
  const fid = requireFamilyId(familyId);
  const supabase = getSupabase();
  const points = Math.floor(input.points);
  if (!(points > 0)) {
    throw new Error("Les points doivent être un entier positif.");
  }

  const run = async (): Promise<RewardTask> => {
    const existing = await supabase
      .from("reward_tasks")
      .select("*")
      .eq("task_id", input.taskId)
      .maybeSingle();
    if (existing.error) throwCloud(existing.error, "Impossible de lire les points.");

    const id = input.id || (existing.data as DbRewardTask | null)?.id || newId();
    const row = {
      id,
      family_id: fid,
      task_id: input.taskId,
      points,
      active: input.active !== undefined ? !!input.active : true,
    };
    const { data, error } = await supabase
      .from("reward_tasks")
      .upsert(row, { onConflict: "task_id" })
      .select("*")
      .single();
    if (error) throwCloud(error, "Impossible d'enregistrer les points.");
    return mapRewardTask(data as DbRewardTask);
  };

  try {
    return await withCloudTimeout(run(), 15_000, "Points tâche");
  } catch (e) {
    throwCloud(e, "Impossible d'enregistrer les points.");
  }
}

export async function cloudDeleteRewardTask(taskId: string): Promise<void> {
  const supabase = getSupabase();
  const run = async (): Promise<void> => {
    const { error } = await supabase.from("reward_tasks").delete().eq("task_id", taskId);
    if (error) throwCloud(error, "Impossible de retirer les points.");
  };
  try {
    await withCloudTimeout(run(), 15_000, "Suppression points");
  } catch (e) {
    throwCloud(e, "Impossible de retirer les points.");
  }
}

export async function cloudInsertRewardLedger(
  familyId: string,
  input: {
    childProfileId: string;
    amount: number;
    kind: RewardLedgerKind;
    taskId?: string;
    completionId?: string;
    note?: string;
    id?: string;
  }
): Promise<RewardLedgerEntry> {
  const fid = requireFamilyId(familyId);
  const supabase = getSupabase();

  const run = async (): Promise<RewardLedgerEntry> => {
    if (input.kind === "earn" && input.completionId) {
      const existing = await supabase
        .from("reward_ledger")
        .select("*")
        .eq("completion_id", input.completionId)
        .eq("kind", "earn")
        .maybeSingle();
      if (existing.error) throwCloud(existing.error, "Impossible de vérifier le journal.");
      if (existing.data) return mapRewardLedger(existing.data as DbRewardLedger);
    }

    const row = {
      id: input.id || newId(),
      family_id: fid,
      child_profile_id: input.childProfileId,
      amount: input.amount,
      kind: input.kind,
      task_id: input.taskId ?? null,
      completion_id: input.completionId ?? null,
      note: input.note ?? null,
    };
    const { data, error } = await supabase.from("reward_ledger").insert(row).select("*").single();
    if (error) throwCloud(error, "Impossible d'écrire dans le journal récompenses.");
    return mapRewardLedger(data as DbRewardLedger);
  };

  try {
    return await withCloudTimeout(run(), 15_000, "Journal récompenses");
  } catch (e) {
    throwCloud(e, "Impossible d'écrire dans le journal récompenses.");
  }
}

export async function cloudUpsertRewardChildSettings(
  familyId: string,
  childProfileId: string,
  unitKind: RewardUnitKind
): Promise<RewardChildSettings> {
  const fid = requireFamilyId(familyId);
  const supabase = getSupabase();
  const kind: RewardUnitKind = unitKind === "money" ? "money" : "points";
  const now = new Date().toISOString();
  const row = {
    child_profile_id: childProfileId,
    family_id: fid,
    unit_kind: kind,
    updated_at: now,
  };

  const run = async (): Promise<RewardChildSettings> => {
    const { data, error } = await supabase
      .from("reward_child_settings")
      .upsert(row, { onConflict: "child_profile_id" })
      .select("*")
      .single();
    if (error) throwCloud(error, "Impossible d'enregistrer l'unité enfant.");
    return mapRewardChildSettings(data as DbRewardChildSettings);
  };

  try {
    return await withCloudTimeout(run(), 15_000, "Unité enfant");
  } catch (e) {
    throwCloud(e, "Impossible d'enregistrer l'unité enfant.");
  }
}

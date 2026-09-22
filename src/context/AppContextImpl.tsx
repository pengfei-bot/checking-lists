import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState as RnAppState, AppStateStatus, Platform } from "react-native";
import { useAuth } from "../auth";
import { loadCloudStateCache, saveCloudStateCache } from "../data/cloudCache";
import {
  cloudClearCompletionPhoto,
  cloudDeleteChild,
  cloudDeleteRewardTask,
  cloudDeleteTask,
  cloudEnsureRewardSettings,
  cloudInsertChild,
  cloudInsertRewardLedger,
  cloudMarkDone,
  cloudUnmarkDone,
  cloudUpdateChild,
  cloudUpsertRewardChildSettings,
  cloudUpsertRewardSettings,
  cloudUpsertRewardTask,
  cloudUpsertTask,
  loadCloudAppState,
} from "../data/cloudSync";
import { flushMutationQueue } from "../data/flushMutationQueue";
import {
  enqueueMutation,
  loadMutationQueue,
  taskInputForQueue,
} from "../data/mutationQueue";
import { loadAppState, resetDemoData, saveAppState } from "../data/storage";
import { loadLastProfileId, saveLastProfileId } from "../data/lastProfile";
import { rescheduleTodayReminders } from "../services/notifications";
import { childColors } from "../theme/colors";
import {
  AppState,
  Profile,
  RewardChildSettings,
  RewardLedgerEntry,
  RewardSettings,
  RewardTask,
  RewardUnitKind,
  Task,
  TaskCompletion,
} from "../types";
import {
  balanceForChild,
  buildEarnForCompletion,
  buildVoidAdjustForCompletion,
  emptyRewardsState,
  isRewardsActiveForChild as isRewardsActiveForChildUtil,
  ledgerForChild,
  pointsForTask,
  unitKindForChild,
} from "../utils/rewards";
import { frenchCloudError } from "../utils/cloudTimeout";
import { probeOnline } from "../utils/connectivity";
import { isCloudNetworkError } from "../utils/networkError";
import { todayISO, uid } from "../utils/dates";
import { isTaskForDate } from "../utils/recurrence";
import * as Crypto from "expo-crypto";

/** UUID for cloud rows (task_completions.id / tasks.id are uuid). */
function newCloudId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return Crypto.randomUUID();
}

interface AppContextValue {
  ready: boolean;
  state: AppState;
  currentProfile: Profile | null;
  childrenProfiles: Profile[];
  parentProfile: Profile | null;
  cloudSync: boolean;
  /** True when UI is serving cached cloud data (offline or before refresh). */
  usingCache: boolean;
  isSyncing: boolean;
  syncError: string | null;
  cacheSavedAt: string | null;
  /** Pending offline writes waiting to flush. */
  pendingMutations: number;
  setCurrentProfileId: (id: string | null) => void;
  tasksForChildToday: (childId: string) => Task[];
  completionFor: (taskId: string, date?: string) => TaskCompletion | undefined;
  markTaskDone: (taskId: string, childId: string, photoUri?: string) => Promise<void>;
  unmarkTaskDone: (taskId: string, date?: string) => Promise<void>;
  /** Remove photo proof from a completion (UGC report / moderation). */
  clearCompletionPhoto: (completionId: string) => Promise<void>;
  upsertTask: (input: Omit<Task, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  addChild: (input: { name: string; emoji?: string; color?: string }) => Promise<Profile>;
  updateChild: (id: string, input: { name: string; emoji?: string; color?: string }) => Promise<Profile | undefined>;
  deleteChild: (id: string) => Promise<void>;
  getTask: (taskId: string) => Task | undefined;
  getProfile: (id: string) => Profile | undefined;
  resetDemo: () => Promise<void>;
  refreshReminders: () => Promise<number>;
  reloadFromCloud: () => Promise<void>;
  /** Rewards MVP */
  rewardSettings: RewardSettings | null;
  rewardChildSettings: RewardChildSettings[];
  rewardTasks: RewardTask[];
  rewardLedger: RewardLedgerEntry[];
  rewardsEnabled: boolean;
  /** @deprecated Prefer unitKindFor / display via i18n short keys. */
  unitLabel: string;
  /** True when this child has rewards enabled (and family master not off). */
  isRewardsActiveForChild: (childId: string) => boolean;
  balanceFor: (childId: string) => number;
  ledgerByChild: (childId: string) => RewardLedgerEntry[];
  pointsFor: (taskId: string) => number | null;
  unitKindFor: (childId: string) => RewardUnitKind;
  updateRewardSettings: (input: { enabled: boolean; unitLabel?: string }) => Promise<RewardSettings>;
  setChildUnitKind: (childId: string, unitKind: RewardUnitKind) => Promise<RewardChildSettings>;
  setChildRewardsEnabled: (childId: string, enabled: boolean) => Promise<RewardChildSettings>;
  upsertChildRewardSettings: (
    childId: string,
    input: { unitKind?: RewardUnitKind; enabled?: boolean }
  ) => Promise<RewardChildSettings>;
  /**
   * Create missing reward_child_settings rows (enabled:true, points) when family
   * rewards master is on — heals DJRUNV-like gaps and new kids.
   */
  ensureMissingChildRewardSettings: () => Promise<void>;
  setTaskPoints: (taskId: string, points: number | null) => Promise<void>;
  resetChildBalance: (childId: string, note?: string) => Promise<RewardLedgerEntry | null>;
}

const AppContext = createContext<AppContextValue | null>(null);
const emptyState: AppState = {
  profiles: [],
  tasks: [],
  completions: [],
  rewardSettings: null,
  rewardChildSettings: [],
  rewardTasks: [],
  rewardLedger: [],
  seeded: false,
  currentProfileId: null,
};

async function safeReminders(
  tasks: Task[],
  profiles: Profile[],
  currentProfileId?: string | null
) {
  const active =
    currentProfileId != null
      ? profiles.find((p) => p.id === currentProfileId) ?? null
      : null;
  try {
    await rescheduleTodayReminders(tasks, profiles, active);
  } catch {
    /* ignore */
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { ready: authReady, session, isDemo, isCloud } = useAuth();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(emptyState);
  const [usingCache, setUsingCache] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cacheSavedAt, setCacheSavedAt] = useState<string | null>(null);
  const [pendingMutations, setPendingMutations] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const familyId = isCloud ? session?.familyId ?? null : null;
  const cloudSync = !!familyId;
  const syncingRef = useRef(false);
  const flushingRef = useRef(false);

  const refreshPendingCount = useCallback(async (fid: string) => {
    const q = await loadMutationQueue(fid);
    setPendingMutations(q.length);
  }, []);

  const applyRememberedProfile = useCallback(async (loaded: AppState) => {
    const remembered = await loadLastProfileId();
    const currentProfileId =
      remembered && loaded.profiles.some((p) => p.id === remembered) ? remembered : null;
    return { ...loaded, currentProfileId };
  }, []);

  const cacheCloudSnapshot = useCallback(async (next: AppState) => {
    if (!familyId) return;
    await saveCloudStateCache(familyId, next);
    setCacheSavedAt(new Date().toISOString());
  }, [familyId]);

  const pullCloud = useCallback(async (fid: string, opts?: { background?: boolean }) => {
    const background = !!opts?.background;
    if (syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    if (!background) setSyncError(null);
    try {
      const loaded = await loadCloudAppState(
        fid,
        session?.displayName || session?.email || "Parent"
      );
      let next = await applyRememberedProfile(loaded);
      // Auto-heal: family rewards on but children lack reward_child_settings rows.
      if (next.rewardSettings?.enabled) {
        const have = new Set(
          (next.rewardChildSettings ?? []).map((s) => s.childProfileId)
        );
        const missing = next.profiles.filter(
          (p) => p.role === "child" && !have.has(p.id)
        );
        if (missing.length > 0) {
          let settings = [...(next.rewardChildSettings ?? [])];
          for (const child of missing) {
            try {
              const saved = await cloudUpsertRewardChildSettings(fid, child.id, {
                enabled: true,
                unitKind: "points",
              });
              settings = settings.filter((s) => s.childProfileId !== child.id);
              settings.push(saved);
            } catch {
              /* RewardsScreen ensure can retry */
            }
          }
          next = { ...next, rewardChildSettings: settings };
        }
      }
      setState(next);
      stateRef.current = next;
      await saveCloudStateCache(fid, next);
      setCacheSavedAt(new Date().toISOString());
      setUsingCache(false);
      setSyncError(null);
      await safeReminders(next.tasks, next.profiles, next.currentProfileId);
    } catch (e) {
      const msg = frenchCloudError(e, "Chargement cloud impossible.");
      setSyncError(msg);
      throw e;
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [applyRememberedProfile, session?.displayName, session?.email]);

  const flushPending = useCallback(async (fid: string): Promise<boolean> => {
    if (flushingRef.current) return false;
    flushingRef.current = true;
    try {
      const result = await flushMutationQueue(fid);
      setPendingMutations(result.remaining);
      if (result.error) {
        setSyncError(result.error);
        return false;
      }
      return true;
    } finally {
      flushingRef.current = false;
    }
  }, []);

  const syncWhenOnline = useCallback(async (fid: string, opts?: { background?: boolean }) => {
    const online = await probeOnline(2_500);
    if (!online) {
      setSyncError("offline");
      await refreshPendingCount(fid);
      return false;
    }
    const ok = await flushPending(fid);
    if (!ok) return false;
    try {
      await pullCloud(fid, opts);
      return true;
    } catch {
      return false;
    }
  }, [flushPending, pullCloud, refreshPendingCount]);

  const load = useCallback(async () => {
    if (!authReady) return;
    setReady(false);
    setSyncError(null);
    try {
      if (familyId) {
        await refreshPendingCount(familyId);
        const cached = await loadCloudStateCache(familyId);
        if (cached) {
          const next = await applyRememberedProfile(cached.state);
          setState(next);
          stateRef.current = next;
          setCacheSavedAt(cached.savedAt);
          setUsingCache(true);
          setReady(true);
          await safeReminders(next.tasks, next.profiles, next.currentProfileId);
        }

        const online = await probeOnline(2_500);
        if (!online) {
          setSyncError("offline");
          if (!cached) {
            setState(emptyState);
            setUsingCache(false);
            setCacheSavedAt(null);
          }
          return;
        }

        try {
          await flushPending(familyId);
          await pullCloud(familyId, { background: !!cached });
        } catch {
          if (!cached) {
            setState(emptyState);
            setUsingCache(false);
            setCacheSavedAt(null);
          }
        }
      } else {
        setUsingCache(false);
        setCacheSavedAt(null);
        setPendingMutations(0);
        const remembered = await loadLastProfileId();
        const loaded = await loadAppState();
        const currentProfileId =
          (remembered && loaded.profiles.some((p) => p.id === remembered)
            ? remembered
            : loaded.currentProfileId) ?? null;
        if (currentProfileId !== loaded.currentProfileId) {
          const next = { ...loaded, currentProfileId };
          setState(next);
          await saveAppState(next);
          await safeReminders(next.tasks, next.profiles, next.currentProfileId);
        } else {
          setState(loaded);
          await safeReminders(loaded.tasks, loaded.profiles, loaded.currentProfileId);
        }
      }
    } catch {
      /* keep previous state; UI must leave the loading gate */
    } finally {
      setReady(true);
    }
  }, [authReady, familyId, applyRememberedProfile, pullCloud, flushPending, refreshPendingCount]);

  useEffect(() => { void load(); }, [load]);

  // Re-sync when app returns to foreground (network may be back).
  useEffect(() => {
    if (!familyId || !authReady) return;
    const onChange = (next: AppStateStatus) => {
      if (next !== "active") return;
      void syncWhenOnline(familyId, { background: true });
    };
    const sub = RnAppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [familyId, authReady, syncWhenOnline]);

  // Web: navigator online/offline so pending banner appears without waiting for AppState.
  useEffect(() => {
    if (!familyId || !authReady) return;
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onOffline = () => {
      setSyncError("offline");
      void refreshPendingCount(familyId);
    };
    const onOnline = () => {
      void syncWhenOnline(familyId, { background: true });
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      onOffline();
    }
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [familyId, authReady, syncWhenOnline, refreshPendingCount]);

  const persistLocal = useCallback(async (next: AppState) => {
    setState(next);
    if (!familyId) await saveAppState(next);
  }, [familyId]);

  const currentProfile = useMemo(() => state.profiles.find((p) => p.id === state.currentProfileId) ?? null, [state.profiles, state.currentProfileId]);
  const childrenProfiles = useMemo(() => state.profiles.filter((p) => p.role === "child"), [state.profiles]);
  const parentProfile = useMemo(() => state.profiles.find((p) => p.role === "parent") ?? null, [state.profiles]);
  /** Profile switch must stay local+instant: never trigger cloud reload. */
  const setCurrentProfileId = useCallback((id: string | null) => {
    void saveLastProfileId(id);
    setState((prev) => {
      if (prev.currentProfileId === id) return prev;
      const next = { ...prev, currentProfileId: id };
      stateRef.current = next;
      // Local/demo only: persist roster. Cloud keeps currentProfileId in lastProfile + memory.
      if (!familyId) void saveAppState(next);
      // Clear other kids' alerts and reschedule for the newly active profile.
      void safeReminders(next.tasks, next.profiles, id);
      return next;
    });
  }, [familyId]);
  const tasksForChildToday = useCallback((childId: string) => state.tasks.filter((t) => t.childId === childId && isTaskForDate(t)).sort((a, b) => a.time.localeCompare(b.time)), [state.tasks]);
  const completionFor = useCallback((taskId: string, date = todayISO()) => state.completions.find((c) => c.taskId === taskId && c.date === date), [state.completions]);

  const markTaskDone = useCallback(async (taskId: string, childId: string, photoUri?: string) => {
    const date = todayISO();
    const applyLocalMark = (prev: AppState, saved: TaskCompletion): AppState => {
      const completions = [
        ...prev.completions.filter((c) => !(c.taskId === taskId && c.date === date)),
        saved,
      ];
      let rewardLedger = prev.rewardLedger ?? [];
      const fid = familyId || prev.rewardSettings?.familyId || "local";
      const earn = buildEarnForCompletion(
        rewardLedger,
        prev.rewardTasks ?? [],
        prev.rewardChildSettings ?? [],
        prev.rewardSettings,
        saved,
        fid,
        newCloudId(),
        saved.completedAt
      );
      if (earn) {
        rewardLedger = [earn, ...rewardLedger];
      }
      return { ...prev, completions, rewardLedger };
    };

    if (familyId) {
      const online = await probeOnline(2_000);
      if (online) {
        try {
          const saved = await cloudMarkDone(familyId, taskId, childId, date, photoUri);
          // DB trigger credits earn; mirror locally for immediate solde update.
          const next = applyLocalMark(stateRef.current, saved);
          stateRef.current = next;
          setState(next);
          void cacheCloudSnapshot(next);
          // Opportunistic flush of any older queued ops
          void flushPending(familyId);
          return;
        } catch (e) {
          // Fall through to queue if network died mid-request
          const msg = frenchCloudError(e, "");
          if (!isCloudNetworkError(msg)) {
            throw e;
          }
        }
      }

      const completionId = newCloudId();
      const saved: TaskCompletion = {
        id: completionId,
        taskId,
        childId,
        date,
        completedAt: new Date().toISOString(),
        photoUri,
      };
      const next = applyLocalMark(stateRef.current, saved);
      stateRef.current = next;
      setState(next);
      void cacheCloudSnapshot(next);
      const q = await enqueueMutation(familyId, {
        type: "markDone",
        taskId,
        childId,
        date,
        completionId,
        localPhotoUri: photoUri,
      });
      setPendingMutations(q.length);
      setUsingCache(true);
      setSyncError("offline");
      return;
    }
    const existing = state.completions.find((c) => c.taskId === taskId && c.date === date);
    const saved: TaskCompletion = existing
      ? {
          ...existing,
          completedAt: new Date().toISOString(),
          photoUri: photoUri ?? existing.photoUri,
        }
      : {
          id: uid("done"),
          taskId,
          childId,
          date,
          completedAt: new Date().toISOString(),
          photoUri,
        };
    await persistLocal(applyLocalMark(state, saved));
  }, [familyId, persistLocal, state, cacheCloudSnapshot, flushPending]);

  const unmarkTaskDone = useCallback(async (taskId: string, date = todayISO()) => {
    const applyLocalUnmark = (prev: AppState): AppState => {
      const completion = prev.completions.find((c) => c.taskId === taskId && c.date === date);
      const completions = prev.completions.filter((c) => !(c.taskId === taskId && c.date === date));
      let rewardLedger = prev.rewardLedger ?? [];
      if (completion) {
        const fid = familyId || prev.rewardSettings?.familyId || "local";
        const voidEntry = buildVoidAdjustForCompletion(
          rewardLedger,
          completion,
          fid,
          newCloudId()
        );
        if (voidEntry) {
          rewardLedger = [voidEntry, ...rewardLedger];
        }
      }
      return { ...prev, completions, rewardLedger };
    };

    if (familyId) {
      const online = await probeOnline(2_000);
      if (online) {
        try {
          await cloudUnmarkDone(taskId, date);
          // DB trigger voids credited earn; mirror locally for immediate solde update.
          const next = applyLocalUnmark(stateRef.current);
          stateRef.current = next;
          setState(next);
          void cacheCloudSnapshot(next);
          void flushPending(familyId);
          return;
        } catch (e) {
          const msg = frenchCloudError(e, "");
          if (!isCloudNetworkError(msg)) {
            throw e;
          }
        }
      }

      const next = applyLocalUnmark(stateRef.current);
      stateRef.current = next;
      setState(next);
      void cacheCloudSnapshot(next);
      const q = await enqueueMutation(familyId, { type: "unmarkDone", taskId, date });
      setPendingMutations(q.length);
      setUsingCache(true);
      setSyncError("offline");
      return;
    }
    await persistLocal(applyLocalUnmark(state));
  }, [familyId, persistLocal, state, cacheCloudSnapshot, flushPending]);

  const clearCompletionPhoto = useCallback(async (completionId: string) => {
    if (familyId) {
      const online = await probeOnline(2_000);
      if (online) {
        try {
          await cloudClearCompletionPhoto(completionId);
          const next = {
            ...stateRef.current,
            completions: stateRef.current.completions.map((c) =>
              c.id === completionId ? { ...c, photoUri: undefined } : c
            ),
          };
          stateRef.current = next;
          setState(next);
          void cacheCloudSnapshot(next);
          void flushPending(familyId);
          return;
        } catch (e) {
          const msg = frenchCloudError(e, "");
          if (!isCloudNetworkError(msg)) {
            throw e;
          }
        }
      }

      const next = {
        ...stateRef.current,
        completions: stateRef.current.completions.map((c) =>
          c.id === completionId ? { ...c, photoUri: undefined } : c
        ),
      };
      stateRef.current = next;
      setState(next);
      void cacheCloudSnapshot(next);
      const q = await enqueueMutation(familyId, { type: "clearCompletionPhoto", completionId });
      setPendingMutations(q.length);
      setUsingCache(true);
      setSyncError("offline");
      return;
    }
    await persistLocal({
      ...state,
      completions: state.completions.map((c) =>
        c.id === completionId ? { ...c, photoUri: undefined } : c
      ),
    });
  }, [familyId, persistLocal, state, cacheCloudSnapshot, flushPending]);

  const upsertTask = useCallback(async (input: Omit<Task, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Task> => {
    if (familyId) {
      const online = await probeOnline(2_000);
      if (online) {
        try {
          const saved = await cloudUpsertTask(familyId, input);
          if (input.onceDate) saved.onceDate = input.onceDate;
          if (input.startDate !== undefined) saved.startDate = input.startDate;
          if (input.endDate !== undefined) saved.endDate = input.endDate;
          if (input.intervalWeeks !== undefined) saved.intervalWeeks = input.intervalWeeks;
          const prev = stateRef.current;
          const tasks = input.id ? prev.tasks.map((t) => (t.id === saved.id ? saved : t)) : [...prev.tasks, saved];
          const next = { ...prev, tasks };
          stateRef.current = next;
          setState(next);
          void cacheCloudSnapshot(next);
          await safeReminders(next.tasks, next.profiles, next.currentProfileId);
          void flushPending(familyId);
          return saved;
        } catch (e) {
          const msg = frenchCloudError(e, "");
          if (!isCloudNetworkError(msg)) {
            throw e;
          }
        }
      }

      const now = new Date().toISOString();
      const prev = stateRef.current;
      const id = input.id || newCloudId();
      let saved: Task;
      if (input.id) {
        const existing = prev.tasks.find((t) => t.id === input.id);
        saved = {
          id,
          title: input.title,
          childId: input.childId,
          time: input.time,
          recurrence: input.recurrence,
          reminderEnabled: input.reminderEnabled,
          photoRequired: !!input.photoRequired,
          onceDate: input.onceDate,
          startDate: input.startDate,
          endDate: input.endDate,
          intervalWeeks: input.intervalWeeks,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
      } else {
        saved = {
          id,
          title: input.title,
          childId: input.childId,
          time: input.time,
          recurrence: input.recurrence,
          reminderEnabled: input.reminderEnabled,
          photoRequired: !!input.photoRequired,
          onceDate: input.onceDate,
          startDate: input.startDate,
          endDate: input.endDate,
          intervalWeeks: input.intervalWeeks,
          createdAt: now,
          updatedAt: now,
        };
      }
      const tasks = input.id
        ? prev.tasks.map((t) => (t.id === id ? saved : t))
        : [...prev.tasks, saved];
      const next = { ...prev, tasks };
      stateRef.current = next;
      setState(next);
      void cacheCloudSnapshot(next);
      await safeReminders(next.tasks, next.profiles, next.currentProfileId);
      const q = await enqueueMutation(familyId, {
        type: "upsertTask",
        input: taskInputForQueue({ ...input, id }),
      });
      setPendingMutations(q.length);
      setUsingCache(true);
      setSyncError("offline");
      return saved;
    }

    const now = new Date().toISOString();
    const prev = stateRef.current;
    let saved!: Task;
    let tasks: Task[];
    if (input.id) {
      tasks = prev.tasks.map((t) => {
        if (t.id !== input.id) return t;
        saved = { ...t, ...input, id: t.id, createdAt: t.createdAt, updatedAt: now };
        return saved;
      });
    } else {
      saved = {
        id: uid("task"),
        title: input.title,
        childId: input.childId,
        time: input.time,
        recurrence: input.recurrence,
        reminderEnabled: input.reminderEnabled,
        photoRequired: !!input.photoRequired,
        onceDate: input.onceDate,
        startDate: input.startDate,
        endDate: input.endDate,
        intervalWeeks: input.intervalWeeks,
        createdAt: now,
        updatedAt: now,
      };
      tasks = [...prev.tasks, saved];
    }
    const next = { ...prev, tasks };
    stateRef.current = next;
    await persistLocal(next);
    await safeReminders(next.tasks, next.profiles, next.currentProfileId);
    return saved;
  }, [familyId, persistLocal, cacheCloudSnapshot, flushPending]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (familyId) {
      const online = await probeOnline(2_000);
      if (online) {
        try {
          await cloudDeleteTask(taskId);
          const prev = stateRef.current;
          const next = {
            ...prev,
            tasks: prev.tasks.filter((t) => t.id !== taskId),
            completions: prev.completions.filter((c) => c.taskId !== taskId),
            rewardTasks: (prev.rewardTasks ?? []).filter((r) => r.taskId !== taskId),
          };
          stateRef.current = next;
          setState(next);
          void cacheCloudSnapshot(next);
          await safeReminders(next.tasks, next.profiles, next.currentProfileId);
          void flushPending(familyId);
          return;
        } catch (e) {
          const msg = frenchCloudError(e, "");
          if (!isCloudNetworkError(msg)) {
            throw e;
          }
        }
      }

      const prev = stateRef.current;
      const next = {
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
        completions: prev.completions.filter((c) => c.taskId !== taskId),
        rewardTasks: (prev.rewardTasks ?? []).filter((r) => r.taskId !== taskId),
      };
      stateRef.current = next;
      setState(next);
      void cacheCloudSnapshot(next);
      await safeReminders(next.tasks, next.profiles, next.currentProfileId);
      const q = await enqueueMutation(familyId, { type: "deleteTask", taskId });
      setPendingMutations(q.length);
      setUsingCache(true);
      setSyncError("offline");
      return;
    }
    const prev = stateRef.current;
    const next = {
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
      completions: prev.completions.filter((c) => c.taskId !== taskId),
      rewardTasks: (prev.rewardTasks ?? []).filter((r) => r.taskId !== taskId),
    };
    stateRef.current = next;
    await persistLocal(next);
    await safeReminders(next.tasks, next.profiles, next.currentProfileId);
  }, [familyId, persistLocal, cacheCloudSnapshot, flushPending]);

  const addChild = useCallback(async (input: { name: string; emoji?: string; color?: string }): Promise<Profile> => {
    const kids = state.profiles.filter((p) => p.role === "child");
    const color = input.color?.trim() || childColors[kids.length % childColors.length] || childColors[0];
    if (isCloud && !familyId) {
      throw new Error("Famille cloud introuvable (family_id manquant). Reconnectez-vous après l'inscription.");
    }
    if (familyId) {
      // Child profile CRUD stays online-only for MVP (not in priority #1 queue set).
      const online = await probeOnline(2_000);
      if (!online) {
        throw new Error("Cette action nécessite une connexion Internet.");
      }
      const profile = await cloudInsertChild(familyId, { name: input.name, emoji: input.emoji, color });
      let childSettingsExtra: RewardChildSettings | null = null;
      if (stateRef.current.rewardSettings?.enabled) {
        try {
          childSettingsExtra = await cloudUpsertRewardChildSettings(familyId, profile.id, {
            enabled: true,
            unitKind: "points",
          });
        } catch {
          /* ensure on Rewards open will retry */
        }
      }
      setState((prev) => {
        const list = prev.rewardChildSettings ?? [];
        const rewardChildSettings =
          childSettingsExtra && !list.some((s) => s.childProfileId === profile.id)
            ? [...list, childSettingsExtra]
            : childSettingsExtra
              ? list.map((s) =>
                  s.childProfileId === profile.id ? childSettingsExtra! : s
                )
              : list;
        const next = {
          ...prev,
          profiles: [...prev.profiles, profile],
          rewardChildSettings,
        };
        stateRef.current = next;
        void cacheCloudSnapshot(next);
        return next;
      });
      return profile;
    }
    const profile: Profile = { id: uid("profile_child"), name: input.name.trim(), role: "child", emoji: input.emoji?.trim() || "🌟", color };
    const prev = stateRef.current;
    let rewardChildSettings = prev.rewardChildSettings ?? [];
    if (prev.rewardSettings?.enabled && !rewardChildSettings.some((s) => s.childProfileId === profile.id)) {
      rewardChildSettings = [
        ...rewardChildSettings,
        {
          childProfileId: profile.id,
          familyId: prev.rewardSettings.familyId || "local",
          unitKind: "points" as const,
          enabled: true,
          updatedAt: new Date().toISOString(),
        },
      ];
    }
    await persistLocal({
      ...prev,
      profiles: [...prev.profiles, profile],
      rewardChildSettings,
    });
    return profile;
  }, [familyId, isCloud, persistLocal, state, cacheCloudSnapshot]);

  const updateChild = useCallback(async (id: string, input: { name: string; emoji?: string; color?: string }): Promise<Profile | undefined> => {
    if (familyId) {
      const online = await probeOnline(2_000);
      if (!online) throw new Error("Cette action nécessite une connexion Internet.");
      await cloudUpdateChild(id, input);
    }
    const existing = state.profiles.find((p) => p.id === id && p.role === "child");
    if (!existing) return undefined;
    const saved: Profile = {
      ...existing,
      name: input.name.trim(),
      emoji: input.emoji?.trim() || existing.emoji,
      color: input.color?.trim() || existing.color,
    };
    if (familyId) {
      setState((prev) => {
        const next = {
          ...prev,
          profiles: prev.profiles.map((p) => (p.id === id && p.role === "child" ? saved : p)),
        };
        void cacheCloudSnapshot(next);
        return next;
      });
      return saved;
    }
    await persistLocal({
      ...state,
      profiles: state.profiles.map((p) => (p.id === id && p.role === "child" ? saved : p)),
    });
    return saved;
  }, [familyId, persistLocal, state, cacheCloudSnapshot]);

  const deleteChild = useCallback(async (id: string) => {
    if (familyId) {
      const online = await probeOnline(2_000);
      if (!online) throw new Error("Cette action nécessite une connexion Internet.");
      await cloudDeleteChild(id);
    }
    const next: AppState = {
      ...state,
      profiles: state.profiles.filter((p) => p.id !== id),
      tasks: state.tasks.filter((t) => t.childId !== id),
      completions: state.completions.filter((c) => c.childId !== id),
      rewardTasks: (state.rewardTasks ?? []).filter((r) => {
        const task = state.tasks.find((t) => t.id === r.taskId);
        return !task || task.childId !== id;
      }),
      rewardLedger: (state.rewardLedger ?? []).filter((e) => e.childProfileId !== id),
      currentProfileId: state.currentProfileId === id ? null : state.currentProfileId,
    };
    if (familyId) {
      setState(next);
      void cacheCloudSnapshot(next);
    } else {
      await persistLocal(next);
    }
    await safeReminders(next.tasks, next.profiles, next.currentProfileId);
  }, [familyId, persistLocal, state, cacheCloudSnapshot]);

  const getTask = useCallback((taskId: string) => state.tasks.find((t) => t.id === taskId), [state.tasks]);
  const getProfile = useCallback((id: string) => state.profiles.find((p) => p.id === id), [state.profiles]);

  const rewardSettings = state.rewardSettings;
  const rewardChildSettings = state.rewardChildSettings ?? [];
  const rewardTasks = state.rewardTasks ?? [];
  const rewardLedger = state.rewardLedger ?? [];
  const rewardsEnabled = !!(rewardSettings?.enabled);
  const unitLabel = rewardSettings?.unitLabel || "⭐";

  const isRewardsActiveForChild = useCallback(
    (childId: string) =>
      isRewardsActiveForChildUtil(
        childId,
        state.rewardChildSettings ?? [],
        state.rewardSettings
      ),
    [state.rewardChildSettings, state.rewardSettings]
  );


  const unitKindFor = useCallback(
    (childId: string) => unitKindForChild(state.rewardChildSettings ?? [], childId),
    [state.rewardChildSettings]
  );

  const balanceFor = useCallback(
    (childId: string) => balanceForChild(stateRef.current.rewardLedger ?? [], childId),
    []
  );
  const ledgerByChild = useCallback(
    (childId: string) => ledgerForChild(stateRef.current.rewardLedger ?? [], childId),
    // recompute when ledger changes
    [state.rewardLedger]
  );
  const pointsFor = useCallback(
    (taskId: string) => pointsForTask(state.rewardTasks ?? [], taskId),
    [state.rewardTasks]
  );

  const updateRewardSettings = useCallback(
    async (input: { enabled: boolean; unitLabel?: string }): Promise<RewardSettings> => {
      if (familyId) {
        const online = await probeOnline(2_000);
        if (!online) throw new Error("Cette action nécessite une connexion Internet.");
        if (input.enabled) {
          await cloudEnsureRewardSettings(familyId);
        }
        const saved = await cloudUpsertRewardSettings(familyId, input);
        setState((prev) => {
          const next = { ...prev, rewardSettings: saved };
          stateRef.current = next;
          void cacheCloudSnapshot(next);
          return next;
        });
        return saved;
      }
      const prev = stateRef.current;
      const base = prev.rewardSettings ?? emptyRewardsState("local").rewardSettings;
      const saved: RewardSettings = {
        ...base,
        enabled: !!input.enabled,
        unitLabel: (input.unitLabel ?? base.unitLabel ?? "⭐").trim() || "⭐",
        updatedAt: new Date().toISOString(),
      };
      const next = { ...prev, rewardSettings: saved };
      stateRef.current = next;
      await persistLocal(next);
      return saved;
    },
    [familyId, persistLocal, cacheCloudSnapshot]
  );

  const upsertChildRewardSettings = useCallback(
    async (
      childId: string,
      input: { unitKind?: RewardUnitKind; enabled?: boolean }
    ): Promise<RewardChildSettings> => {
      if (familyId) {
        const online = await probeOnline(2_000);
        if (!online) throw new Error("Cette action nécessite une connexion Internet.");
        await cloudEnsureRewardSettings(familyId);
        const saved = await cloudUpsertRewardChildSettings(familyId, childId, input);
        setState((prev) => {
          const list = prev.rewardChildSettings ?? [];
          const rewardChildSettings = list.some((s) => s.childProfileId === childId)
            ? list.map((s) => (s.childProfileId === childId ? saved : s))
            : [...list, saved];
          const next = { ...prev, rewardChildSettings };
          stateRef.current = next;
          void cacheCloudSnapshot(next);
          return next;
        });
        return saved;
      }
      const prev = stateRef.current;
      const fid = prev.rewardSettings?.familyId || "local";
      const list = prev.rewardChildSettings ?? [];
      const existing = list.find((s) => s.childProfileId === childId);
      const kind: RewardUnitKind =
        input.unitKind === "money" || input.unitKind === "points"
          ? input.unitKind
          : existing?.unitKind === "money"
            ? "money"
            : "points";
      const enabled =
        typeof input.enabled === "boolean" ? input.enabled : !!existing?.enabled;
      const saved: RewardChildSettings = {
        childProfileId: childId,
        familyId: fid,
        unitKind: kind,
        enabled,
        updatedAt: new Date().toISOString(),
      };
      const rewardChildSettings = existing
        ? list.map((s) => (s.childProfileId === childId ? saved : s))
        : [...list, saved];
      const next = {
        ...prev,
        rewardSettings: prev.rewardSettings ?? emptyRewardsState(fid).rewardSettings,
        rewardChildSettings,
      };
      stateRef.current = next;
      await persistLocal(next);
      return saved;
    },
    [familyId, persistLocal, cacheCloudSnapshot]
  );

  const ensureMissingChildRewardSettings = useCallback(async (): Promise<void> => {
    const prev = stateRef.current;
    // Match SQL backfill: only when family master is enabled.
    if (!prev.rewardSettings?.enabled) return;
    const have = new Set((prev.rewardChildSettings ?? []).map((s) => s.childProfileId));
    const missing = prev.profiles.filter((p) => p.role === "child" && !have.has(p.id));
    if (missing.length === 0) return;
    for (const child of missing) {
      try {
        await upsertChildRewardSettings(child.id, { enabled: true, unitKind: "points" });
      } catch {
        /* best-effort; next open / sync retries */
      }
    }
  }, [upsertChildRewardSettings]);

  const setChildUnitKind = useCallback(
    async (childId: string, unitKind: RewardUnitKind): Promise<RewardChildSettings> => {
      return upsertChildRewardSettings(childId, { unitKind });
    },
    [upsertChildRewardSettings]
  );

  const setChildRewardsEnabled = useCallback(
    async (childId: string, enabled: boolean): Promise<RewardChildSettings> => {
      return upsertChildRewardSettings(childId, { enabled });
    },
    [upsertChildRewardSettings]
  );

  const setTaskPoints = useCallback(
    async (taskId: string, points: number | null): Promise<void> => {
      const clear = points == null || !(Math.floor(points) > 0);
      if (familyId) {
        const online = await probeOnline(2_000);
        if (!online) throw new Error("Cette action nécessite une connexion Internet.");
        await cloudEnsureRewardSettings(familyId);
        if (clear) {
          await cloudDeleteRewardTask(taskId);
          setState((prev) => {
            const next = {
              ...prev,
              rewardTasks: (prev.rewardTasks ?? []).filter((r) => r.taskId !== taskId),
            };
            stateRef.current = next;
            void cacheCloudSnapshot(next);
            return next;
          });
          return;
        }
        const saved = await cloudUpsertRewardTask(familyId, {
          taskId,
          points: Math.floor(points!),
          active: true,
        });
        setState((prev) => {
          const list = prev.rewardTasks ?? [];
          const rewardTasks = list.some((r) => r.taskId === taskId)
            ? list.map((r) => (r.taskId === taskId ? saved : r))
            : [...list, saved];
          const next = {
            ...prev,
            rewardSettings: prev.rewardSettings ?? {
              familyId,
              enabled: true,
              unitLabel: "⭐",
              updatedAt: new Date().toISOString(),
            },
            rewardTasks,
          };
          stateRef.current = next;
          void cacheCloudSnapshot(next);
          return next;
        });
        return;
      }

      const prev = stateRef.current;
      const fid = prev.rewardSettings?.familyId || "local";
      let rewardTasks = prev.rewardTasks ?? [];
      if (clear) {
        rewardTasks = rewardTasks.filter((r) => r.taskId !== taskId);
      } else {
        const existing = rewardTasks.find((r) => r.taskId === taskId);
        const saved: RewardTask = {
          id: existing?.id || newCloudId(),
          familyId: fid,
          taskId,
          points: Math.floor(points!),
          active: true,
          createdAt: existing?.createdAt || new Date().toISOString(),
        };
        rewardTasks = existing
          ? rewardTasks.map((r) => (r.taskId === taskId ? saved : r))
          : [...rewardTasks, saved];
      }
      const next = {
        ...prev,
        rewardSettings: prev.rewardSettings ?? emptyRewardsState(fid).rewardSettings,
        rewardTasks,
      };
      stateRef.current = next;
      await persistLocal(next);
    },
    [familyId, persistLocal, cacheCloudSnapshot]
  );


  const resetChildBalance = useCallback(
    async (childId: string, note?: string): Promise<RewardLedgerEntry | null> => {
      const prev = stateRef.current;
      const current = balanceForChild(prev.rewardLedger ?? [], childId);
      if (current === 0) return null;
      const amount = -current;

      if (familyId) {
        const online = await probeOnline(2_000);
        if (!online) throw new Error("Cette action nécessite une connexion Internet.");
        await cloudEnsureRewardSettings(familyId);
        const saved = await cloudInsertRewardLedger(familyId, {
          childProfileId: childId,
          amount,
          kind: "reset",
          note: note || "Reset",
        });
        setState((p) => {
          const next = { ...p, rewardLedger: [saved, ...(p.rewardLedger ?? [])] };
          stateRef.current = next;
          void cacheCloudSnapshot(next);
          return next;
        });
        return saved;
      }

      const fid = prev.rewardSettings?.familyId || "local";
      const saved: RewardLedgerEntry = {
        id: newCloudId(),
        familyId: fid,
        childProfileId: childId,
        amount,
        kind: "reset",
        note: note || "Reset",
        createdAt: new Date().toISOString(),
      };
      const next = {
        ...prev,
        rewardSettings: prev.rewardSettings ?? emptyRewardsState(fid).rewardSettings,
        rewardLedger: [saved, ...(prev.rewardLedger ?? [])],
      };
      stateRef.current = next;
      await persistLocal(next);
      return saved;
    },
    [familyId, persistLocal, cacheCloudSnapshot]
  );

  const resetDemo = useCallback(async () => {
    if (!isDemo && familyId) { await load(); return; }
    const seeded = await resetDemoData();
    setState(seeded);
    await safeReminders(seeded.tasks, seeded.profiles, seeded.currentProfileId);
  }, [familyId, isDemo, load]);

  const refreshReminders = useCallback(async () => {
    const active =
      state.profiles.find((p) => p.id === state.currentProfileId) ?? null;
    return rescheduleTodayReminders(state.tasks, state.profiles, active);
  }, [state.tasks, state.profiles, state.currentProfileId]);
  const reloadFromCloud = useCallback(async () => {
    if (!familyId) {
      await load();
      return;
    }
    setReady(true);
    setSyncError(null);
    const online = await probeOnline(2_500);
    if (!online) {
      const cached = await loadCloudStateCache(familyId);
      if (cached) {
        setUsingCache(true);
        setSyncError("offline");
      } else {
        setSyncError("offline");
      }
      await refreshPendingCount(familyId);
      return;
    }
    try {
      await flushPending(familyId);
      await pullCloud(familyId, { background: false });
    } catch {
      /* syncError already set */
    }
  }, [familyId, load, pullCloud, flushPending, refreshPendingCount]);

  const value: AppContextValue = {
    ready, state, currentProfile, childrenProfiles, parentProfile, cloudSync,
    usingCache, isSyncing, syncError, cacheSavedAt, pendingMutations, setCurrentProfileId,
    tasksForChildToday, completionFor, markTaskDone, unmarkTaskDone, clearCompletionPhoto, upsertTask, deleteTask,
    addChild, updateChild, deleteChild, getTask, getProfile, resetDemo, refreshReminders, reloadFromCloud,
    rewardSettings, rewardChildSettings, rewardTasks, rewardLedger, rewardsEnabled, unitLabel,
    isRewardsActiveForChild,
    balanceFor, ledgerByChild, pointsFor, unitKindFor,
    updateRewardSettings, setChildUnitKind, setChildRewardsEnabled, upsertChildRewardSettings,
    ensureMissingChildRewardSettings,
    setTaskPoints, resetChildBalance,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

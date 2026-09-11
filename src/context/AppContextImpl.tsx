import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState as RnAppState, AppStateStatus } from "react-native";
import { useAuth } from "../auth";
import { loadCloudStateCache, saveCloudStateCache } from "../data/cloudCache";
import {
  cloudClearCompletionPhoto, cloudDeleteChild, cloudDeleteTask, cloudInsertChild, cloudMarkDone, cloudUnmarkDone,
  cloudUpdateChild, cloudUpsertTask, loadCloudAppState,
} from "../data/cloudSync";
import { loadAppState, resetDemoData, saveAppState } from "../data/storage";
import { loadLastProfileId, saveLastProfileId } from "../data/lastProfile";
import { rescheduleTodayReminders } from "../services/notifications";
import { childColors } from "../theme/colors";
import { AppState, Profile, Task, TaskCompletion } from "../types";
import { frenchCloudError } from "../utils/cloudTimeout";
import { probeOnline } from "../utils/connectivity";
import { todayISO, uid } from "../utils/dates";
import { isTaskForDate } from "../utils/recurrence";

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
}

const AppContext = createContext<AppContextValue | null>(null);
const emptyState: AppState = { profiles: [], tasks: [], completions: [], seeded: false, currentProfileId: null };

async function safeReminders(tasks: Task[], profiles: Profile[]) {
  try { await rescheduleTodayReminders(tasks, profiles); } catch { /* ignore */ }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { ready: authReady, session, isDemo, isCloud } = useAuth();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(emptyState);
  const [usingCache, setUsingCache] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [cacheSavedAt, setCacheSavedAt] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const familyId = isCloud ? session?.familyId ?? null : null;
  const cloudSync = !!familyId;
  const syncingRef = useRef(false);

  const applyRememberedProfile = useCallback(async (loaded: AppState) => {
    const remembered = await loadLastProfileId();
    const currentProfileId =
      remembered && loaded.profiles.some((p) => p.id === remembered) ? remembered : null;
    return { ...loaded, currentProfileId };
  }, []);

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
      const next = await applyRememberedProfile(loaded);
      setState(next);
      stateRef.current = next;
      await saveCloudStateCache(fid, next);
      setCacheSavedAt(new Date().toISOString());
      setUsingCache(false);
      setSyncError(null);
      await safeReminders(next.tasks, next.profiles);
    } catch (e) {
      const msg = frenchCloudError(e, "Chargement cloud impossible.");
      setSyncError(msg);
      throw e;
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [applyRememberedProfile, session?.displayName, session?.email]);

  const load = useCallback(async () => {
    if (!authReady) return;
    setReady(false);
    setSyncError(null);
    try {
      if (familyId) {
        const cached = await loadCloudStateCache(familyId);
        if (cached) {
          const next = await applyRememberedProfile(cached.state);
          setState(next);
          stateRef.current = next;
          setCacheSavedAt(cached.savedAt);
          setUsingCache(true);
          setReady(true);
          await safeReminders(next.tasks, next.profiles);
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
          await safeReminders(next.tasks, next.profiles);
        } else {
          setState(loaded);
          await safeReminders(loaded.tasks, loaded.profiles);
        }
      }
    } catch {
      /* keep previous state; UI must leave the loading gate */
    } finally {
      setReady(true);
    }
  }, [authReady, familyId, applyRememberedProfile, pullCloud]);

  useEffect(() => { void load(); }, [load]);

  // Re-sync when app returns to foreground (network may be back).
  useEffect(() => {
    if (!familyId || !authReady) return;
    const onChange = (next: AppStateStatus) => {
      if (next !== "active") return;
      void (async () => {
        const online = await probeOnline(2_000);
        if (!online) return;
        try {
          await pullCloud(familyId, { background: true });
        } catch {
          /* keep cache; banner shows syncError */
        }
      })();
    };
    const sub = RnAppState.addEventListener("change", onChange);
    return () => sub.remove();
  }, [familyId, authReady, pullCloud]);

  const persistLocal = useCallback(async (next: AppState) => {
    setState(next);
    if (!familyId) await saveAppState(next);
  }, [familyId]);

  const cacheCloudSnapshot = useCallback(async (next: AppState) => {
    if (!familyId) return;
    await saveCloudStateCache(familyId, next);
    setCacheSavedAt(new Date().toISOString());
  }, [familyId]);


  const currentProfile = useMemo(() => state.profiles.find((p) => p.id === state.currentProfileId) ?? null, [state.profiles, state.currentProfileId]);
  const childrenProfiles = useMemo(() => state.profiles.filter((p) => p.role === "child"), [state.profiles]);
  const parentProfile = useMemo(() => state.profiles.find((p) => p.role === "parent") ?? null, [state.profiles]);
  const setCurrentProfileId = useCallback((id: string | null) => {
    void saveLastProfileId(id);
    void persistLocal({ ...state, currentProfileId: id });
  }, [persistLocal, state]);
  const tasksForChildToday = useCallback((childId: string) => state.tasks.filter((t) => t.childId === childId && isTaskForDate(t)).sort((a, b) => a.time.localeCompare(b.time)), [state.tasks]);
  const completionFor = useCallback((taskId: string, date = todayISO()) => state.completions.find((c) => c.taskId === taskId && c.date === date), [state.completions]);

  const markTaskDone = useCallback(async (taskId: string, childId: string, photoUri?: string) => {
    const date = todayISO();
    if (familyId) {
      const saved = await cloudMarkDone(familyId, taskId, childId, date, photoUri);
      const next = { ...state, completions: [...state.completions.filter((c) => !(c.taskId === taskId && c.date === date)), saved] };
      setState(next);
      void cacheCloudSnapshot(next);
      return;
    }
    const existing = state.completions.find((c) => c.taskId === taskId && c.date === date);
    const completions = existing
      ? state.completions.map((c) => c.id === existing.id ? { ...c, completedAt: new Date().toISOString(), photoUri: photoUri ?? c.photoUri } : c)
      : [...state.completions, { id: uid("done"), taskId, childId, date, completedAt: new Date().toISOString(), photoUri }];
    await persistLocal({ ...state, completions });
  }, [familyId, persistLocal, state, cacheCloudSnapshot]);

  const unmarkTaskDone = useCallback(async (taskId: string, date = todayISO()) => {
    if (familyId) {
      await cloudUnmarkDone(taskId, date);
      const next = { ...state, completions: state.completions.filter((c) => !(c.taskId === taskId && c.date === date)) };
      setState(next);
      void cacheCloudSnapshot(next);
      return;
    }
    await persistLocal({ ...state, completions: state.completions.filter((c) => !(c.taskId === taskId && c.date === date)) });
  }, [familyId, persistLocal, state, cacheCloudSnapshot]);

  const clearCompletionPhoto = useCallback(async (completionId: string) => {
    if (familyId) {
      await cloudClearCompletionPhoto(completionId);
      const next = {
        ...state,
        completions: state.completions.map((c) =>
          c.id === completionId ? { ...c, photoUri: undefined } : c
        ),
      };
      setState(next);
      void cacheCloudSnapshot(next);
      return;
    }
    await persistLocal({
      ...state,
      completions: state.completions.map((c) =>
        c.id === completionId ? { ...c, photoUri: undefined } : c
      ),
    });
  }, [familyId, persistLocal, state, cacheCloudSnapshot]);

  const upsertTask = useCallback(async (input: Omit<Task, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Task> => {
    // stateRef so sequential creates (multi-child) do not drop prior inserts
    if (familyId) {
      const saved = await cloudUpsertTask(familyId, input);
      // Ensure client fields survive if select omits nulls oddly
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
      await safeReminders(next.tasks, next.profiles);
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
    await safeReminders(next.tasks, next.profiles);
    return saved;
  }, [familyId, persistLocal, cacheCloudSnapshot]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (familyId) await cloudDeleteTask(taskId);
    const prev = stateRef.current;
    const next = {
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
      completions: prev.completions.filter((c) => c.taskId !== taskId),
    };
    stateRef.current = next;
    if (familyId) {
      setState(next);
      void cacheCloudSnapshot(next);
    } else {
      await persistLocal(next);
    }
    await safeReminders(next.tasks, next.profiles);
  }, [familyId, persistLocal, cacheCloudSnapshot]);

  const addChild = useCallback(async (input: { name: string; emoji?: string; color?: string }): Promise<Profile> => {
    const kids = state.profiles.filter((p) => p.role === "child");
    const color = input.color?.trim() || childColors[kids.length % childColors.length] || childColors[0];
    if (isCloud && !familyId) {
      throw new Error("Famille cloud introuvable (family_id manquant). Reconnectez-vous après l'inscription.");
    }
    if (familyId) {
      const profile = await cloudInsertChild(familyId, { name: input.name, emoji: input.emoji, color });
      setState((prev) => {
        const next = { ...prev, profiles: [...prev.profiles, profile] };
        void cacheCloudSnapshot(next);
        return next;
      });
      return profile;
    }
    const profile: Profile = { id: uid("profile_child"), name: input.name.trim(), role: "child", emoji: input.emoji?.trim() || "🌟", color };
    await persistLocal({ ...state, profiles: [...state.profiles, profile] });
    return profile;
  }, [familyId, isCloud, persistLocal, state, cacheCloudSnapshot]);

  const updateChild = useCallback(async (id: string, input: { name: string; emoji?: string; color?: string }): Promise<Profile | undefined> => {
    if (familyId) await cloudUpdateChild(id, input);
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
    if (familyId) await cloudDeleteChild(id);
    const next: AppState = {
      ...state,
      profiles: state.profiles.filter((p) => p.id !== id),
      tasks: state.tasks.filter((t) => t.childId !== id),
      completions: state.completions.filter((c) => c.childId !== id),
      currentProfileId: state.currentProfileId === id ? null : state.currentProfileId,
    };
    if (familyId) {
      setState(next);
      void cacheCloudSnapshot(next);
    } else {
      await persistLocal(next);
    }
    await safeReminders(next.tasks, next.profiles);
  }, [familyId, persistLocal, state, cacheCloudSnapshot]);

  const getTask = useCallback((taskId: string) => state.tasks.find((t) => t.id === taskId), [state.tasks]);
  const getProfile = useCallback((id: string) => state.profiles.find((p) => p.id === id), [state.profiles]);

  const resetDemo = useCallback(async () => {
    if (!isDemo && familyId) { await load(); return; }
    const seeded = await resetDemoData();
    setState(seeded);
    await safeReminders(seeded.tasks, seeded.profiles);
  }, [familyId, isDemo, load]);

  const refreshReminders = useCallback(async () => rescheduleTodayReminders(state.tasks, state.profiles), [state.tasks, state.profiles]);
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
      return;
    }
    try {
      await pullCloud(familyId, { background: false });
    } catch {
      /* syncError already set */
    }
  }, [familyId, load, pullCloud]);

  const value: AppContextValue = {
    ready, state, currentProfile, childrenProfiles, parentProfile, cloudSync,
    usingCache, isSyncing, syncError, cacheSavedAt, setCurrentProfileId,
    tasksForChildToday, completionFor, markTaskDone, unmarkTaskDone, clearCompletionPhoto, upsertTask, deleteTask,
    addChild, updateChild, deleteChild, getTask, getProfile, resetDemo, refreshReminders, reloadFromCloud,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

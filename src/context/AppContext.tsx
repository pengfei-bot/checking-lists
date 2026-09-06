import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, Profile, Task, TaskCompletion } from "../types";
import { loadAppState, resetDemoData, saveAppState } from "../data/storage";
import { childColors } from "../theme/colors";
import { todayISO, uid } from "../utils/dates";
import { isTaskForDate } from "../utils/recurrence";
import { rescheduleTodayReminders } from "../services/notifications";

interface AppContextValue {
  ready: boolean;
  state: AppState;
  currentProfile: Profile | null;
  childrenProfiles: Profile[];
  parentProfile: Profile | null;
  setCurrentProfileId: (id: string | null) => void;
  tasksForChildToday: (childId: string) => Task[];
  completionFor: (taskId: string, date?: string) => TaskCompletion | undefined;
  markTaskDone: (taskId: string, childId: string, photoUri?: string) => Promise<void>;
  unmarkTaskDone: (taskId: string, date?: string) => Promise<void>;
  upsertTask: (input: Omit<Task, "id" | "createdAt" | "updatedAt"> & { id?: string }) => Promise<Task>;
  deleteTask: (taskId: string) => Promise<void>;
  addChild: (input: { name: string; emoji?: string; color?: string }) => Promise<Profile>;
  updateChild: (
    id: string,
    input: { name: string; emoji?: string; color?: string }
  ) => Promise<Profile | undefined>;
  deleteChild: (id: string) => Promise<void>;
  getTask: (taskId: string) => Task | undefined;
  getProfile: (id: string) => Profile | undefined;
  resetDemo: () => Promise<void>;
  refreshReminders: () => Promise<number>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>({
    profiles: [],
    tasks: [],
    completions: [],
    seeded: false,
    currentProfileId: null,
  });

  useEffect(() => {
    (async () => {
      const loaded = await loadAppState();
      setState(loaded);
      setReady(true);
      try {
        await rescheduleTodayReminders(loaded.tasks, loaded.profiles);
      } catch {
        // permissions / web — ignore
      }
    })();
  }, []);

  const persist = useCallback(async (next: AppState) => {
    setState(next);
    await saveAppState(next);
  }, []);

  const currentProfile = useMemo(
    () => state.profiles.find((p) => p.id === state.currentProfileId) ?? null,
    [state.profiles, state.currentProfileId]
  );

  const childrenProfiles = useMemo(
    () => state.profiles.filter((p) => p.role === "child"),
    [state.profiles]
  );

  const parentProfile = useMemo(
    () => state.profiles.find((p) => p.role === "parent") ?? null,
    [state.profiles]
  );

  const setCurrentProfileId = useCallback(
    (id: string | null) => {
      void persist({ ...state, currentProfileId: id });
    },
    [persist, state]
  );

  const tasksForChildToday = useCallback(
    (childId: string) =>
      state.tasks
        .filter((t) => t.childId === childId && isTaskForDate(t))
        .sort((a, b) => a.time.localeCompare(b.time)),
    [state.tasks]
  );

  const completionFor = useCallback(
    (taskId: string, date = todayISO()) =>
      state.completions.find((c) => c.taskId === taskId && c.date === date),
    [state.completions]
  );

  const markTaskDone = useCallback(
    async (taskId: string, childId: string, photoUri?: string) => {
      const date = todayISO();
      const existing = state.completions.find((c) => c.taskId === taskId && c.date === date);
      let completions: TaskCompletion[];
      if (existing) {
        completions = state.completions.map((c) =>
          c.id === existing.id
            ? { ...c, completedAt: new Date().toISOString(), photoUri: photoUri ?? c.photoUri }
            : c
        );
      } else {
        completions = [
          ...state.completions,
          {
            id: uid("done"),
            taskId,
            childId,
            date,
            completedAt: new Date().toISOString(),
            photoUri,
          },
        ];
      }
      await persist({ ...state, completions });
    },
    [persist, state]
  );

  const unmarkTaskDone = useCallback(
    async (taskId: string, date = todayISO()) => {
      await persist({
        ...state,
        completions: state.completions.filter((c) => !(c.taskId === taskId && c.date === date)),
      });
    },
    [persist, state]
  );

  const upsertTask = useCallback(
    async (
      input: Omit<Task, "id" | "createdAt" | "updatedAt"> & { id?: string }
    ): Promise<Task> => {
      const now = new Date().toISOString();
      let tasks: Task[];
      let saved!: Task;
      if (input.id) {
        tasks = state.tasks.map((t) => {
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
          createdAt: now,
          updatedAt: now,
        };
        tasks = [...state.tasks, saved];
      }
      const next = { ...state, tasks };
      await persist(next);
      try {
        await rescheduleTodayReminders(next.tasks, next.profiles);
      } catch {
        /* ignore */
      }
      return saved;
    },
    [persist, state]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const next = {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== taskId),
        completions: state.completions.filter((c) => c.taskId !== taskId),
      };
      await persist(next);
      try {
        await rescheduleTodayReminders(next.tasks, next.profiles);
      } catch {
        /* ignore */
      }
    },
    [persist, state]
  );


  const addChild = useCallback(
    async (input: { name: string; emoji?: string; color?: string }): Promise<Profile> => {
      const kids = state.profiles.filter((p) => p.role === "child");
      const color =
        input.color?.trim() ||
        childColors[kids.length % childColors.length] ||
        childColors[0];
      const profile: Profile = {
        id: uid("profile_child"),
        name: input.name.trim(),
        role: "child",
        emoji: (input.emoji?.trim() || "🌟"),
        color,
      };
      await persist({ ...state, profiles: [...state.profiles, profile] });
      return profile;
    },
    [persist, state]
  );

  const updateChild = useCallback(
    async (
      id: string,
      input: { name: string; emoji?: string; color?: string }
    ): Promise<Profile | undefined> => {
      let saved: Profile | undefined;
      const profiles = state.profiles.map((p) => {
        if (p.id !== id || p.role !== "child") return p;
        saved = {
          ...p,
          name: input.name.trim(),
          emoji: input.emoji?.trim() || p.emoji,
          color: input.color?.trim() || p.color,
        };
        return saved;
      });
      if (!saved) return undefined;
      await persist({ ...state, profiles });
      return saved;
    },
    [persist, state]
  );

  const deleteChild = useCallback(
    async (id: string) => {
      const next: AppState = {
        ...state,
        profiles: state.profiles.filter((p) => p.id !== id),
        tasks: state.tasks.filter((t) => t.childId !== id),
        completions: state.completions.filter((c) => c.childId !== id),
        currentProfileId: state.currentProfileId === id ? null : state.currentProfileId,
      };
      await persist(next);
      try {
        await rescheduleTodayReminders(next.tasks, next.profiles);
      } catch {
        /* ignore */
      }
    },
    [persist, state]
  );

  const getTask = useCallback(
    (taskId: string) => state.tasks.find((t) => t.id === taskId),
    [state.tasks]
  );

  const getProfile = useCallback(
    (id: string) => state.profiles.find((p) => p.id === id),
    [state.profiles]
  );

  const resetDemo = useCallback(async () => {
    const seeded = await resetDemoData();
    setState(seeded);
    try {
      await rescheduleTodayReminders(seeded.tasks, seeded.profiles);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshReminders = useCallback(async () => {
    return rescheduleTodayReminders(state.tasks, state.profiles);
  }, [state.tasks, state.profiles]);

  const value: AppContextValue = {
    ready,
    state,
    currentProfile,
    childrenProfiles,
    parentProfile,
    setCurrentProfileId,
    tasksForChildToday,
    completionFor,
    markTaskDone,
    unmarkTaskDone,
    upsertTask,
    deleteTask,
    addChild,
    updateChild,
    deleteChild,
    getTask,
    getProfile,
    resetDemo,
    refreshReminders,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

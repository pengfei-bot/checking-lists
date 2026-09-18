import React from "react";
import { useApp } from "../context/AppContext";
import { OfflineBanner } from "./OfflineBanner";

/**
 * App-chrome offline / pending-mutation banner for cloud sessions.
 * Mounted in RootNavigator so it stays visible on TaskForm / TaskDetail /
 * day detail screens — not only ProfilePicker / dashboards.
 */
export function CloudOfflineBanner() {
  const {
    cloudSync,
    usingCache,
    isSyncing,
    syncError,
    cacheSavedAt,
    pendingMutations,
    reloadFromCloud,
  } = useApp();

  const visible =
    cloudSync &&
    (usingCache || syncError === "offline" || pendingMutations > 0);

  return (
    <OfflineBanner
      visible={visible}
      syncing={isSyncing && cloudSync}
      cachedAt={cacheSavedAt}
      pendingMutations={pendingMutations}
      onRetry={() => {
        void reloadFromCloud();
      }}
    />
  );
}

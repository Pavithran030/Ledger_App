import { create } from "zustand";
import { syncService } from "@/services/sync";

interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  triggerSync: () => Promise<boolean>;
}

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  lastSyncedAt: null,
  syncError: null,

  triggerSync: async () => {
    set({ isSyncing: true, syncError: null });
    try {
      const result = await syncService.syncNow();
      if (result.success) {
        set({
          isSyncing: false,
          lastSyncedAt: syncService.getLastSyncTime(),
          syncError: null,
        });
        return true;
      }
      set({ isSyncing: false, syncError: result.message });
      return false;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sync error";
      set({ isSyncing: false, syncError: message });
      return false;
    }
  },
}));

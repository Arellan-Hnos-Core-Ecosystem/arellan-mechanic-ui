import { create } from "zustand";
import type { OfflineAction } from "@/types";

interface OfflineStore {
  isOnline: boolean;
  queue: OfflineAction[];
  syncing: boolean;
  lastSyncAt: number | null;
  setOnline: (online: boolean) => void;
  enqueue: (action: Omit<OfflineAction, "id" | "createdAt" | "retries">) => Promise<string>;
  dequeue: (id: string) => void;
  setSyncing: (syncing: boolean) => void;
  setLastSync: (time: number) => void;
  retryAction: (id: string) => void;
  clearQueue: () => void;
  getQueueSize: () => number;
}

export const useOfflineStore = create<OfflineStore>((set, get) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  queue: [],
  syncing: false,
  lastSyncAt: null,

  setOnline: (online) => set({ isOnline: online }),

  enqueue: async (action) => {
    const { default: getDb } = await import("@/offline/queue");
    const db = await getDb();
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const entry: OfflineAction = {
      ...action,
      id,
      createdAt: Date.now(),
      retries: 0,
    };

    try {
      await db.put("offline-queue", {
        ...entry,
        payload: JSON.parse(JSON.stringify(entry.payload)),
      });
    } catch {
      // IndexedDB unavailable; keep in memory only
    }

    set((s) => ({ queue: [...s.queue, entry] }));
    return id;
  },

  dequeue: (id) => {
    set((s) => ({ queue: s.queue.filter((a) => a.id !== id) }));
  },

  setSyncing: (syncing) => set({ syncing }),
  setLastSync: (time) => set({ lastSyncAt: time }),

  retryAction: (id) => {
    set((s) => ({
      queue: s.queue.map((a) =>
        a.id === id ? { ...a, retries: a.retries + 1 } : a
      ),
    }));
  },

  clearQueue: () => set({ queue: [] }),

  getQueueSize: () => get().queue.length,
}));

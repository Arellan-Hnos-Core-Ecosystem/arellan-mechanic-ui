import api from "@/lib/api";
import { useOfflineStore } from "@/stores/offline";
import { loadQueue, clearQueueItem, clearAll } from "@/offline/queue";
import type { OfflineAction } from "@/types";

const MAX_RETRIES = 5;

export function initSyncService() {
  const store = useOfflineStore.getState;

  window.addEventListener("online", () => {
    store().setOnline(true);
    syncQueue();
  });

  window.addEventListener("offline", () => {
    store().setOnline(false);
  });

  // Attempt sync on load
  if (navigator.onLine) {
    syncQueue();
  }
}

async function syncQueue() {
  const state = useOfflineStore.getState();
  if (state.syncing) return;

  useOfflineStore.setState({ syncing: true });

  try {
    const items = await loadQueue();

    for (const item of items) {
      try {
        await processAction(item);
        await clearQueueItem(item.id);
        useOfflineStore.getState().dequeue(item.id);
      } catch (err) {
        if (item.retries >= MAX_RETRIES) {
          await clearQueueItem(item.id);
          useOfflineStore.getState().dequeue(item.id);
        } else {
          useOfflineStore.getState().retryAction(item.id);
        }
      }
    }

    useOfflineStore.setState({ lastSyncAt: Date.now() });
  } finally {
    useOfflineStore.setState({ syncing: false });
  }
}

async function processAction(action: OfflineAction) {
  switch (action.type) {
    case "UPDATE_STATUS": {
      const p = action.payload as { orderId: string; status: string; notes?: string };
      await api.patch(`/orders/${p.orderId}/status`, {
        status: p.status,
        notes: p.notes || "",
      });
      break;
    }
    case "VEHICLE_INTAKE": {
      // Intake forms require files; skipped when offline (files not persisted)
      break;
    }
    case "REQUEST_PARTS": {
      const p = action.payload as { orderId: string; itemId: string; quantity: number };
      await api.post(`/orders/${p.orderId}/parts`, {
        items: [{ itemId: p.itemId, quantity: p.quantity }],
      });
      break;
    }
    case "UPLOAD_PHOTO": {
      // Photo uploads require file blobs; skipped when offline
      break;
    }
  }
}

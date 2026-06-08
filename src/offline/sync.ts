import api from "@/lib/api";
import { useOfflineStore } from "@/stores/offline";
import {
  loadQueue,
  clearQueueItem,
  getPhotoBlobsForAction,
  deletePhotoBlobsForAction,
} from "@/offline/queue";
import type {
  OfflineAction,
  UpdateStatusPayload,
  PhotoUploadPayload,
  VehicleIntakePayload,
  PartsRequestPayload,
} from "@/types";

const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 500;

async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * 2 ** attempt));
    }
  }
}

export function initSyncService() {
  const store = useOfflineStore.getState;

  window.addEventListener("online", () => {
    store().setOnline(true);
    syncQueue();
  });

  window.addEventListener("offline", () => {
    store().setOnline(false);
  });

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
        await deletePhotoBlobsForAction(item.id);
        useOfflineStore.getState().dequeue(item.id);
      } catch {
        if (item.retries >= MAX_RETRIES) {
          await clearQueueItem(item.id);
          await deletePhotoBlobsForAction(item.id);
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
      const p = action.payload as UpdateStatusPayload;
      await api.patch(`/orders/${p.orderId}/status`, {
        status: p.status,
        notes: p.notes ?? "",
      });
      break;
    }

    case "VEHICLE_INTAKE": {
      const p = action.payload as VehicleIntakePayload;
      const blobs = await getPhotoBlobsForAction(action.id);

      await withExponentialBackoff(async () => {
        const formData = new FormData();
        formData.append("plate", p.plate);
        if (p.kilometerReading != null) formData.append("kilometerReading", String(p.kilometerReading));
        if (p.fuelLevel) formData.append("fuelLevel", p.fuelLevel);
        if (p.description) formData.append("description", p.description);

        for (const b of blobs) {
          const ext = b.mimeType.split("/")[1] ?? "jpg";
          formData.append("photos", b.blob, `${b.position}.${ext}`);
        }

        await api.post("/orders/checkin", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      });
      break;
    }

    case "REQUEST_PARTS": {
      const p = action.payload as PartsRequestPayload;
      await api.post(`/orders/${p.orderId}/parts`, {
        items: [{ itemId: p.itemId, quantity: p.quantity }],
      });
      break;
    }

    case "UPLOAD_PHOTO": {
      const p = action.payload as PhotoUploadPayload;
      const blobs = await getPhotoBlobsForAction(action.id);

      await withExponentialBackoff(async () => {
        const formData = new FormData();
        formData.append("orderId", p.orderId);
        formData.append("position", p.position);
        if (p.caption) formData.append("caption", p.caption);

        for (const b of blobs) {
          const ext = b.mimeType.split("/")[1] ?? "jpg";
          formData.append("photo", b.blob, `${b.position}.${ext}`);
        }

        await api.post(`/orders/${p.orderId}/photos`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      });
      break;
    }
  }
}

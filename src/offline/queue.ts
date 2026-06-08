import { openDB, type IDBPDatabase } from "idb";
import type { StoredPhotoBlob } from "@/types";

const DB_NAME = "arellan-mechanic-offline";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          if (!database.objectStoreNames.contains("offline-queue")) {
            const store = database.createObjectStore("offline-queue", { keyPath: "id" });
            store.createIndex("createdAt", "createdAt");
            store.createIndex("type", "type");
          }
        }
        if (oldVersion < 2) {
          if (!database.objectStoreNames.contains("photo-blobs")) {
            const blobStore = database.createObjectStore("photo-blobs", { keyPath: "id" });
            blobStore.createIndex("actionId", "actionId");
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function loadQueue() {
  const db = await getDb();
  return db.getAll("offline-queue");
}

export async function clearQueueItem(id: string) {
  const db = await getDb();
  await db.delete("offline-queue", id);
}

export async function clearAll() {
  const db = await getDb();
  await db.clear("offline-queue");
}

export async function storePhotoBlob(
  actionId: string,
  blob: Blob,
  position: string,
): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const entry: StoredPhotoBlob = {
    id,
    actionId,
    blob,
    position,
    mimeType: blob.type || "image/jpeg",
    createdAt: Date.now(),
  };
  await db.put("photo-blobs", entry);
  return id;
}

export async function getPhotoBlobsForAction(actionId: string): Promise<StoredPhotoBlob[]> {
  const db = await getDb();
  return db.getAllFromIndex("photo-blobs", "actionId", actionId);
}

export async function deletePhotoBlobsForAction(actionId: string): Promise<void> {
  const db = await getDb();
  const blobs = await db.getAllFromIndex("photo-blobs", "actionId", actionId);
  for (const b of blobs) {
    await db.delete("photo-blobs", b.id);
  }
}

export default getDb;

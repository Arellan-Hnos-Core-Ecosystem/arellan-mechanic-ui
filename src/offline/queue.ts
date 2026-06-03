import { openDB, type IDBPDatabase } from "idb";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB("arellan-mechanic-offline", 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains("offline-queue")) {
          const store = database.createObjectStore("offline-queue", {
            keyPath: "id",
          });
          store.createIndex("createdAt", "createdAt");
          store.createIndex("type", "type");
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

export default getDb;

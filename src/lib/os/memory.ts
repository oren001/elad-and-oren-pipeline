// Personal memory: IndexedDB-backed key/value with categories.
// Lives only on the device — never leaves except when sent in the system prompt
// to Claude as "facts I know about the user".

const DB_NAME = "claude-os";
const DB_VERSION = 1;
const STORE = "memory";

export interface MemoryFact {
  key: string;
  value: string;
  category?: string;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("category", "category", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function rememberFact(fact: Omit<MemoryFact, "updatedAt">): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ ...fact, updatedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function recallAll(): Promise<MemoryFact[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as MemoryFact[]);
    req.onerror = () => reject(req.error);
  });
}

export async function recall(opts: { keyPrefix?: string; category?: string }): Promise<MemoryFact[]> {
  const all = await recallAll();
  return all.filter((m) => {
    if (opts.keyPrefix && !m.key.startsWith(opts.keyPrefix)) return false;
    if (opts.category && m.category !== opts.category) return false;
    return true;
  });
}

// Lessons are short behavioral notes Claude writes about how to do better
// next time. Stored as memory facts with category="lesson" and an auto key.
export async function addLesson(text: string): Promise<void> {
  const key = `lesson.${Date.now().toString(36)}`;
  return rememberFact({ key, value: text, category: "lesson" });
}

export async function listLessons(): Promise<MemoryFact[]> {
  return recall({ category: "lesson" });
}

export async function forgetAll(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

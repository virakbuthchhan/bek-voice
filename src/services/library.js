import { toRaw } from "vue";
let connection;
const open = () =>
  (connection ||= new Promise((resolve, reject) => {
    const req = indexedDB.open("sori-studio", 1);
    req.onupgradeneeded = () => {
      for (const store of ["voices", "clips"])
        req.result.createObjectStore(store, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
// IndexedDB cannot clone Vue proxies; keep binary data intact while unwrapping records.
export function plain(value) {
  value = toRaw(value);
  if (Array.isArray(value)) return value.map(plain);
  if (value && Object.getPrototypeOf(value) === Object.prototype)
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, plain(val)]),
    );
  return value;
}
export async function all(store) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () =>
      resolve(req.result.sort((a, b) => b.created - a.created));
    req.onerror = () => reject(req.error);
  });
}
export async function put(store, row) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(plain(row));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function remove(store, id) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// IndexedDB cache for generated textures so weak machines only pay the procedural generation cost once.
const DB = 'vapco-tex', STORE = 'tex';
let dbP = null;
function open() {
  if (dbP) return dbP;
  dbP = new Promise((res) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore(STORE); };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
    } catch { res(null); }
  });
  return dbP;
}
export async function cacheGet(key) {
  const db = await open(); if (!db) return null;
  return new Promise((res) => { try { const tx = db.transaction(STORE, 'readonly'); const rq = tx.objectStore(STORE).get(key); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); } catch { res(null); } });
}
export async function cachePut(key, value) {
  const db = await open(); if (!db) return;
  return new Promise((res) => { try { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(value, key); tx.oncomplete = () => res(true); tx.onerror = () => res(false); } catch { res(false); } });
}
export function canvasToBlob(canvas, lossless) {
  return new Promise((res) => { try { canvas.toBlob(b => res(b), lossless ? 'image/png' : 'image/webp', 0.94); } catch { res(null); } });
}

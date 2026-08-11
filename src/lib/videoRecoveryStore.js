// Local (browser-only) backup of an in-progress interview recording, so a
// sudden interruption — lost connection, browser/tab crash, accidental
// close — doesn't erase an answer that was already recorded but not yet
// uploaded. IndexedDB writes are durable as soon as they commit, so even a
// hard power cut only loses whatever hadn't been written by the last
// periodic save (see the 1s MediaRecorder timeslice in Interview.jsx).
// Everything here is best-effort: recovery is a nice-to-have, never a
// blocker for actually recording or submitting an answer.
const DB_NAME = 'vl-interview-recovery';
const STORE = 'chunks';

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function keyFor(applicationId, questionId) {
  return `${applicationId}:${questionId}`;
}

export async function saveRecoveryChunks(applicationId, questionId, chunks) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ chunks, savedAt: Date.now() }, keyFor(applicationId, questionId));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Recovery backup is best-effort — never let it interrupt recording.
  }
}

export async function loadRecoveryChunks(applicationId, questionId) {
  try {
    const db = await openDb();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(keyFor(applicationId, questionId));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function clearRecoveryChunks(applicationId, questionId) {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(keyFor(applicationId, questionId));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore — nothing to clean up if this fails
  }
}

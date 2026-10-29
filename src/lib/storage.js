const DB_NAME = 'solvexxa-db';
const STORE_NAME = 'conversations';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir IndexedDB.'));
  });
}

export async function getAllConversations() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('No se pudo leer el historial.'));
  });
}

export async function saveConversation(conversation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(conversation);

    request.onsuccess = () => resolve(conversation);
    request.onerror = () => reject(request.error || new Error('No se pudo guardar la conversación.'));
  });
}

export async function saveConversations(items) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    items.forEach((item) => store.put(item));
    tx.oncomplete = () => resolve(items);
    tx.onerror = () => reject(tx.error || new Error('No se pudo guardar el historial.'));
  });
}

export async function deleteConversationById(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error('No se pudo borrar la conversación.'));
  });
}

export function exportConversations(items) {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'solvexxa-chat-export.json';
  link.click();
  URL.revokeObjectURL(url);
}

export async function importConversationsFromFile(file) {
  if (!(file instanceof File)) {
    throw new Error('Archivo inválido.');
  }

  try {
    const text = await file.text();
    const items = JSON.parse(text);
    if (!Array.isArray(items)) {
      throw new Error('No se encontró un arreglo válido.');
    }

    const sanitized = items.filter((item) => item && item.id && Array.isArray(item.messages));
    await saveConversations(sanitized);
    return sanitized;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'No se pudo importar el archivo.');
  }
}

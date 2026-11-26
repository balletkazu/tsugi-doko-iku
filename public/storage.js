const databaseName = 'tsugi-doko-iku-preview';
let connection;

function openDatabase() {
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('data');
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = null; };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Storage is blocked by another tab'));
    }).catch(error => { connection = null; throw error; });
  }
  return connection;
}

async function run(mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('data', mode);
    const request = operation(transaction.objectStore('data'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
  });
}

export const read = key => run('readonly', store => store.get(key));
export const clear = () => run('readwrite', store => store.clear());

export async function importPhoto(file) {
  if (!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)) {
    throw new Error('JPEG・PNG・WebP・AVIF の写真を選んでください。');
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('写真を20MB以下にしてください。');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, {imageOrientation:'from-image'});
  } catch {
    throw new Error('写真を読み込めませんでした。別の画像を選んでください。');
  }
  try {
    const scale = Math.min(1, 1440 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', {alpha:false});
    context.fillStyle = '#fff';
    context.fillRect(0,0,canvas.width,canvas.height);
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',0.83));
    if (!blob) throw new Error('写真を保存できませんでした。');
    return blob;
  } finally {
    bitmap.close();
  }
}

// Compute and store the next value in one transaction so writes from two tabs are serialized.
export async function update(key, change) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('data', 'readwrite');
    const store = transaction.objectStore('data');
    let value;
    let failure;
    const request = store.get(key);
    request.onsuccess = () => {
      try {
        value = change(request.result);
        store.put(value,key);
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(value);
    transaction.onabort = () => reject(failure ?? transaction.error);
  });
}

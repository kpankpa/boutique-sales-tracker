const legacyKey = 'slawn.sales.queue';
let dbPromise;

async function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const { default: Dexie } = await import('dexie');
    const db = new Dexie('slawn-pos');
    db.version(1).stores({
      sales: '++id, clientRef, status, createdAt'
    });
    await db.open();
    return db;
  })().catch((error) => {
    dbPromise = undefined;
    throw error;
  });

  return dbPromise;
}

function now() {
  return new Date().toISOString();
}

function toQueuedSale(payload) {
  return {
    clientRef: payload.clientRef,
    payload,
    status: 'pending',
    conflict: null,
    attempts: 0,
    createdAt: now(),
    updatedAt: now()
  };
}

export async function prepareOutbox() {
  if (typeof localStorage === 'undefined') return;
  const db = await openDb();

  // A browser crash can leave a sale marked as syncing.
  await db.sales.where('status').equals('syncing').modify({ status: 'pending', updatedAt: now() });

  const raw = localStorage.getItem(legacyKey);
  if (!raw) return;

  try {
    const items = JSON.parse(raw);
    if (Array.isArray(items) && items.length) {
      const records = items
        .filter((item) => item?.payload)
        .map((item) => ({
          ...toQueuedSale(item.payload),
          clientRef: item.payload.clientRef || `legacy-${item.id}`,
          createdAt: item.payload.createdAt || now()
        }));
      await db.sales.bulkPut(records);
    }
  } catch {
    // A corrupt legacy queue must not block the new outbox.
  } finally {
    localStorage.removeItem(legacyKey);
  }
}

export async function listQueuedSales() {
  const db = await openDb();
  return db.sales.orderBy('createdAt').toArray();
}

export async function addQueuedSale(payload) {
  const db = await openDb();
  return db.sales.add(toQueuedSale(payload));
}

export async function markSyncing(id) {
  const db = await openDb();
  await db.sales.update(id, { status: 'syncing', updatedAt: now() });
}

export async function markConflict(id, error) {
  const db = await openDb();
  const record = await db.sales.get(id);
  await db.sales.update(id, {
    status: 'conflict',
    conflict: {
      code: error.code || 'SYNC_FAILED',
      message: error.message,
      details: error.details || null
    },
    attempts: (record?.attempts ?? 0) + 1,
    updatedAt: now()
  });
}

export async function markPending(id) {
  const db = await openDb();
  await db.sales.update(id, { status: 'pending', conflict: null, updatedAt: now() });
}

export async function removeQueuedSale(id) {
  const db = await openDb();
  await db.sales.delete(id);
}

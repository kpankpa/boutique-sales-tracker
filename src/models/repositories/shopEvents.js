import { database } from '../database';

const ALLOWED_EVENTS = new Set([
  'shop_view',
  'product_open',
  'size_guide_open',
  'add_to_cart',
  'checkout_start',
  'whatsapp_click',
  'order_copied'
]);

export function isAllowedShopEvent(name) {
  return ALLOWED_EVENTS.has(name);
}

export async function addShopEvent({ eventName, sessionKey, productId, category, meta }, executor = database) {
  await executor.execute({
    sql: `INSERT INTO shop_events (event_name, session_key, product_id, category, meta)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      eventName,
      sessionKey || null,
      Number.isInteger(productId) && productId > 0 ? productId : null,
      category || null,
      meta ? JSON.stringify(meta) : null
    ]
  });
}

export async function listShopEventSummary(days = 14) {
  const windowDays = Math.max(1, Math.min(90, Number(days) || 14));
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await database.execute({
    sql: `SELECT event_name,
                 COUNT(*) AS events,
                 COUNT(DISTINCT session_key) AS sessions
          FROM shop_events
          WHERE created_at >= ?
          GROUP BY event_name
          ORDER BY events DESC`,
    args: [since]
  });
  const topProducts = await database.execute({
    sql: `SELECT e.product_id, p.name, p.sku, COUNT(*) AS events
          FROM shop_events e
          LEFT JOIN products p ON p.id = e.product_id
          WHERE e.created_at >= ?
            AND e.product_id IS NOT NULL
            AND e.event_name IN ('product_open', 'add_to_cart', 'whatsapp_click')
          GROUP BY e.product_id, p.name, p.sku
          ORDER BY events DESC
          LIMIT 10`,
    args: [since]
  });
  const daily = await database.execute({
    sql: `SELECT substr(CAST(created_at AS TEXT), 1, 10) AS day,
                 event_name,
                 COUNT(*) AS events
          FROM shop_events
          WHERE created_at >= ?
          GROUP BY day, event_name
          ORDER BY day DESC, event_name ASC`,
    args: [since]
  });
  return {
    windowDays,
    since,
    totals: result.rows.map((row) => ({
      eventName: row.event_name,
      events: Number(row.events) || 0,
      sessions: Number(row.sessions) || 0
    })),
    topProducts: topProducts.rows.map((row) => ({
      productId: Number(row.product_id),
      name: row.name || 'Unknown product',
      sku: row.sku || '',
      events: Number(row.events) || 0
    })),
    daily: daily.rows.map((row) => ({
      day: row.day,
      eventName: row.event_name,
      events: Number(row.events) || 0
    }))
  };
}

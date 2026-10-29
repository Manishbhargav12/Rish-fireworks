// PayQ integration core. Shared by the Vercel (api/) and Netlify (netlify/functions/) wrappers.
// Secrets come ONLY from environment variables. Never put them in index.html.
//   PAYQ_USER_TOKEN      your PayQ "User token"  (sent as Bearer token)
//   PAYQ_SIGNING_SECRET  your PayQ "Signing secret key" (verifies webhooks)
//   PAYQ_API_BASE        optional, default https://api.payq.cc/v1
//   SITE_URL             optional, e.g. https://your-domain.com
const crypto = require('crypto');
const PRODUCTS = require('./products.js');   // same file the website uses, so prices can never differ

/* ---------------------------------------------------------------------------
   PAYQ API ADAPTER. Everything PayQ-specific is in this block.
   Built from the sample on payq.cc (POST {base}/orders, Bearer auth, HMAC-SHA256 webhooks).
   The full reference is behind the merchant login (payq.cc/merchant/documentation), so
   CHECK these names against it once and edit here if anything differs.
--------------------------------------------------------------------------- */
const PAYQ = {
  base: () => (process.env.PAYQ_API_BASE || 'https://api.payq.cc/v1').replace(/\/$/, ''),
  createPath: '/orders',
  statusPath: id => `/orders/${encodeURIComponent(id)}`,
  signatureHeaders: ['x-payq-signature', 'x-signature', 'x-webhook-signature', 'signature'],
  paidWords: ['paid', 'success', 'successful', 'completed', 'captured', 'payment.success'],
  qrField: d => d.qr_string || d.upi_url || d.upi_link || d.qr || '',
  utrField: d => d.utr || (d.data && d.data.utr) || ''
};

const PRICES = Object.fromEntries(PRODUCTS.map(p => [p.id, p.price]));
const FREE = new Set(PRODUCTS.filter(p => p.free).map(p => String(p.id)));
const COUPONS = { DIWALI10: 10 };      // keep same as index.html
const FREE_SHIP_ABOVE = 999, SHIPPING = 60;

const authHeaders = () => ({
  'Authorization': 'Bearer ' + process.env.PAYQ_USER_TOKEN,
  'Content-Type': 'application/json'
});
const configured = () => !!(process.env.PAYQ_USER_TOKEN && process.env.PAYQ_SIGNING_SECRET);
const isPaid = v => PAYQ.paidWords.includes(String(v || '').toLowerCase());

// Paid orders reported by webhook. Best effort only: serverless instances restart,
// so order-status ALSO asks PayQ directly and never relies on this alone.
const PAID = globalThis.__payqPaid || (globalThis.__payqPaid = new Map());

// POST /api/create-order
async function createOrder(body, host) {
  if (!configured()) return { status: 500, body: { error: 'Payment is not configured on the server yet.' } };
  const { items = [], customer = {}, coupon = '', pickup = false, expected } = body || {};
  if (!Array.isArray(items) || !items.length) return { status: 400, body: { error: 'Cart is empty' } };
  if (!/^[6-9]\d{9}$/.test(customer.phone || '')) return { status: 400, body: { error: 'Invalid phone number' } };
  if (!/^\S+@\S+\.\S+$/.test(customer.email || '')) return { status: 400, body: { error: 'Invalid email' } };
  if (!customer.name) return { status: 400, body: { error: 'Name is required' } };

  // Always recompute the amount on the server. Never trust the browser.
  let sub = 0;
  for (const it of items) {
    const price = PRICES[it.id], qty = Math.floor(Number(it.qty));
    if (!price || !(qty > 0 && qty <= 99)) return { status: 400, body: { error: 'Invalid item in cart' } };
    sub += price * qty;
  }
  const pct = COUPONS[String(coupon).toUpperCase()] || 0;
  const after = sub - Math.round(sub * pct / 100);
  const allFree = items.every(it => FREE.has(String(it.id)));
  const ship = (pickup || allFree || after >= FREE_SHIP_ABOVE) ? 0 : SHIPPING;
  const amount = after + ship;

  if (expected !== undefined && Number(expected) !== amount) {
    return { status: 409, body: { error: `Price mismatch: the shop shows Rs ${expected} but the server calculated Rs ${amount}. Redeploy so the website and server use the same products.js.` } };
  }

  const orderId = 'DK' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
  const site = (process.env.SITE_URL || `https://${host}`).replace(/\/$/, '');
  const r = await fetch(PAYQ.base() + PAYQ.createPath, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      order_id: orderId,
      amount,
      currency: 'INR',
      note: ('Dhamaka Fireworks ' + orderId).slice(0, 100),
      webhook_url: site + '/api/payq-webhook',
      expires_in: 600
    })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { status: 502, body: { error: data.message || data.error || 'PayQ rejected the order' } };
  const qr = PAYQ.qrField(data);
  if (!qr) return { status: 502, body: { error: 'PayQ did not return a QR. Check the response field names in payq-core.js.' } };
  return { status: 200, body: { order_id: orderId, amount, qr_string: qr, expires_at: data.expires_at || null } };
}

// GET /api/order-status?order_id=...
async function orderStatus(id) {
  id = String(id || '');
  if (!/^[A-Za-z0-9_-]{6,60}$/.test(id)) return { status: 400, body: { error: 'Invalid order id' } };
  if (PAID.has(id)) return { status: 200, body: { order_id: id, paid: true, utr: PAID.get(id).utr } };
  if (!configured()) return { status: 500, body: { error: 'Payment is not configured on the server yet.' } };
  try {
    const r = await fetch(PAYQ.base() + PAYQ.statusPath(id), { headers: authHeaders() });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { status: 200, body: { order_id: id, paid: false } };   // not found / not paid yet
    const o = d.data || d;
    const paid = isPaid(o.status) || isPaid(o.payment_status) || isPaid(o.event);
    return { status: 200, body: { order_id: id, paid, utr: paid ? PAYQ.utrField(o) : '' } };
  } catch (e) {
    return { status: 200, body: { order_id: id, paid: false } };
  }
}

// POST /api/payq-webhook  (rawBody must be the untouched request body string)
function webhook(rawBody, headers) {
  const secret = process.env.PAYQ_SIGNING_SECRET;
  if (!secret) return { status: 500, body: { error: 'Not configured' } };
  const h = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  let sig = '';
  for (const name of PAYQ.signatureHeaders) if (h[name]) { sig = String(h[name]); break; }
  sig = sig.replace(/^sha256=/i, '').trim().toLowerCase();
  const expect = crypto.createHmac('sha256', secret).update(rawBody || '').digest('hex');
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (!sig || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { status: 401, body: { error: 'Bad signature' } };

  let p = {};
  try { p = JSON.parse(rawBody); } catch (e) { return { status: 400, body: { error: 'Bad JSON' } }; }
  const o = p.data || p;
  if (isPaid(p.event) || isPaid(o.status)) {
    const id = String(o.order_id || p.order_id || '');
    if (id) {
      PAID.set(id, { utr: PAYQ.utrField(o) || PAYQ.utrField(p), amount: o.amount, at: Date.now() });
      console.log('PAYQ PAID', id, 'UTR', PAYQ.utrField(o) || PAYQ.utrField(p), 'amount', o.amount);
    }
  }
  return { status: 200, body: { ok: true } };
}

module.exports = { createOrder, orderStatus, webhook };

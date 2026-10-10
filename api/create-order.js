// Vercel serverless function: creates a Cashfree order.
// Env vars (Vercel > Project > Settings > Environment Variables):
//   CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV ("sandbox" or "production"), SITE_URL (optional)
const PRODUCTS = require('../products.js');   // same file the website uses, so prices can never differ
const PRICES = Object.fromEntries(PRODUCTS.map(p => [p.id, p.price]));
const FREE = new Set(PRODUCTS.filter(p => p.free).map(p => String(p.id)));
const COUPONS = { DIWALI10: 10 };      // keep same as index.html
const FREE_SHIP_ABOVE = 999, SHIPPING = 60;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { items = [], customer = {}, coupon = '', pickup = false, expected } = req.body || {};
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Cart is empty' });
    if (!/^[6-9]\d{9}$/.test(customer.phone || '')) return res.status(400).json({ error: 'Invalid phone number' });
    if (!/^\S+@\S+\.\S+$/.test(customer.email || '')) return res.status(400).json({ error: 'Invalid email' });
    if (!customer.name) return res.status(400).json({ error: 'Name is required' });

    // Always recompute the amount on the server. Never trust the browser.
    let sub = 0;
    for (const it of items) {
      const price = PRICES[it.id], qty = Math.floor(Number(it.qty));
      if (!price || !(qty > 0 && qty <= 99)) return res.status(400).json({ error: 'Invalid item in cart' });
      sub += price * qty;
    }
    const pct = COUPONS[String(coupon).toUpperCase()] || 0;
    const after = sub - Math.round(sub * pct / 100);
    const allFree = items.every(it => FREE.has(String(it.id)));
    const ship = (pickup || allFree || after >= FREE_SHIP_ABOVE) ? 0 : SHIPPING;
    const amount = after + ship;

    // Safety check: the total the customer saw on the website must equal the total calculated here.
    // If not, the server copy of products.js is out of date, so stop instead of charging the wrong amount.
    if (expected !== undefined && Number(expected) !== amount) {
      return res.status(409).json({ error: `Price mismatch: the shop shows Rs ${expected} but the server calculated Rs ${amount}. The server copy of products.js is out of date. Redeploy so the website and server use the same products.js.` });
    }

    const orderId = 'DHM' + Date.now() + Math.floor(Math.random() * 900 + 100);
    const prod = process.env.CASHFREE_ENV === 'production';
    const base = prod ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    const site = process.env.SITE_URL || `https://${req.headers.host}`;

    const r = await fetch(base + '/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: 'cust_' + customer.phone,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone
        },
        order_meta: { return_url: `${site}/?order_id={order_id}` },
        order_note: (pickup ? 'PICKUP' : 'DELIVERY: ' + (customer.address || '')).slice(0, 200)
      })
    });
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: data.message || 'Cashfree rejected the order' });
    return res.status(200).json({ order_id: data.order_id, payment_session_id: data.payment_session_id, amount });
  } catch (e) {
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

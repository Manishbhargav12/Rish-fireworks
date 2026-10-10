// Vercel serverless function: checks the payment status of an order with Cashfree.
module.exports = async (req, res) => {
  const id = String(req.query.order_id || '');
  if (!/^[A-Za-z0-9_-]{6,60}$/.test(id)) return res.status(400).json({ error: 'Invalid order id' });
  try {
    const prod = process.env.CASHFREE_ENV === 'production';
    const base = prod ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    const r = await fetch(`${base}/orders/${id}`, {
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY
      }
    });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: d.message || 'Could not fetch order' });
    return res.status(200).json({ order_id: d.order_id, order_status: d.order_status, order_amount: d.order_amount });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};

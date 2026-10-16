// Netlify function: checks the payment status of an order with Cashfree.
const json = (statusCode, data) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

exports.handler = async (event) => {
  const id = String((event.queryStringParameters || {}).order_id || '');
  if (!/^[A-Za-z0-9_-]{6,60}$/.test(id)) return json(400, { error: 'Invalid order id' });
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
    if (!r.ok) return json(502, { error: d.message || 'Could not fetch order' });
    return json(200, { order_id: d.order_id, order_status: d.order_status, order_amount: d.order_amount });
  } catch (e) {
    return json(500, { error: 'Server error' });
  }
};

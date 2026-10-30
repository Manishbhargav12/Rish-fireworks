// Netlify function: creates a PayQ order. Logic lives in ../../payq-core.js
const core = require('../../payq-core.js');
const json = (statusCode, data) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Bad request' }); }
    const r = await core.createOrder(body, event.headers.host);
    return json(r.status, r.body);
  } catch (e) { console.error('create-order failed:', e); return json(500, { error: 'Server error: ' + (e && e.message) + (e && e.cause ? ' / ' + (e.cause.code || e.cause.message) : '') }); }
};

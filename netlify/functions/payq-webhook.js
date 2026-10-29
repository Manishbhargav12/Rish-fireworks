// Netlify function: receives PayQ's signed webhook (event.body is the raw body).
const core = require('../../payq-core.js');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: '{"error":"Method not allowed"}' };
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const r = core.webhook(raw, event.headers);
  return { statusCode: r.status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r.body) };
};

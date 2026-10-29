// Netlify function: is this order paid? Logic lives in ../../payq-core.js
const core = require('../../payq-core.js');
exports.handler = async (event) => {
  const r = await core.orderStatus((event.queryStringParameters || {}).order_id);
  return { statusCode: r.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(r.body) };
};

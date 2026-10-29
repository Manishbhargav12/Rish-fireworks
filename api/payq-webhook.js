// Vercel function: receives PayQ's signed webhook. Needs the RAW body to verify the HMAC.
const core = require('../payq-core.js');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const r = core.webhook(Buffer.concat(chunks).toString('utf8'), req.headers);
  return res.status(r.status).json(r.body);
};
module.exports.config = { api: { bodyParser: false } };

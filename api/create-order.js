// Vercel function: creates a PayQ order. Logic lives in ../payq-core.js
const core = require('../payq-core.js');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const r = await core.createOrder(req.body, req.headers.host);
    return res.status(r.status).json(r.body);
  } catch (e) { return res.status(500).json({ error: 'Server error. Please try again.' }); }
};

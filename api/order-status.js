// Vercel function: is this order paid? Logic lives in ../payq-core.js
const core = require('../payq-core.js');
module.exports = async (req, res) => {
  const r = await core.orderStatus(req.query.order_id);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(r.status).json(r.body);
};

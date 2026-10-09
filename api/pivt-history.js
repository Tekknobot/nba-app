// The browser is read-only. Predictions are written and verified by server-side functions.
const { list } = require('./pivt-store');
module.exports = async (req,res) => {
 res.setHeader('Cache-Control','no-store');
 if(req.method !== 'GET') return res.status(405).json({error:'Database writes are managed by the server'});
 try { return res.status(200).json({slates:await list()}); }
 catch(err) { console.error('PIVT history',err); return res.status(503).json({error:'Prediction database temporarily unavailable'}); }
};

export default async function handler(req, res) {
  try {
    const symbol = String(req.query.symbol || '').trim();
    const range = String(req.query.range || '3mo').trim();
    const interval = String(req.query.interval || '1d').trim();

    if (!symbol) {
      return res.status(400).json({ error: 'symbol is required' });
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;
    const response = await
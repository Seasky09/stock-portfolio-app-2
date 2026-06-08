export default async function handler(req, res) {
  try {
    const symbol = String(req.query.symbol || '').trim();
    const range = String(req.query.range || '3mo').trim();
    const interval = String(req.query.interval || '1d').trim();

    if (!symbol) {
      return res.status(400).json({ error: 'symbol is required' });
    }

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || 'history lookup failed' });
    }

    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp || [];
    const quote = result?.indicators?.quote?.[0] || {};
    const closes = quote.close || [];
    const meta = result?.meta || {};

    const points = timestamps
      .map((time, index) => ({
        date: new Date(time * 1000).toISOString().slice(0, 10),
        close: closes[index]
      }))
      .filter((item) => Number.isFinite(Number(item.close)))
      .map((item) => ({ ...item, close: Number(item.close) }));

    return res.status(200).json({
      symbol,
      range,
      interval,
      currency: meta.currency || '',
      regularMarketPrice: meta.regularMarketPrice ?? null,
      chartPreviousClose: meta.chartPreviousClose ?? null,
      points
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'history lookup failed' });
  }
}

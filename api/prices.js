export default async function handler(req, res) {
  try {
    const tickersParam = req.query.tickers || "";
    const tickers = tickersParam
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 30);

    if (tickers.length === 0) {
      return res.status(400).json({ error: "tickers is required" });
    }

    const results = {};

    await Promise.all(
      tickers.map(async (ticker) => {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0",
              "Accept": "application/json",
            },
          });

          if (!response.ok) {
            results[ticker] = null;
            return;
          }

          const data = await response.json();
          const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
          results[ticker] = typeof price === "number" ? price : null;
        } catch {
          results[ticker] = null;
        }
      })
    );

    return res.status(200).json({ prices: results });
  } catch (error) {
    return res.status(500).json({
      error: "price fetch failed",
      detail: error.message,
    });
  }
}

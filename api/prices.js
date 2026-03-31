export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const { symbols } = req.query
  if (!symbols) return res.status(400).json({ error: 'symbols parameter required' })

  const tickers = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  const results = {}

  await Promise.all(tickers.map(async (sym) => {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=1d`
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      if (!resp.ok) { results[sym] = null; return }
      const data = await resp.json()
      const meta = data?.chart?.result?.[0]?.meta
      results[sym] = meta ? {
        price: meta.regularMarketPrice || meta.previousClose || null,
        currency: meta.currency || 'USD',
        name: meta.shortName || meta.longName || sym,
        change: meta.regularMarketPrice && meta.previousClose
          ? ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2)
          : null,
      } : null
    } catch {
      results[sym] = null
    }
  }))

  res.status(200).json(results)
}
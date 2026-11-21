const HEADERS = { 'User-Agent': 'Mozilla/5.0' }
const CACHE = { revalidate: 300, tags: ['prices'] }

export interface Quote {
  price: number       // cours dans la devise de cotation
  currency: string    // devise de cotation (EUR, USD, GBP...)
  fxToEur: number     // 1 <devise> = x EUR
  priceEur: number    // cours converti en euros
  time: number | null // horodatage du dernier cours (secondes Unix)
}

// Repli si Yahoo ne renvoie pas la devise : suffixes des places cotées en EUR
const EUR_SUFFIXES = ['.PA', '.BR', '.AS', '.MI', '.DE', '.MC', '-EUR']

async function fetchMeta(symbol: string): Promise<any | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { headers: HEADERS, next: CACHE }
    )
    const data = await res.json()
    return data?.chart?.result?.[0]?.meta ?? null
  } catch {
    console.error(`Erreur prix pour ${symbol}`)
    return null
  }
}

/** 1 <devise> = x EUR, ou null si Yahoo ne donne pas de taux fiable. */
async function fxToEur(currency: string): Promise<number | null> {
  if (currency === 'EUR') return 1
  if (currency === 'USD') {
    const eurUsd = (await fetchMeta('EURUSD=X'))?.regularMarketPrice
    return eurUsd ? 1 / eurUsd : null
  }
  const direct = (await fetchMeta(`${currency}EUR=X`))?.regularMarketPrice
  if (direct) return direct
  const inverse = (await fetchMeta(`EUR${currency}=X`))?.regularMarketPrice
  return inverse ? 1 / inverse : null
}

/** Cours détaillés : devise de cotation (lue chez Yahoo), taux utilisé, heure du dernier cours. */
export async function fetchQuotes(symbols: string[]): Promise<Record<string, Quote>> {
  const quotes: Record<string, Quote> = {}
  const fxCache = new Map<string, Promise<number | null>>()
  const getFx = (cur: string) => {
    if (!fxCache.has(cur)) fxCache.set(cur, fxToEur(cur))
    return fxCache.get(cur)!
  }

  await Promise.all(
    symbols.map(async (symbol) => {
      const meta = await fetchMeta(symbol)
      const raw = meta?.regularMarketPrice
      if (!raw) return

      let currency: string = meta.currency || (EUR_SUFFIXES.some(s => symbol.includes(s)) ? 'EUR' : 'USD')
      let price: number = raw
      if (currency === 'GBp' || currency === 'GBX') { currency = 'GBP'; price = raw / 100 } // pence → livres

      const fx = await getFx(currency)
      if (fx == null) return // pas de taux fiable : mieux vaut « N/A » qu'un faux prix

      quotes[symbol] = { price, currency, fxToEur: fx, priceEur: price * fx, time: meta.regularMarketTime ?? null }
    })
  )
  return quotes
}

/** Cours en euros (même résultat que fetchQuotes, réduit au prix converti). */
export async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  const quotes = await fetchQuotes(symbols)
  const prices: Record<string, number> = {}
  for (const [symbol, q] of Object.entries(quotes)) prices[symbol] = q.priceEur
  return prices
}

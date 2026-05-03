export async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {}

  // Récupère le taux de change EUR/USD
  let usdToEur = 1
  try {
    const fxRes = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=1d',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } }
    )
    const fxData = await fxRes.json()
    const eurUsd = fxData?.chart?.result?.[0]?.meta?.regularMarketPrice
    if (eurUsd) usdToEur = 1 / eurUsd
  } catch {
    console.error('Erreur taux de change')
  }

  // Symboles cotés en EUR sur Yahoo (actions françaises et ETF Euronext)
  const eurSymbols = ['.PA', '.BR', '.AS', '.MI', '.DE', '.MC', '-EUR']

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 300 },
        })
        const data = await res.json()
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
        if (!price) return

        // Si le symbole est coté en EUR, pas de conversion
        const isEur = eurSymbols.some(suffix => symbol.includes(suffix))
        prices[symbol] = isEur ? price : price * usdToEur

      } catch {
        console.error(`Erreur prix pour ${symbol}`)
      }
    })
  )

  return prices
}

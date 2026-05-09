import { NextRequest, NextResponse } from 'next/server'
import { dbExecute } from '@/lib/db'
import { checkAuth } from '@/lib/auth'

// Récupère l'historique des prix Yahoo Finance pour un symbole
async function fetchHistory(symbol: string, period: string): Promise<{ date: string; close: number }[]> {
  const rangeMap: Record<string, { range: string; interval: string }> = {
    '1d': { range: '1d', interval: '5m' },
    '1mo': { range: '1mo', interval: '1d' },
    '1y': { range: '1y', interval: '1wk' },
    'max': { range: 'max', interval: '1mo' },
  }
  const { range, interval } = rangeMap[period] || rangeMap['1y']

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    })
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return []

    const timestamps: number[] = result.timestamp || []
    const closes: number[] = result.indicators?.quote?.[0]?.close || []

    return timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: closes[i] ?? null,
    })).filter(p => p.close !== null)
  } catch {
    return []
  }
}

// Taux EUR/USD
async function getEurUsd(): Promise<number> {
  try {
    const res = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=5d',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } }
    )
    const data = await res.json()
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    return rate ? 1 / rate : 0.92
  } catch {
    return 0.92
  }
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '1y'

  // Récupère toutes les transactions
  const txResult = await dbExecute(
    'SELECT date, symbole, type, quantite, cout_total FROM transactions ORDER BY date ASC'
  )
  const transactions = txResult.rows as any[]

  if (transactions.length === 0) return NextResponse.json([])

  // Récupère les symboles uniques
  const symbols = [...new Set(transactions.map((t: any) => t.symbole))] as string[]
  const eurUsdRate = await getEurUsd()
  const eurSymbols = ['.PA', '.BR', '.AS', '.MI', '.DE', '.MC', '-EUR']

  // Historique des prix pour chaque symbole
  const histories = await Promise.all(
    symbols.map(async (sym) => {
      const hist = await fetchHistory(sym, period)
      const isEur = eurSymbols.some(s => sym.includes(s))
      return {
        symbol: sym,
        prices: Object.fromEntries(
          hist.map(h => [h.date, isEur ? h.close : h.close * eurUsdRate])
        ),
      }
    })
  )

  const priceMap: Record<string, Record<string, number>> = {}
  for (const h of histories) priceMap[h.symbol] = h.prices

  // Toutes les dates disponibles (union de tous les historiques)
  const allDates = [...new Set(histories.flatMap(h => Object.keys(h.prices)))].sort()

  if (allDates.length === 0) return NextResponse.json([])

  // Pour chaque date, calcule la valeur du portfolio
  // en tenant compte des positions accumulées jusqu'à cette date
  const result = allDates.map(date => {
    // Positions à cette date
    const positions: Record<string, number> = {}
    for (const tx of transactions) {
      if (tx.date > date) break
      const qty = parseFloat(tx.quantite)
      positions[tx.symbole] = (positions[tx.symbole] || 0) + (tx.type === 'Achat' ? qty : -qty)
    }

    // Valeur totale
    let valeur = 0
    let hasPrice = false
    for (const [sym, qty] of Object.entries(positions)) {
      if (qty <= 0) continue
      // Prix le plus proche disponible pour ce symbole à cette date
      const symPrices = priceMap[sym] || {}
      const availDates = Object.keys(symPrices).filter(d => d <= date).sort()
      const lastDate = availDates[availDates.length - 1]
      if (lastDate) {
        valeur += qty * symPrices[lastDate]
        hasPrice = true
      }
    }

    return hasPrice ? { date, valeur: parseFloat(valeur.toFixed(2)) } : null
  }).filter(Boolean)

  return NextResponse.json(result)
}

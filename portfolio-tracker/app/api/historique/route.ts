import { NextRequest, NextResponse } from 'next/server'
import { dbExecute } from '@/lib/db'
import { checkAuth } from '@/lib/auth'

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
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } })
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return []
    const timestamps: number[] = result.timestamp || []
    const closes: number[] = result.indicators?.quote?.[0]?.close || []
    return timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      close: closes[i] ?? null,
    })).filter(p => p.close !== null)
  } catch { return [] }
}

async function getEurUsd(): Promise<number> {
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/EURUSD=X?interval=1d&range=5d',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } })
    const data = await res.json()
    const rate = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    return rate ? 1 / rate : 0.92
  } catch { return 0.92 }
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '1y'

  const txResult = await dbExecute('SELECT date, symbole, type, quantite, cout_total FROM transactions ORDER BY date ASC')
  const transactions = txResult.rows as any[]
  if (transactions.length === 0) return NextResponse.json([])

  const symbols = [...new Set(transactions.map((t: any) => t.symbole))] as string[]
  const eurUsdRate = await getEurUsd()
  const eurSymbols = ['.PA', '.BR', '.AS', '.MI', '.DE', '.MC', '-EUR']

  const histories = await Promise.all(
    symbols.map(async (sym) => {
      const hist = await fetchHistory(sym, period)
      const isEur = eurSymbols.some(s => sym.includes(s))
      return {
        symbol: sym,
        prices: Object.fromEntries(hist.map(h => [h.date, isEur ? h.close : h.close * eurUsdRate])),
      }
    })
  )

  const priceMap: Record<string, Record<string, number>> = {}
  for (const h of histories) priceMap[h.symbol] = h.prices

  const allDates = [...new Set(histories.flatMap(h => Object.keys(h.prices)))].sort()
  if (allDates.length === 0) return NextResponse.json([])

  const result = allDates.map(date => {
    // Calcul PRMP pour chaque symbole à cette date
    const prmp: Record<string, { qty: number; coutMoyen: number }> = {}

    for (const tx of transactions) {
      if (tx.date > date) break
      const qty = parseFloat(tx.quantite)
      const cout = parseFloat(tx.cout_total)
      const sym = tx.symbole

      if (!prmp[sym]) prmp[sym] = { qty: 0, coutMoyen: 0 }

      if (tx.type === 'Achat') {
        const totalAvant = prmp[sym].qty * prmp[sym].coutMoyen
        prmp[sym].qty += qty
        prmp[sym].coutMoyen = prmp[sym].qty > 0 ? (totalAvant + cout) / prmp[sym].qty : 0
      } else {
        // Vente : on réduit la quantité, le coutMoyen reste le même
        prmp[sym].qty = Math.max(0, prmp[sym].qty - qty)
      }
    }

    // Valeur de marché et coût total à cette date
    let valeurMarche = 0
    let coutTotal = 0
    let hasPrice = false

    for (const [sym, pos] of Object.entries(prmp)) {
      if (pos.qty <= 0) continue
      const symPrices = priceMap[sym] || {}
      const availDates = Object.keys(symPrices).filter(d => d <= date).sort()
      const lastDate = availDates[availDates.length - 1]
      if (lastDate) {
        valeurMarche += pos.qty * symPrices[lastDate]
        coutTotal += pos.qty * pos.coutMoyen
        hasPrice = true
      }
    }

    // Plus-value latente = valeur marché - coût d'achat
    const plusvalue = valeurMarche - coutTotal

    return hasPrice ? {
      date,
      plusvalue: parseFloat(plusvalue.toFixed(2)),
      valeur: parseFloat(valeurMarche.toFixed(2)),
      cout: parseFloat(coutTotal.toFixed(2)),
    } : null
  }).filter(Boolean)

  return NextResponse.json(result)
}

const HEADERS = { 'User-Agent': 'Mozilla/5.0' }

export type Period = '1mo' | '6mo' | '1y' | '5y' | 'max' | 'since'
export const PERIODS: Period[] = ['1mo', '6mo', '1y', '5y', 'max', 'since']

export interface Quote { date: string; close: number }
export interface Chart { points: Quote[]; currency: string | null; name: string | null }

/** Paramètres Yahoo (plage + pas) pour une période donnée. */
export function chartParams(period: Period, since?: string): string {
  switch (period) {
    case '1mo': return 'range=1mo&interval=1d'
    case '6mo': return 'range=6mo&interval=1d'
    case '1y': return 'range=1y&interval=1d'
    case '5y': return 'range=5y&interval=1wk'
    case 'max': return 'range=max&interval=1mo'
    default: {
      // depuis le premier achat (avec une marge d'une semaine)
      let start = since ? new Date(`${since}T00:00:00Z`) : new Date(NaN)
      if (isNaN(start.getTime())) start = new Date(Date.now() - 365 * 864e5)
      start.setUTCDate(start.getUTCDate() - 7)
      const days = (Date.now() - start.getTime()) / 864e5
      const interval = days <= 400 ? '1d' : days <= 365 * 6 ? '1wk' : '1mo'
      return `period1=${Math.floor(start.getTime() / 1000)}&period2=${Math.floor(Date.now() / 1000)}&interval=${interval}`
    }
  }
}

export async function fetchChart(symbol: string, params: string): Promise<Chart | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } })
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return null

    const timestamps: number[] = result.timestamp || []
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close || []
    const byDate = new Map<string, number>()
    timestamps.forEach((ts, i) => {
      const close = closes[i]
      if (close != null) byDate.set(new Date(ts * 1000).toISOString().slice(0, 10), close)
    })
    const points = Array.from(byDate.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, close]) => ({ date, close }))

    return {
      points,
      currency: result.meta?.currency ?? null,
      name: result.meta?.longName || result.meta?.shortName || null,
    }
  } catch {
    return null
  }
}

/** Taux de change quotidien « 1 <currency> = x EUR », indexé par date. */
export async function fetchFxToEur(currency: string, params: string): Promise<Record<string, number> | null> {
  const direct = await fetchChart(`${currency}EUR=X`, params)
  if (direct && direct.points.length > 0) {
    return Object.fromEntries(direct.points.map(p => [p.date, p.close]))
  }
  const inverse = await fetchChart(`EUR${currency}=X`, params)
  if (inverse && inverse.points.length > 0) {
    return Object.fromEntries(inverse.points.map(p => [p.date, 1 / p.close]))
  }
  return null
}

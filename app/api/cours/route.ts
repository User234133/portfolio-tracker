import { NextRequest, NextResponse } from 'next/server'
import { dbExecute } from '@/lib/db'
import { checkAuth } from '@/lib/auth'
import { Period, PERIODS, chartParams, fetchChart, fetchFxToEur } from '@/lib/yahoo'

const round = (n: number, d = 4) => parseFloat(n.toFixed(d))

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const symbole = searchParams.get('symbole')
  const periodParam = searchParams.get('period') || 'since'
  if (!symbole) return NextResponse.json({ error: 'Symbole manquant' }, { status: 400 })
  const period: Period = (PERIODS as string[]).includes(periodParam) ? (periodParam as Period) : 'since'

  // Transactions sur cette valeur
  const txResult = await dbExecute(
    'SELECT date, type, quantite, prix_unitaire, cout_total, nom FROM transactions WHERE symbole = ? ORDER BY date ASC, id ASC',
    [symbole]
  )
  const rows = txResult.rows as any[]

  // PRU (PRMP, frais inclus dans cout_total) et quantité après chaque transaction
  let qty = 0
  let pru = 0
  const trades = rows.map(tx => {
    const q = parseFloat(tx.quantite)
    const cout = parseFloat(tx.cout_total)
    if (tx.type === 'Achat') {
      pru = (qty * pru + cout) / (qty + q)
      qty += q
    } else {
      qty = Math.max(0, qty - q)
      if (qty === 0) pru = 0
    }
    return {
      date: String(tx.date).slice(0, 10),
      type: tx.type as string,
      quantite: q,
      prix: parseFloat(tx.prix_unitaire),
      pruApres: pru,
      qtyApres: qty,
    }
  })

  // Historique de cours
  const params = chartParams(period, trades[0]?.date)
  const chart = await fetchChart(symbole, params)
  if (!chart || chart.points.length === 0) {
    return NextResponse.json({
      symbole, nom: rows[0]?.nom ?? symbole, points: [], erreur: 'Cours indisponible pour cette valeur',
    })
  }

  // Conversion en EUR (taux journalier) si la valeur est cotée dans une autre devise
  let currency = chart.currency || 'EUR'
  let factor = 1
  if (currency === 'GBp') { currency = 'GBP'; factor = 0.01 } // pence → livres
  let fx: Record<string, number> | null = null
  let convertie = currency === 'EUR'
  if (currency !== 'EUR') {
    fx = await fetchFxToEur(currency, params)
    convertie = fx !== null
  }
  const fxDates = fx ? Object.keys(fx).sort() : []

  // Construction de la série : cours, PRU en vigueur, quantité détenue
  const points: any[] = []
  let ti = 0
  let pruCourant: number | null = null
  let qtyCourante = 0
  let j = -1
  let taux = fx ? fx[fxDates[0]] : 1
  for (let i = 0; i < chart.points.length; i++) {
    const p = chart.points[i]
    const nextDate = chart.points[i + 1]?.date ?? '9999-12-31'
    while (fx && j + 1 < fxDates.length && fxDates[j + 1] <= p.date) { j++; taux = fx[fxDates[j]] }
    // une transaction est rattachée au point de cours qui la contient (même point que son marqueur)
    while (ti < trades.length && trades[ti].date < nextDate) {
      qtyCourante = trades[ti].qtyApres
      pruCourant = qtyCourante > 0 ? trades[ti].pruApres : null
      ti++
    }
    points.push({
      date: p.date,
      prix: round(p.close * factor * (fx ? taux : 1)),
      pru: pruCourant != null ? round(pruCourant) : null,
      quantite: qtyCourante,
    })
  }

  // Marqueurs achats / ventes, rattachés au dernier point de cours <= date de la transaction
  for (const t of trades) {
    let idx = -1
    for (let i = points.length - 1; i >= 0; i--) { if (points[i].date <= t.date) { idx = i; break } }
    if (idx < 0) continue
    const key = t.type === 'Achat' ? 'achat' : 'vente'
    const pt = points[idx]
    const prevQty = pt[`${key}Qty`] || 0
    const prevPrix = pt[key] || 0
    const newQty = prevQty + t.quantite
    pt[key] = round((prevPrix * prevQty + t.prix * t.quantite) / newQty)
    pt[`${key}Qty`] = newQty
  }

  const first = points[0].prix
  const last = points[points.length - 1].prix
  return NextResponse.json({
    symbole,
    nom: rows[0]?.nom || chart.name || symbole,
    devise: convertie ? 'EUR' : currency,
    convertie,
    points,
    dernierPrix: last,
    variationPeriode: first ? ((last - first) / first) * 100 : null,
    pruActuel: qty > 0 ? round(pru) : null,
    quantite: qty,
  })
}

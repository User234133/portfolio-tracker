import { NextRequest, NextResponse } from 'next/server'
import { dbExecute } from '@/lib/db'
import { checkAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const txResult = await dbExecute('SELECT * FROM transactions ORDER BY date ASC')
  const transactions = txResult.rows as any[]

  // Calcul PRMP et P&L réalisé par symbole
  const prmp: Record<string, { qty: number; coutMoyen: number }> = {}
  const pnlRealise: Record<string, { symbole: string; nom: string; pnl: number; ventes: number }> = {}

  for (const tx of transactions) {
    const sym = tx.symbole
    const qty = parseFloat(tx.quantite)
    const cout = parseFloat(tx.cout_total)

    if (!prmp[sym]) prmp[sym] = { qty: 0, coutMoyen: 0 }
    if (!pnlRealise[sym]) pnlRealise[sym] = { symbole: sym, nom: tx.nom, pnl: 0, ventes: 0 }

    if (tx.type === 'Achat') {
      const totalAvant = prmp[sym].qty * prmp[sym].coutMoyen
      prmp[sym].qty += qty
      prmp[sym].coutMoyen = prmp[sym].qty > 0 ? (totalAvant + cout) / prmp[sym].qty : 0
    } else if (tx.type === 'Vente') {
      // P&L réalisé = montant encaissé - (qté vendue × PRMP)
      const pnl = cout - qty * prmp[sym].coutMoyen
      pnlRealise[sym].pnl += pnl
      pnlRealise[sym].ventes += cout
      prmp[sym].qty = Math.max(0, prmp[sym].qty - qty)
    }
  }

  const result = Object.values(pnlRealise)
    .filter(p => p.ventes > 0)
    .sort((a, b) => b.pnl - a.pnl)

  return NextResponse.json(result)
}

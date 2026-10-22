import { NextRequest, NextResponse } from 'next/server'
import { dbExecute } from '@/lib/db'
import { checkAuth } from '@/lib/auth'
import { computeLines } from '@/lib/portfolio'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const txResult = await dbExecute(
    'SELECT symbole, nom, compte, type, quantite, cout_total FROM transactions ORDER BY date ASC, id ASC'
  )

  // P&L réalisé par symbole (tous comptes confondus), calculé avec le PRMP de chaque compte
  const parSymbole = new Map<string, { symbole: string; nom: string; pnl: number; ventes: number }>()
  for (const l of computeLines(txResult.rows as any[])) {
    const p = parSymbole.get(l.symbole) ?? { symbole: l.symbole, nom: l.nom, pnl: 0, ventes: 0 }
    p.pnl += l.realise
    p.ventes += l.ventes
    parSymbole.set(l.symbole, p)
  }

  const result = Array.from(parSymbole.values())
    .filter(p => p.ventes > 0)
    .sort((a, b) => b.pnl - a.pnl)

  return NextResponse.json(result)
}

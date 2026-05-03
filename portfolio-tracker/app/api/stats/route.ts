import { NextRequest, NextResponse } from 'next/server'
import { dbExecute } from '@/lib/db'
import { checkAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [depots, retraits, dividendes, depositsOverTime, repartitionAsset, transactionsParMois] = await Promise.all([
    dbExecute(`SELECT compte, SUM(montant) as total FROM flux_tresorerie WHERE type = 'Depot' GROUP BY compte`),
    dbExecute(`SELECT compte, SUM(montant) as total FROM flux_tresorerie WHERE type = 'Retrait' GROUP BY compte`),
    dbExecute(`SELECT compte, SUM(montant) as total, COUNT(*) as nb FROM flux_tresorerie WHERE type = 'Dividende' GROUP BY compte`),
    dbExecute(`SELECT date, compte, type, montant FROM flux_tresorerie ORDER BY date ASC`),
    dbExecute(`SELECT symbole, nom, compte, SUM(cout_total) as investi FROM transactions WHERE type = 'Achat' GROUP BY symbole, compte ORDER BY investi DESC`),
    dbExecute(`SELECT strftime('%Y-%m', date) as mois, COUNT(*) as nb, SUM(cout_total) as volume FROM transactions GROUP BY mois ORDER BY mois`),
  ])

  return NextResponse.json({
    depots: depots.rows,
    retraits: retraits.rows,
    dividendes: dividendes.rows,
    depositsOverTime: depositsOverTime.rows,
    repartitionAsset: repartitionAsset.rows,
    transactionsParMois: transactionsParMois.rows,
  })
}

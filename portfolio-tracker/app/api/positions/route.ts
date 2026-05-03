import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { fetchPrices } from '@/lib/prices'
import { checkAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Récupère toutes les transactions
  const result = await db.execute(`
    SELECT symbole, nom, compte, type, SUM(quantite) as quantite, SUM(cout_total) as cout_total
    FROM transactions
    GROUP BY symbole, compte
    ORDER BY compte, symbole
  `)

  const rows = result.rows as any[]

  // Calcule les positions nettes
  const positions: Record<string, any> = {}
  for (const row of rows) {
    const key = `${row.symbole}-${row.compte}`
    if (!positions[key]) {
      positions[key] = {
        symbole: row.symbole,
        nom: row.nom,
        compte: row.compte,
        quantite: 0,
        cout_total: 0,
      }
    }
    if (row.type === 'Achat') {
      positions[key].quantite += row.quantite
      positions[key].cout_total += row.cout_total
    } else {
      positions[key].quantite -= row.quantite
      positions[key].cout_total -= row.cout_total
    }
  }

  const positionsArray = Object.values(positions).filter(p => p.quantite > 0.000001)
  const symbols = [...new Set(positionsArray.map(p => p.symbole))]

  // Prix en temps réel
  const prices = await fetchPrices(symbols)

  // Enrichit avec les prix live
  const enriched = positionsArray.map(pos => {
    const prixActuel = prices[pos.symbole] ?? null
    const valeurActuelle = prixActuel ? prixActuel * pos.quantite : null
    const prixRevient = pos.quantite > 0 ? pos.cout_total / pos.quantite : 0
    const plusvalue = valeurActuelle ? valeurActuelle - pos.cout_total : null
    const plusvaluePct = plusvalue && pos.cout_total ? (plusvalue / pos.cout_total) * 100 : null

    return {
      ...pos,
      prixActuel,
      valeurActuelle,
      prixRevient,
      plusvalue,
      plusvaluePct,
    }
  })

  return NextResponse.json(enriched)
}

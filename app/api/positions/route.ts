import { NextRequest, NextResponse } from 'next/server'
import { dbExecute } from '@/lib/db'
import { fetchPrices } from '@/lib/prices'
import { checkAuth } from '@/lib/auth'
import { computeLines } from '@/lib/portfolio'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await dbExecute(
    'SELECT symbole, nom, compte, type, quantite, cout_total FROM transactions ORDER BY date ASC, id ASC'
  )

  const positionsArray = computeLines(result.rows as any[])
    .filter(l => l.quantite > 1e-6)
    .sort((a, b) => a.compte.localeCompare(b.compte) || a.symbole.localeCompare(b.symbole))

  const symbols = Array.from(new Set(positionsArray.map(p => p.symbole)))
  const prices = await fetchPrices(symbols)

  const enriched = positionsArray.map(pos => {
    const prixActuel = prices[pos.symbole] ?? null
    const valeurActuelle = prixActuel ? prixActuel * pos.quantite : null
    const prixRevient = pos.cout / pos.quantite
    const plusvalue = valeurActuelle ? valeurActuelle - pos.cout : null
    const plusvaluePct = plusvalue && pos.cout ? (plusvalue / pos.cout) * 100 : null
    return {
      symbole: pos.symbole,
      nom: pos.nom,
      compte: pos.compte,
      quantite: pos.quantite,
      cout_total: pos.cout,
      prixActuel,
      valeurActuelle,
      prixRevient,
      plusvalue,
      plusvaluePct,
    }
  })

  return NextResponse.json(enriched)
}

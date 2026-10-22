import { NextRequest, NextResponse } from 'next/server'
import { dbExecute } from '@/lib/db'
import { checkAuth } from '@/lib/auth'
import { fetchPrices } from '@/lib/prices'
import { computeLines } from '@/lib/portfolio'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [tx, div] = await Promise.all([
    dbExecute('SELECT date, symbole, nom, compte, type, quantite, cout_total FROM transactions ORDER BY date ASC, id ASC'),
    dbExecute(`SELECT strftime('%Y-%m', date) as mois, compte, SUM(montant) as total FROM flux_tresorerie WHERE type = 'Dividende' GROUP BY mois, compte ORDER BY mois`),
  ])
  const txRows = tx.rows as any[]

  const lines = computeLines(txRows)
  const symbols = Array.from(new Set(lines.filter(l => l.quantite > 1e-6).map(l => l.symbole)))
  const prices = await fetchPrices(symbols)

  // Une ligne par valeur et par compte (positions ouvertes + positions soldées avec du réalisé)
  const lignes = lines
    .filter(l => l.quantite > 1e-6 || l.ventes > 0)
    .map(l => {
      const ouvert = l.quantite > 1e-6
      const prix = ouvert ? prices[l.symbole] ?? null : null
      const valeur = ouvert ? (prix != null ? prix * l.quantite : l.cout) : 0
      const latent = ouvert ? valeur - l.cout : 0
      return {
        symbole: l.symbole,
        nom: l.nom,
        compte: l.compte,
        quantite: l.quantite,
        pru: ouvert ? l.cout / l.quantite : 0,
        cout: l.cout,
        achats: l.achats,
        valeur,
        latent,
        realise: l.realise,
        total: latent + l.realise,
        prixManquant: ouvert && prix == null,
      }
    })

  // Totaux par compte (PEA, CTO...) : latent + réalisé + dividendes
  const parCompte = new Map<string, any>()
  const getCompte = (compte: string) => {
    if (!parCompte.has(compte)) {
      parCompte.set(compte, { compte, valeur: 0, cout: 0, achats: 0, latent: 0, realise: 0, dividendes: 0 })
    }
    return parCompte.get(compte)
  }
  for (const l of lignes) {
    const c = getCompte(l.compte)
    c.valeur += l.valeur; c.cout += l.cout; c.achats += l.achats; c.latent += l.latent; c.realise += l.realise
  }
  for (const d of div.rows as any[]) getCompte(d.compte).dividendes += parseFloat(d.total)
  const comptes = Array.from(parCompte.values())
    .map(c => {
      const total = c.latent + c.realise + c.dividendes
      return { ...c, total, totalPct: c.achats > 0 ? (total / c.achats) * 100 : null }
    })
    .sort((a, b) => a.compte.localeCompare(b.compte))

  // Achats par mois
  const achats = new Map<string, number>()
  for (const t of txRows) {
    if (t.type !== 'Achat') continue
    const mois = String(t.date).slice(0, 7)
    achats.set(mois, (achats.get(mois) ?? 0) + parseFloat(t.cout_total))
  }
  const achatsParMois = Array.from(achats.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([mois, montant]) => ({ mois, montant }))

  const dividendesParMois = (div.rows as any[]).map(d => ({ mois: d.mois, compte: d.compte, montant: parseFloat(d.total) }))

  return NextResponse.json({ lignes, comptes, achatsParMois, dividendesParMois })
}

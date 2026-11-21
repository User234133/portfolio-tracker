import { NextRequest, NextResponse } from 'next/server'
import { dbExecute } from '@/lib/db'
import { checkAuth } from '@/lib/auth'
import { fetchQuotes } from '@/lib/prices'
import { computeLines } from '@/lib/portfolio'

const DAY = 864e5
const num = (n: number | null | undefined, d = 2) => (n == null || !isFinite(n) ? 'N/A' : n.toFixed(d))
const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
const paris = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).slice(0, 16) // AAAA-MM-JJ HH:MM

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [txRes, fluxRes] = await Promise.all([
    dbExecute('SELECT date, symbole, nom, compte, type, quantite, cout_total FROM transactions ORDER BY date ASC, id ASC'),
    dbExecute('SELECT date, compte, type, montant FROM flux_tresorerie'),
  ])
  const flux = (fluxRes.rows as any[]).map(f => ({ date: String(f.date).slice(0, 10), compte: f.compte as string, type: f.type as string, montant: parseFloat(f.montant) }))

  const now = new Date()
  const lines = computeLines(txRes.rows as any[])
  const ouvertes = lines
    .filter(l => l.quantite > 1e-6)
    .sort((a, b) => a.compte.localeCompare(b.compte) || a.symbole.localeCompare(b.symbole))
  const soldees = lines
    .filter(l => l.quantite <= 1e-6 && l.ventes > 0)
    .sort((a, b) => a.compte.localeCompare(b.compte) || a.symbole.localeCompare(b.symbole))

  const quotes = await fetchQuotes(Array.from(new Set(ouvertes.map(l => l.symbole))))

  // Valeur de chaque ligne ouverte (si le cours manque : coût de revient, comme le dashboard)
  const enrichies = ouvertes.map(l => {
    const q = quotes[l.symbole]
    const valeur = q ? q.priceEur * l.quantite : l.cout
    return { l, q, valeur, pv: q ? valeur - l.cout : null }
  })
  const valeurTotale = enrichies.reduce((s, e) => s + e.valeur, 0)
  const capitalInvesti = enrichies.reduce((s, e) => s + e.l.cout, 0)
  const latent = valeurTotale - capitalInvesti
  const realise = lines.reduce((s, l) => s + l.realise, 0)
  const dividendes = flux.filter(f => f.type === 'Dividende').reduce((s, f) => s + f.montant, 0)
  const pnlTotal = latent + realise + dividendes

  // Apports (dépôts - retraits)
  const depots = flux.filter(f => f.type === 'Depot').reduce((s, f) => s + f.montant, 0)
  const retraits = flux.filter(f => f.type === 'Retrait').reduce((s, f) => s + f.montant, 0)
  const datesFlux = flux.filter(f => f.type === 'Depot' || f.type === 'Retrait').map(f => f.date).sort()
  const mois = datesFlux.length ? Math.max(1, (now.getTime() - new Date(datesFlux[0]).getTime()) / DAY / 30.4375) : null
  const il12m = new Date(now.getTime() - 365 * DAY).toISOString().slice(0, 10)
  const net12m = flux.filter(f => f.date >= il12m).reduce((s, f) => s + (f.type === 'Depot' ? f.montant : f.type === 'Retrait' ? -f.montant : 0), 0)
  const usd = Object.values(quotes).find(q => q.currency === 'USD')

  // Totaux par compte
  const comptes = Array.from(new Set([...lines.map(l => l.compte), ...flux.map(f => f.compte)])).sort()
  const parCompte = comptes.map(c => {
    const ev = enrichies.filter(e => e.l.compte === c)
    const valeur = ev.reduce((s, e) => s + e.valeur, 0)
    const investi = ev.reduce((s, e) => s + e.l.cout, 0)
    const real = lines.filter(l => l.compte === c).reduce((s, l) => s + l.realise, 0)
    const div = flux.filter(f => f.compte === c && f.type === 'Dividende').reduce((s, f) => s + f.montant, 0)
    return { c, valeur, investi, latent: valeur - investi, real, div, total: valeur - investi + real + div }
  })

  const dateExport = paris(now)
  const out: string[] = []
  out.push('# RESUME PORTEFEUILLE')
  out.push(`# Date_Export;${dateExport} (heure de Paris)`)
  out.push(`# Taux_EUR_USD;${usd ? num(1 / usd.fxToEur, 4) : 'N/A'}`)
  out.push(`# Valeur_Totale (€);${num(valeurTotale)}`)
  out.push(`# Capital_Investi (€);${num(capitalInvesti)}`)
  out.push(`# Plus_Value_Latente (€);${num(latent)}`)
  out.push(`# PnL_Realise (€);${num(realise)}`)
  out.push(`# Dividendes_Recus (€);${num(dividendes)}`)
  out.push(`# PnL_Total (€);${num(pnlTotal)}`)
  out.push(`# Capital_Verse_Net (€);${datesFlux.length ? num(depots - retraits) : 'N/A'}`)
  out.push(`# Apport_Mensuel_Moyen (€);${mois ? num((depots - retraits) / mois) : 'N/A'}`)
  out.push(`# Apport_Mensuel_12_derniers_mois (€);${datesFlux.length ? num(net12m / 12) : 'N/A'}`)
  out.push('# REPARTITION PAR COMPTE')
  out.push('# Compte;Valeur (€);Poids (%);Investi (€);PnL_Latent (€);PnL_Realise (€);Dividendes (€);PnL_Total (€)')
  for (const c of parCompte) {
    out.push(`# ${esc(c.c)};${num(c.valeur)};${num(valeurTotale > 0 ? (c.valeur / valeurTotale) * 100 : 0)};${num(c.investi)};${num(c.latent)};${num(c.real)};${num(c.div)};${num(c.total)}`)
  }
  out.push('# NOTES : PRU frais de courtage inclus ; cours Yahoo possiblement décalés (voir Heure_Dernier_Cours) ; Poids = part de la valeur actuelle ; PnL_Total = latent + réalisé + dividendes ; les dividendes ne sont pas rattachés à une valeur, seulement à un compte ; Statut Soldée = position entièrement vendue (PnL_Realise uniquement).')
  out.push('')

  out.push([
    'Symbole', 'Nom', 'Compte', 'Quantité', 'Prix revient (€)', 'Prix actuel (€)', 'Valeur (€)', 'Plus-value (€)', 'Plus-value (%)',
    'Statut', 'Poids_Portefeuille (%)', 'Poids_Compte (%)', 'Montant_Investi (€)', 'Date_1er_Achat', 'Duree_Detention (j)', 'PnL_Realise (€)',
    'Devise_Cotation', 'Prix_Cotation', 'Taux_Change_vers_EUR', 'Heure_Dernier_Cours', 'Date_Export',
  ].join(';'))

  const jours = (d?: string) => (d ? String(Math.max(0, Math.floor((now.getTime() - new Date(d).getTime()) / DAY))) : 'N/A')

  for (const { l, q, valeur, pv } of enrichies) {
    const valCompte = parCompte.find(c => c.c === l.compte)?.valeur || 0
    out.push([
      esc(l.symbole), esc(l.nom), esc(l.compte), num(l.quantite, 6), num(l.cout / l.quantite, 4), num(q?.priceEur, 4), num(valeur),
      num(pv), pv != null && l.cout > 0 ? num((pv / l.cout) * 100) : 'N/A',
      'Ouverte', num(valeurTotale > 0 ? (valeur / valeurTotale) * 100 : 0), num(valCompte > 0 ? (valeur / valCompte) * 100 : 0),
      num(l.cout), l.premierAchat ?? 'N/A', jours(l.premierAchat), num(l.realise),
      q?.currency ?? 'N/A', num(q?.price, 4), num(q?.fxToEur, 6), q?.time ? paris(new Date(q.time * 1000)) : 'N/A', dateExport,
    ].join(';'))
  }
  for (const l of soldees) {
    out.push([
      esc(l.symbole), esc(l.nom), esc(l.compte), num(0, 6), 'N/A', 'N/A', num(0), num(0), 'N/A',
      'Soldée', num(0), num(0), num(0), l.premierAchat ?? 'N/A', jours(l.premierAchat), num(l.realise),
      'N/A', 'N/A', 'N/A', 'N/A', dateExport,
    ].join(';'))
  }

  return new NextResponse('\uFEFF' + out.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="portfolio_${now.toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

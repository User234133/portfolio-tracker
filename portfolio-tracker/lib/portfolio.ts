export interface Ligne {
  symbole: string
  nom: string
  compte: string
  quantite: number // quantité détenue
  cout: number     // coût de revient de la position (quantité × PRU, frais inclus)
  achats: number   // total cumulé des achats
  realise: number  // P&L réalisé (montant encaissé - quantité vendue × PRU)
  ventes: number   // total cumulé encaissé sur les ventes
}

/**
 * Calcule, par valeur ET par compte (PEA / CTO...), la quantité détenue, le coût de revient
 * (PRMP) et le P&L réalisé. `rows` doit être trié par date puis par id.
 * C'est la seule logique de calcul : positions, P&L et analyse l'utilisent toutes.
 */
export function computeLines(rows: any[]): Ligne[] {
  const map = new Map<string, Ligne>()

  for (const tx of rows) {
    const key = `${tx.symbole}||${tx.compte}`
    let l = map.get(key)
    if (!l) {
      l = { symbole: tx.symbole, nom: tx.nom || tx.symbole, compte: tx.compte, quantite: 0, cout: 0, achats: 0, realise: 0, ventes: 0 }
      map.set(key, l)
    }
    const q = parseFloat(tx.quantite)
    const montant = parseFloat(tx.cout_total)

    if (tx.type === 'Achat') {
      l.quantite += q
      l.cout += montant
      l.achats += montant
    } else {
      const pru = l.quantite > 0 ? l.cout / l.quantite : 0
      const vendue = Math.min(q, l.quantite)
      l.realise += montant - q * pru
      l.ventes += montant
      l.cout -= vendue * pru
      l.quantite -= vendue
      if (l.quantite < 1e-9) { l.quantite = 0; l.cout = 0 }
    }
  }

  return Array.from(map.values())
}

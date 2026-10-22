'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

function StatCard({ label, value, sub, color, subColor }: { label: string; value: string; sub?: string; color?: string; subColor?: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor || 'text-slate-400'}`}>{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [positions, setPositions] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [pnlRealise, setPnlRealise] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [posRes, statRes, pnlRes] = await Promise.all([
        fetch('/api/positions'),
        fetch('/api/stats'),
        fetch('/api/pnl'),
      ])
      if (posRes.status === 401) { router.push('/'); return }
      setPositions(await posRes.json())
      setStats(await statRes.json())
      setPnlRealise(await pnlRes.json())
      setLoading(false)
    }
    load()
  }, [router])

  function exportCSV() {
    const headers = ['Symbole','Nom','Compte','Quantité','Prix revient (€)','Prix actuel (€)','Valeur (€)','Plus-value (€)','Plus-value (%)']
    const rows = positions.map(p => [
      p.symbole, p.nom, p.compte,
      p.quantite.toFixed(6),
      p.prixRevient.toFixed(4),
      p.prixActuel?.toFixed(4) ?? 'N/A',
      (p.valeurActuelle ?? p.cout_total).toFixed(2),
      p.plusvalue?.toFixed(2) ?? 'N/A',
      p.plusvaluePct?.toFixed(2) ?? 'N/A',
    ])
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `portfolio_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="min-h-screen"><Navbar />
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-400">Chargement des données...</div>
      </div>
    </div>
  )

  // KPIs
  const valeurTotale = positions.reduce((s, p) => s + (p.valeurActuelle ?? p.cout_total), 0)
  const coutTotal = positions.reduce((s, p) => s + p.cout_total, 0)
  const plusvalueTotale = valeurTotale - coutTotal
  const plusvaluePct = coutTotal > 0 ? (plusvalueTotale / coutTotal) * 100 : 0
  const totalDividendes = stats?.dividendes?.reduce((s: number, d: any) => s + parseFloat(d.total), 0) || 0
  const pnlRealiseTotal = pnlRealise.reduce((s, p) => s + p.pnl, 0)
  const pnlTotal = plusvalueTotale + pnlRealiseTotal + totalDividendes

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Valeur totale" value={fmt(valeurTotale)} sub={`Investi : ${fmt(coutTotal)}`} />
          <StatCard label="P&L total" value={`${pnlTotal >= 0 ? '+' : ''}${fmt(pnlTotal)}`}
            sub="Latent + réalisé + dividendes"
            color={pnlTotal >= 0 ? 'text-green-400' : 'text-red-400'} />
          <StatCard label="Plus-value latente" value={fmt(plusvalueTotale)} sub={fmtPct(plusvaluePct)}
            color={plusvalueTotale >= 0 ? 'text-green-400' : 'text-red-400'}
            subColor={plusvalueTotale >= 0 ? 'text-green-500' : 'text-red-500'} />
          <StatCard label="P&L réalisé (ventes)" value={fmt(pnlRealiseTotal)}
            sub="Basé sur le PRMP"
            color={pnlRealiseTotal >= 0 ? 'text-green-400' : 'text-red-400'} />
          <StatCard label="Dividendes reçus" value={fmt(totalDividendes)} color="text-yellow-400" />
        </div>

        {/* Tableau positions */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-slate-200">Positions actuelles</h2>
            <button onClick={exportCSV}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm px-3 py-1.5 rounded-lg transition-colors">
              ⬇ Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left border-b border-slate-700 text-xs">
                  <th className="px-4 py-3">Actif</th>
                  <th className="px-4 py-3">Compte</th>
                  <th className="px-4 py-3 text-right">Qté</th>
                  <th className="px-4 py-3 text-right">PRMP</th>
                  <th className="px-4 py-3 text-right">Prix actuel</th>
                  <th className="px-4 py-3 text-right">Valeur</th>
                  <th className="px-4 py-3 text-right">+/- Val. €</th>
                  <th className="px-4 py-3 text-right">+/- Val. %</th>
                  <th className="px-4 py-3 text-right">Poids</th>
                </tr>
              </thead>
              <tbody>
                {[...positions]
                  .sort((a, b) => (b.valeurActuelle ?? b.cout_total) - (a.valeurActuelle ?? a.cout_total))
                  .map((p, i) => {
                    const valeur = p.valeurActuelle ?? p.cout_total
                    const poids = valeurTotale > 0 ? (valeur / valeurTotale) * 100 : 0
                    return (
                      <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            <Link href={`/graphiques?symbole=${encodeURIComponent(p.symbole)}`} className="text-white hover:text-indigo-400 transition-colors">{p.symbole}</Link>
                          </div>
                          <div className="text-slate-400 text-xs truncate max-w-[140px]">{p.nom}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{p.compte}</td>
                        <td className="px-4 py-3 text-right text-slate-300 text-xs">{p.quantite.toFixed(p.quantite < 1 ? 5 : 3)}</td>
                        <td className="px-4 py-3 text-right text-slate-300 text-xs">{fmt(p.prixRevient)}</td>
                        <td className="px-4 py-3 text-right text-slate-300 text-xs">
                          {p.prixActuel ? fmt(p.prixActuel) : <span className="text-slate-500">N/A</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-white">{fmt(valeur)}</td>
                        <td className={`px-4 py-3 text-right font-medium text-xs ${(p.plusvalue ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.plusvalue != null ? `${p.plusvalue >= 0 ? '+' : ''}${fmt(p.plusvalue)}` : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium text-xs ${(p.plusvaluePct ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {p.plusvaluePct != null ? fmtPct(p.plusvaluePct) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 bg-slate-700 rounded-full h-1.5">
                              <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(poids, 100)}%` }} />
                            </div>
                            <span className="text-slate-400 text-xs w-8 text-right">{poids.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-600 bg-slate-700/30">
                  <td className="px-4 py-3 font-semibold text-slate-200" colSpan={5}>Total</td>
                  <td className="px-4 py-3 text-right font-bold text-white">{fmt(valeurTotale)}</td>
                  <td className={`px-4 py-3 text-right font-bold text-xs ${plusvalueTotale >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {plusvalueTotale >= 0 ? '+' : ''}{fmt(plusvalueTotale)}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold text-xs ${plusvaluePct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtPct(plusvaluePct)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

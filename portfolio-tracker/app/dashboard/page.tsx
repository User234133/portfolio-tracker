'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts'

const COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#06b6d4','#84cc16','#a855f7','#fb923c','#10b981','#3b82f6']

const PERIODS = [
  { key: '1d', label: 'Jour' },
  { key: '1mo', label: 'Mois' },
  { key: '1y', label: 'Année' },
  { key: 'max', label: 'Total' },
]

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

function PeriodBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
      {label}
    </button>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [positions, setPositions] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [historique, setHistorique] = useState<any[]>([])
  const [period, setPeriod] = useState('1y')
  const [loading, setLoading] = useState(true)
  const [loadingHist, setLoadingHist] = useState(false)

  useEffect(() => {
    async function load() {
      const [posRes, statRes] = await Promise.all([fetch('/api/positions'), fetch('/api/stats')])
      if (posRes.status === 401) { router.push('/'); return }
      setPositions(await posRes.json())
      setStats(await statRes.json())
      setLoading(false)
    }
    load()
  }, [router])

  const loadHistorique = useCallback(async (p: string) => {
    setLoadingHist(true)
    const res = await fetch(`/api/historique?period=${p}`)
    setHistorique(await res.json())
    setLoadingHist(false)
  }, [])

  useEffect(() => { loadHistorique(period) }, [period, loadHistorique])

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

  const valeurTotale = positions.reduce((s, p) => s + (p.valeurActuelle ?? p.cout_total), 0)
  const coutTotal = positions.reduce((s, p) => s + p.cout_total, 0)
  const plusvalueTotale = valeurTotale - coutTotal
  const plusvaluePct = coutTotal > 0 ? (plusvalueTotale / coutTotal) * 100 : 0
  const totalDepots = stats?.depots?.reduce((s: number, d: any) => s + parseFloat(d.total), 0) || 0
  const totalDividendes = stats?.dividendes?.reduce((s: number, d: any) => s + parseFloat(d.total), 0) || 0
  const totalRetraits = stats?.retraits?.reduce((s: number, d: any) => s + parseFloat(d.total), 0) || 0
  const cashNet = totalDepots - totalRetraits
  const perfGlobale = cashNet > 0 ? ((valeurTotale + totalRetraits + totalDividendes - totalDepots) / totalDepots) * 100 : 0

  const perfPeriode = (() => {
    if (historique.length < 2) return null
    const first = historique[0]?.valeur
    const last = historique[historique.length - 1]?.valeur
    if (!first || !last) return null
    return { diff: last - first, pct: ((last - first) / first) * 100 }
  })()

  const parCompte = positions.reduce((acc: any, p) => {
    acc[p.compte] = (acc[p.compte] || 0) + (p.valeurActuelle ?? p.cout_total)
    return acc
  }, {})
  const pieCompte = Object.entries(parCompte).map(([name, value]) => ({ name, value: parseFloat((value as number).toFixed(2)) }))
  const pieAsset = positions.map(p => ({ name: p.symbole, value: parseFloat((p.valeurActuelle ?? p.cout_total).toFixed(2)) })).sort((a, b) => b.value - a.value)

  const perfAsset = positions
    .filter(p => p.plusvaluePct != null)
    .map(p => ({ name: p.symbole, perf: parseFloat(p.plusvaluePct.toFixed(2)) }))
    .sort((a, b) => b.perf - a.perf)

  const barData = (stats?.transactionsParMois || []).slice(-12).map((m: any) => ({
    mois: m.mois?.slice(2),
    volume: parseFloat(parseFloat(m.volume).toFixed(2)),
  }))

  const CustomTooltipHist = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className="text-white font-semibold">{fmt(payload[0].value)}</p>
      </div>
    )
  }

  const CustomTooltipPerf = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className={`font-semibold ${payload[0].value >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtPct(payload[0].value)}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Valeur totale" value={fmt(valeurTotale)} />
          <StatCard label="Plus-value latente" value={fmt(plusvalueTotale)} sub={fmtPct(plusvaluePct)}
            color={plusvalueTotale >= 0 ? 'text-green-400' : 'text-red-400'}
            subColor={plusvalueTotale >= 0 ? 'text-green-500' : 'text-red-500'} />
          <StatCard label="Performance globale" value={fmtPct(perfGlobale)} sub={`Investi net : ${fmt(cashNet)}`}
            color={perfGlobale >= 0 ? 'text-green-400' : 'text-red-400'} />
          <StatCard label="Dividendes reçus" value={fmt(totalDividendes)} color="text-yellow-400" />
        </div>

        {/* Évolution */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-slate-200">Évolution du portefeuille</h2>
              {perfPeriode && (
                <span className={`text-sm font-medium ${perfPeriode.pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {perfPeriode.pct >= 0 ? '+' : ''}{fmt(perfPeriode.diff)} ({fmtPct(perfPeriode.pct)}) sur la période
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {PERIODS.map(p => <PeriodBtn key={p.key} active={period === p.key} onClick={() => setPeriod(p.key)} label={p.label} />)}
            </div>
          </div>
          {loadingHist ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Chargement de l'historique...</div>
          ) : historique.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={historique}>
                <defs>
                  <linearGradient id="gradValeur" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltipHist />} />
                <Area type="monotone" dataKey="valeur" stroke="#6366f1" strokeWidth={2} fill="url(#gradValeur)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Données insuffisantes pour cette période</div>
          )}
        </div>

        {/* Performance actif + Répartitions */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="font-semibold mb-4 text-slate-200">Performance par actif</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={perfAsset} layout="vertical" margin={{ left: 5, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" stroke="#475569" tick={{ fontSize: 11 }} width={60} />
                <Tooltip content={<CustomTooltipPerf />} />
                <Bar dataKey="perf" radius={[0, 4, 4, 0]}>
                  {perfAsset.map((e, i) => <Cell key={i} fill={e.perf >= 0 ? '#22c55e' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
  <h2 className="font-semibold mb-2 text-slate-200">Répartition par compte</h2>
  <ResponsiveContainer width="100%" height={150}>
    <PieChart>
      <Pie data={pieCompte} cx="50%" cy="50%" outerRadius={55} dataKey="value">
        {pieCompte.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
      </Pie>
      <Tooltip formatter={(v: any) => fmt(v)} />
      <Legend formatter={(value, entry: any) => `${value} ${(entry.payload.percent * 100).toFixed(0)}%`} />
    </PieChart>
  </ResponsiveContainer>
</div>
<div>
  <h2 className="font-semibold mb-2 text-slate-200">Répartition par actif</h2>
  <ResponsiveContainer width="100%" height={160}>
    <PieChart>
      <Pie data={pieAsset} cx="50%" cy="50%" outerRadius={60} innerRadius={30} dataKey="value">
        {pieAsset.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
      </Pie>
      <Tooltip formatter={(v: any) => fmt(v)} labelFormatter={(_, p) => p?.[0]?.name} />
      <Legend formatter={(value) => value} />
    </PieChart>
  </ResponsiveContainer>
</div>

        {/* Volume mensuel */}
        {barData.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
            <h2 className="font-semibold mb-4 text-slate-200">Volume d'achat mensuel</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="mois" stroke="#475569" tick={{ fontSize: 11 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Bar dataKey="volume" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

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
                  <th className="px-4 py-3 text-right">Pr. revient</th>
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
                          <div className="font-medium text-white">{p.symbole}</div>
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

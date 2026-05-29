'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, ReferenceLine,
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
  const [pnlRealise, setPnlRealise] = useState<any[]>([])
  const [period, setPeriod] = useState('1y')
  const [loading, setLoading] = useState(true)
  const [loadingHist, setLoadingHist] = useState(false)

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

  // KPIs
  const valeurTotale = positions.reduce((s, p) => s + (p.valeurActuelle ?? p.cout_total), 0)
  const coutTotal = positions.reduce((s, p) => s + p.cout_total, 0)
  const plusvalueTotale = valeurTotale - coutTotal
  const plusvaluePct = coutTotal > 0 ? (plusvalueTotale / coutTotal) * 100 : 0
  const totalDepots = stats?.depots?.reduce((s: number, d: any) => s + parseFloat(d.total), 0) || 0
  const totalDividendes = stats?.dividendes?.reduce((s: number, d: any) => s + parseFloat(d.total), 0) || 0
  const totalRetraits = stats?.retraits?.reduce((s: number, d: any) => s + parseFloat(d.total), 0) || 0
  const cashNet = totalDepots - totalRetraits
  const pnlRealiseTotal = pnlRealise.reduce((s, p) => s + p.pnl, 0)
  const perfGlobale = cashNet > 0 ? ((valeurTotale + totalRetraits + totalDividendes + pnlRealiseTotal - totalDepots) / totalDepots) * 100 : 0

  // Perf période depuis historique (sur la plus-value)
  const perfPeriode = (() => {
    if (historique.length < 2) return null
    const first = historique[0]?.plusvalue
    const last = historique[historique.length - 1]?.plusvalue
    if (first == null || last == null) return null
    return { diff: last - first, absFirst: Math.abs(first) }
  })()

  // Répartitions
  const parCompte = positions.reduce((acc: any, p) => {
    acc[p.compte] = (acc[p.compte] || 0) + (p.valeurActuelle ?? p.cout_total)
    return acc
  }, {})
  const pieCompte = Object.entries(parCompte).map(([name, value]) => ({ name, value: parseFloat((value as number).toFixed(2)) }))
  const pieAsset = positions.map(p => ({ name: p.symbole, value: parseFloat((p.valeurActuelle ?? p.cout_total).toFixed(2)) })).sort((a, b) => b.value - a.value)

  // Performance par actif (latente)
  const perfAsset = positions
    .filter(p => p.plusvaluePct != null)
    .map(p => ({ name: p.symbole, perf: parseFloat(p.plusvaluePct.toFixed(2)) }))
    .sort((a, b) => b.perf - a.perf)

  // P&L réalisé par actif
  const pnlBarData = pnlRealise.map(p => ({
    name: p.symbole,
    pnl: parseFloat(p.pnl.toFixed(2)),
  }))

  const barData = (stats?.transactionsParMois || []).slice(-12).map((m: any) => ({
    mois: m.mois?.slice(2),
    volume: parseFloat(parseFloat(m.volume).toFixed(2)),
  }))

  const CustomTooltipPV = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const v = payload[0].value
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className={`font-semibold ${v >= 0 ? 'text-green-400' : 'text-red-400'}`}>{v >= 0 ? '+' : ''}{fmt(v)}</p>
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

  const CustomTooltipPnl = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const v = payload[0].value
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className={`font-semibold ${v >= 0 ? 'text-green-400' : 'text-red-400'}`}>{v >= 0 ? '+' : ''}{fmt(v)}</p>
        <p className="text-slate-400 text-xs">P&L réalisé (PRMP)</p>
      </div>
    )
  }

  const pvColor = (v: number) => v >= 0 ? '#22c55e' : '#ef4444'

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
          <StatCard label="P&L réalisé (ventes)" value={fmt(pnlRealiseTotal)}
            sub="Basé sur le PRMP"
            color={pnlRealiseTotal >= 0 ? 'text-green-400' : 'text-red-400'} />
          <StatCard label="Dividendes reçus" value={fmt(totalDividendes)} color="text-yellow-400" />
        </div>

        {/* Évolution de la plus-value */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-slate-200">Évolution de la plus-value latente</h2>
              {perfPeriode && (
                <span className={`text-sm font-medium ${perfPeriode.diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {perfPeriode.diff >= 0 ? '+' : ''}{fmt(perfPeriode.diff)} sur la période
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
                  <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => `${v >= 0 ? '+' : ''}${(v/1000).toFixed(1)}k`} />
                <Tooltip content={<CustomTooltipPV />} />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="plusvalue" stroke={plusvalueTotale >= 0 ? '#22c55e' : '#ef4444'}
                  strokeWidth={2} fill={plusvalueTotale >= 0 ? 'url(#gradPos)' : 'url(#gradNeg)'} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">Données insuffisantes pour cette période</div>
          )}
        </div>

        {/* Performance latente + P&L réalisé */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="font-semibold mb-4 text-slate-200">Performance latente par actif</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={perfAsset} layout="vertical" margin={{ left: 5, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" stroke="#475569" tick={{ fontSize: 11 }} width={60} />
                <Tooltip content={<CustomTooltipPerf />} />
                <ReferenceLine x={0} stroke="#475569" />
                <Bar dataKey="perf" radius={[0, 4, 4, 0]}>
                  {perfAsset.map((e, i) => <Cell key={i} fill={e.perf >= 0 ? '#22c55e' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {pnlBarData.length > 0 ? (
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h2 className="font-semibold mb-1 text-slate-200">P&L réalisé par actif (PRMP)</h2>
              <p className="text-slate-500 text-xs mb-4">Gain/perte sur positions clôturées ou partiellement vendues</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={pnlBarData} layout="vertical" margin={{ left: 5, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={v => fmt(v)} />
                  <YAxis type="category" dataKey="name" stroke="#475569" tick={{ fontSize: 11 }} width={60} />
                  <Tooltip content={<CustomTooltipPnl />} />
                  <ReferenceLine x={0} stroke="#475569" />
                  <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                    {pnlBarData.map((e, i) => <Cell key={i} fill={e.pnl >= 0 ? '#22c55e' : '#ef4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex items-center justify-center">
              <p className="text-slate-500 text-sm text-center">Aucune vente enregistrée<br/>Le P&L réalisé apparaîtra ici</p>
            </div>
          )}
        </div>

        {/* Répartitions */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 flex flex-col gap-6">
            <div>
              <h2 className="font-semibold mb-2 text-slate-200">Répartition par compte</h2>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={pieCompte} cx="50%" cy="50%" outerRadius={55} dataKey="value">
                    {pieCompte.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Legend formatter={(value, entry: any) =>
                    <span className="text-slate-300 text-xs">{value} — {(entry.payload.percent * 100).toFixed(1)}%</span>
                  } />
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
                  <Legend formatter={(value) => <span className="text-slate-300 text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Volume mensuel */}
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="font-semibold mb-4 text-slate-200">Volume d'achat mensuel</h2>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="mois" stroke="#475569" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => fmt(v)} />
                  <Bar dataKey="volume" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-500 text-sm">Aucune donnée</p>}
          </div>
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

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#a855f7', '#fb923c', '#10b981']

function StatCard({ label, value, sub, color }: { label: string, value: string, sub?: string, color?: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <p className="text-slate-400 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-slate-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [positions, setPositions] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [posRes, statRes] = await Promise.all([
        fetch('/api/positions'),
        fetch('/api/stats'),
      ])
      if (posRes.status === 401) { router.push('/'); return }
      setPositions(await posRes.json())
      setStats(await statRes.json())
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="min-h-screen">
      <Navbar />
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-400 text-lg">Chargement des données...</div>
      </div>
    </div>
  )

  // Calculs globaux
  const valeurTotale = positions.reduce((s, p) => s + (p.valeurActuelle || p.cout_total), 0)
  const coutTotal = positions.reduce((s, p) => s + p.cout_total, 0)
  const plusvalueTotale = valeurTotale - coutTotal
  const plusvaluePct = coutTotal > 0 ? (plusvalueTotale / coutTotal) * 100 : 0

  const totalDepots = stats?.depots?.reduce((s: number, d: any) => s + d.total, 0) || 0
  const totalDividendes = stats?.dividendes?.reduce((s: number, d: any) => s + d.total, 0) || 0

  // Répartition par compte
  const parCompte = positions.reduce((acc: any, p) => {
    acc[p.compte] = (acc[p.compte] || 0) + (p.valeurActuelle || p.cout_total)
    return acc
  }, {})
  const pieCompte = Object.entries(parCompte).map(([name, value]) => ({ name, value: parseFloat((value as number).toFixed(2)) }))

  // Répartition par asset (top 8)
  const pieAsset = positions
    .map(p => ({ name: p.symbole, value: parseFloat((p.valeurActuelle || p.cout_total).toFixed(2)) }))
    .sort((a, b) => b.value - a.value)

  // Transactions par mois pour le bar chart
  const barData = (stats?.transactionsParMois || []).slice(-12).map((m: any) => ({
    mois: m.mois,
    volume: parseFloat(m.volume.toFixed(2)),
  }))

  const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Valeur totale" value={fmt(valeurTotale)} />
          <StatCard
            label="Plus-value latente"
            value={fmt(plusvalueTotale)}
            sub={`${plusvaluePct >= 0 ? '+' : ''}${plusvaluePct.toFixed(2)}%`}
            color={plusvalueTotale >= 0 ? 'text-green-400' : 'text-red-400'}
          />
          <StatCard label="Total investi" value={fmt(totalDepots)} />
          <StatCard label="Dividendes reçus" value={fmt(totalDividendes)} color="text-yellow-400" />
        </div>

        {/* Graphiques */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="font-semibold mb-4 text-slate-200">Répartition par compte</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieCompte} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieCompte.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="font-semibold mb-4 text-slate-200">Répartition par actif</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieAsset} cx="50%" cy="50%" outerRadius={80} dataKey="value">
                  {pieAsset.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(v)} labelFormatter={(_, payload) => payload?.[0]?.name} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume mensuel */}
        {barData.length > 0 && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-8">
            <h2 className="font-semibold mb-4 text-slate-200">Volume d'achat mensuel (12 derniers mois)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="mois" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Bar dataKey="volume" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tableau des positions */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700">
            <h2 className="font-semibold text-slate-200">Positions actuelles</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left border-b border-slate-700">
                  <th className="px-4 py-3">Actif</th>
                  <th className="px-4 py-3">Compte</th>
                  <th className="px-4 py-3 text-right">Quantité</th>
                  <th className="px-4 py-3 text-right">Pr. revient</th>
                  <th className="px-4 py-3 text-right">Prix actuel</th>
                  <th className="px-4 py-3 text-right">Valeur</th>
                  <th className="px-4 py-3 text-right">+/- Value</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{p.symbole}</div>
                      <div className="text-slate-400 text-xs truncate max-w-[160px]">{p.nom}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{p.compte}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{p.quantite.toFixed(p.quantite < 1 ? 6 : 4)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{fmt(p.prixRevient)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {p.prixActuel ? fmt(p.prixActuel) : <span className="text-slate-500">N/A</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-white">
                      {p.valeurActuelle ? fmt(p.valeurActuelle) : fmt(p.cout_total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.plusvalue != null ? (
                        <div>
                          <div className={p.plusvalue >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {p.plusvalue >= 0 ? '+' : ''}{fmt(p.plusvalue)}
                          </div>
                          <div className={`text-xs ${p.plusvalue >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {p.plusvaluePct >= 0 ? '+' : ''}{p.plusvaluePct.toFixed(2)}%
                          </div>
                        </div>
                      ) : <span className="text-slate-500">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}

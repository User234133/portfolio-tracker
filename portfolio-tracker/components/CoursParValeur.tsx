'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

const PERIODS = [
  { key: 'since', label: '1er achat' },
  { key: '1mo', label: '1M' },
  { key: '6mo', label: '6M' },
  { key: '1y', label: '1A' },
  { key: '5y', label: '5A' },
  { key: 'max', label: 'Max' },
]

const money = (n: number, currency = 'EUR') =>
  n.toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 })
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const color = (n: number) => (n >= 0 ? 'text-green-400' : 'text-red-400')

function StatCard({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <p className="text-slate-400 text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClass || 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs mt-1 text-slate-400">{sub}</p>}
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

interface Valeur { symbole: string; nom: string; qty: number }

export default function CoursParValeur() {
  const router = useRouter()
  const [valeurs, setValeurs] = useState<Valeur[]>([])
  const [symbole, setSymbole] = useState('')
  const [period, setPeriod] = useState('since')
  const [data, setData] = useState<any>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loading, setLoading] = useState(false)

  // Liste des valeurs (déduite des transactions) : positions ouvertes d'abord
  useEffect(() => {
    async function load() {
      const res = await fetch('/api/transactions')
      if (res.status === 401) { router.push('/'); return }
      const rows: any[] = await res.json()
      const map = new Map<string, Valeur>()
      for (const t of rows) {
        const v = map.get(t.symbole) ?? { symbole: t.symbole, nom: t.nom, qty: 0 }
        v.qty += (t.type === 'Achat' ? 1 : -1) * parseFloat(t.quantite)
        map.set(t.symbole, v)
      }
      const list = Array.from(map.values()).sort((a, b) => {
        const ha = a.qty > 1e-6 ? 0 : 1
        const hb = b.qty > 1e-6 ? 0 : 1
        return ha - hb || a.symbole.localeCompare(b.symbole)
      })
      setValeurs(list)
      const fromUrl = new URLSearchParams(window.location.search).get('symbole')
      setSymbole(list.find(v => v.symbole === fromUrl)?.symbole ?? list[0]?.symbole ?? '')
      setLoadingList(false)
    }
    load()
  }, [router])

  // Données du graphique pour la valeur et la période choisies
  useEffect(() => {
    if (!symbole) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/cours?symbole=${encodeURIComponent(symbole)}&period=${period}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(() => { if (!cancelled) { setData({ points: [], erreur: 'Erreur de chargement' }); setLoading(false) } })
    return () => { cancelled = true }
  }, [symbole, period])

  const devise: string = data?.devise || 'EUR'
  const points: any[] = data?.points || []
  const longSpan = points.length > 1 &&
    (new Date(points[points.length - 1].date).getTime() - new Date(points[0].date).getTime()) / 864e5 > 400
  const fmtDate = (d: string) => (longSpan ? `${d.slice(5, 7)}/${d.slice(2, 4)}` : `${d.slice(8, 10)}/${d.slice(5, 7)}`)

  const vsPru = data?.pruActuel && data?.dernierPrix
    ? ((data.dernierPrix - data.pruActuel) / data.pruActuel) * 100
    : null

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const p = payload[0].payload
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs space-y-1">
        <p className="text-slate-400">{new Date(p.date).toLocaleDateString('fr-FR')}</p>
        <p className="text-white font-semibold">{money(p.prix, devise)}</p>
        {p.pru != null && (
          <p className="text-amber-400">
            PRU {money(p.pru, devise)} ({pct(((p.prix - p.pru) / p.pru) * 100)})
          </p>
        )}
        {p.achat != null && <p className="text-green-400">Achat : {p.achatQty} × {money(p.achat, devise)}</p>}
        {p.vente != null && <p className="text-red-400">Vente : {p.venteQty} × {money(p.vente, devise)}</p>}
      </div>
    )
  }

  if (loadingList) return (
    <div className="flex items-center justify-center h-64 text-slate-400">Chargement...</div>
  )

  return (
    <div>
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <h2 className="text-lg font-semibold text-slate-200">Cours par valeur</h2>
          {valeurs.length > 0 && (
            <select value={symbole} onChange={e => setSymbole(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 max-w-full">
              {valeurs.map(v => (
                <option key={v.symbole} value={v.symbole}>
                  {v.symbole} — {v.nom}{v.qty > 1e-6 ? '' : ' (soldé)'}
                </option>
              ))}
            </select>
          )}
        </div>

        {valeurs.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center text-slate-400 text-sm">
            Aucune transaction pour le moment. Ajoutes-en depuis l'onglet Transactions pour voir les cours ici.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Dernier cours" value={data?.dernierPrix != null ? money(data.dernierPrix, devise) : '—'} sub={data?.nom} />
              <StatCard label="PRU (frais inclus)" value={data?.pruActuel ? money(data.pruActuel, devise) : '—'}
                sub={data?.quantite > 0 ? `${data.quantite} titre(s) détenu(s)` : 'Position soldée'} valueClass="text-amber-400" />
              <StatCard label="Écart vs PRU" value={vsPru != null ? pct(vsPru) : '—'} valueClass={vsPru != null ? color(vsPru) : undefined} />
              <StatCard label="Variation sur la période" value={data?.variationPeriode != null ? pct(data.variationPeriode) : '—'}
                valueClass={data?.variationPeriode != null ? color(data.variationPeriode) : undefined} />
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-indigo-400 inline-block" /> Cours</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-400 inline-block" /> PRU</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Achat</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Vente</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {PERIODS.map(p => <PeriodBtn key={p.key} active={period === p.key} onClick={() => setPeriod(p.key)} label={p.label} />)}
                </div>
              </div>

              {loading ? (
                <div className="h-80 flex items-center justify-center text-slate-500 text-sm">Chargement du cours...</div>
              ) : points.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={380}>
                    <ComposedChart data={points}>
                      <defs>
                        <linearGradient id="gradPrix" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={fmtDate} minTickGap={40} />
                      <YAxis stroke="#475569" tick={{ fontSize: 11 }} width={60}
                        domain={[(min: number) => min * 0.97, (max: number) => max * 1.03]}
                        tickFormatter={(v: number) => v.toFixed(v < 10 ? 2 : 0)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="prix" stroke="#818cf8" strokeWidth={2} fill="url(#gradPrix)" dot={false} isAnimationActive={false} />
                      <Line type="stepAfter" dataKey="pru" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
                      <Line dataKey="achat" stroke="none" activeDot={false} isAnimationActive={false}
                        dot={{ r: 5, fill: '#22c55e', stroke: '#0f172a', strokeWidth: 1.5 }} />
                      <Line dataKey="vente" stroke="none" activeDot={false} isAnimationActive={false}
                        dot={{ r: 5, fill: '#ef4444', stroke: '#0f172a', strokeWidth: 1.5 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                  {data && data.convertie === false && (
                    <p className="text-xs text-slate-500 mt-3">
                      Taux de change indisponible : le cours est affiché en {devise} (non converti), alors que le PRU est en euros.
                    </p>
                  )}
                </>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-500 text-sm">
                  {data?.erreur || 'Données insuffisantes pour cette période'}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

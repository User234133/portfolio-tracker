'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, AreaChart, Area, ReferenceLine,
} from 'recharts'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#a855f7', '#3b82f6']
const C_LATENT = '#6366f1'
const C_REALISE = '#f59e0b'
const C_DIV = '#14b8a6'

const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
const signed = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}`
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
const tone = (n: number) => (n >= 0 ? 'text-green-400' : 'text-red-400')
const short = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`)
const moisLabel = (m: string) => `${m.slice(5, 7)}/${m.slice(2, 4)}`

function Card({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-semibold text-slate-200">{title}</h2>
          {subtitle && <p className="text-slate-500 text-xs mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

function Seg({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
      {label}
    </button>
  )
}

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs space-y-1">{children}</div>
)

const legendFmt = (v: string) => <span className="text-slate-300 text-xs">{v}</span>

export default function AnalysePortefeuille() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [erreur, setErreur] = useState('')
  const [compte, setCompte] = useState('Tous')
  const [mode, setMode] = useState<'eur' | 'pct'>('eur')
  const [period, setPeriod] = useState('1y')
  const [vue, setVue] = useState<'valeur' | 'pv'>('valeur')
  const [histo, setHisto] = useState<any[]>([])
  const [loadingHisto, setLoadingHisto] = useState(true)

  useEffect(() => {
    fetch('/api/analyse')
      .then(async res => {
        if (res.status === 401) { router.push('/'); return }
        setData(await res.json())
      })
      .catch(() => setErreur('Erreur de chargement'))
  }, [router])

  useEffect(() => {
    let cancelled = false
    setLoadingHisto(true)
    fetch(`/api/historique?period=${period}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setHisto(Array.isArray(d) ? d : []); setLoadingHisto(false) } })
      .catch(() => { if (!cancelled) { setHisto([]); setLoadingHisto(false) } })
    return () => { cancelled = true }
  }, [period])

  if (erreur) return <div className="text-red-400 text-sm">{erreur}</div>
  if (!data) return <div className="flex items-center justify-center h-64 text-slate-400">Chargement de l'analyse...</div>

  const comptes: any[] = data.comptes || []
  const lignes: any[] = data.lignes || []
  if (lignes.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 text-center text-slate-400 text-sm">
        Aucune transaction pour le moment.
      </div>
    )
  }

  // --- P&L par valeur (filtré par compte) ---
  const lignesF = lignes.filter(l => compte === 'Tous' || l.compte === compte)
  const agg: Record<string, any> = {}
  for (const l of lignesF) {
    if (!agg[l.symbole]) agg[l.symbole] = { name: l.symbole, nom: l.nom, latent: 0, realise: 0, achats: 0, valeur: 0 }
    const a = agg[l.symbole]
    a.latent += l.latent; a.realise += l.realise; a.achats += l.achats; a.valeur += l.valeur
  }
  const parValeur = Object.values(agg)
    .map((a: any) => {
      const total = a.latent + a.realise
      return { ...a, total, pct: a.achats > 0 ? (total / a.achats) * 100 : 0 }
    })
    .sort((a: any, b: any) => (mode === 'eur' ? b.total - a.total : b.pct - a.pct))

  // --- Répartition par valeur (top 8 + autres) ---
  const poids = parValeur.filter((v: any) => v.valeur > 0).sort((a: any, b: any) => b.valeur - a.valeur)
  const pieValeur = [
    ...poids.slice(0, 8).map((v: any) => ({ name: v.name, value: parseFloat(v.valeur.toFixed(2)) })),
    ...(poids.length > 8 ? [{ name: 'Autres', value: parseFloat(poids.slice(8).reduce((s: number, v: any) => s + v.valeur, 0).toFixed(2)) }] : []),
  ]
  const pieCompte = comptes.filter(c => c.valeur > 0).map(c => ({ name: c.compte, value: parseFloat(c.valeur.toFixed(2)) }))

  // --- P&L par compte ---
  const barComptes = comptes.map(c => ({
    name: c.compte, Latente: c.latent, 'Réalisée': c.realise, Dividendes: c.dividendes, total: c.total, pct: c.totalPct,
  }))

  // --- Dividendes par mois, empilés par compte ---
  const divMois: Record<string, any> = {}
  for (const d of data.dividendesParMois || []) {
    if (!divMois[d.mois]) divMois[d.mois] = { mois: d.mois }
    divMois[d.mois][d.compte] = (divMois[d.mois][d.compte] || 0) + d.montant
  }
  const divData = Object.values(divMois).sort((a: any, b: any) => (a.mois < b.mois ? -1 : 1))
  const divComptes = Array.from(new Set((data.dividendesParMois || []).map((d: any) => d.compte))) as string[]

  const achatsData = (data.achatsParMois || []).slice(-24).map((m: any) => ({ mois: m.mois, montant: parseFloat(m.montant.toFixed(2)) }))

  const ptsHisto = histo.length > 1
  const perfHisto = ptsHisto ? histo[histo.length - 1].plusvalue - histo[0].plusvalue : null

  return (
    <div className="space-y-6">
      {/* P&L par compte */}
      <Card title="P&L par compte" subtitle="Latent + réalisé + dividendes, séparés par compte (PEA / CTO...)">
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {comptes.map(c => (
            <div key={c.compte} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-slate-200">{c.compte}</span>
                <span className="text-xs text-slate-400">Valeur {fmt(c.valeur)}</span>
              </div>
              <p className={`text-2xl font-bold mt-2 ${tone(c.total)}`}>{signed(c.total)}</p>
              <p className={`text-xs ${tone(c.total)}`}>{c.totalPct != null ? `${pct(c.totalPct)} des achats` : '—'}</p>
              <p className="text-xs text-slate-400 mt-2">
                Latent {signed(c.latent)} · Réalisé {signed(c.realise)} · Div. {fmt(c.dividendes)}
              </p>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={barComptes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 12 }} />
            <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={short} />
            <ReferenceLine y={0} stroke="#475569" />
            <Tooltip content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload
              return (
                <Tip>
                  <p className="text-slate-200 font-medium">{p.name}</p>
                  <p style={{ color: C_LATENT }}>Latent : {signed(p.Latente)}</p>
                  <p style={{ color: C_REALISE }}>Réalisé : {signed(p['Réalisée'])}</p>
                  <p style={{ color: C_DIV }}>Dividendes : {signed(p.Dividendes)}</p>
                  <p className={`font-semibold border-t border-slate-700 pt-1 ${tone(p.total)}`}>Total : {signed(p.total)}</p>
                </Tip>
              )
            }} />
            <Legend formatter={legendFmt} />
            <Bar dataKey="Latente" stackId="a" fill={C_LATENT} />
            <Bar dataKey="Réalisée" stackId="a" fill={C_REALISE} />
            <Bar dataKey="Dividendes" stackId="a" fill={C_DIV} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* P&L par valeur */}
      <Card
        title="P&L par valeur"
        subtitle={mode === 'eur'
          ? 'Comparaison des valeurs : plus-value latente + réalisée (hors dividendes, non rattachés à une valeur)'
          : 'P&L total en % du montant acheté'}
        right={
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex gap-1">
              {['Tous', ...comptes.map(c => c.compte)].map(c => <Seg key={c} active={compte === c} onClick={() => setCompte(c)} label={c} />)}
            </div>
            <div className="flex gap-1">
              <Seg active={mode === 'eur'} onClick={() => setMode('eur')} label="€" />
              <Seg active={mode === 'pct'} onClick={() => setMode('pct')} label="%" />
            </div>
          </div>
        }>
        <ResponsiveContainer width="100%" height={Math.max(260, parValeur.length * 34)}>
          <BarChart data={parValeur} layout="vertical" margin={{ left: 5, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={mode === 'eur' ? short : (v: number) => `${v}%`} />
            <YAxis type="category" dataKey="name" stroke="#475569" tick={{ fontSize: 11 }} width={75} />
            <ReferenceLine x={0} stroke="#475569" />
            <Tooltip cursor={{ fill: '#1e293b' }} content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload
              return (
                <Tip>
                  <p className="text-slate-200 font-medium">{p.name}</p>
                  <p className="text-slate-400">{p.nom}</p>
                  <p className={`font-semibold ${tone(p.total)}`}>Total : {signed(p.total)} ({pct(p.pct)})</p>
                  <p style={{ color: C_LATENT }}>Latent : {signed(p.latent)}</p>
                  <p style={{ color: C_REALISE }}>Réalisé : {signed(p.realise)}</p>
                </Tip>
              )
            }} />
            {mode === 'eur' ? (
              <>
                <Legend formatter={legendFmt} />
                <Bar dataKey="latent" name="Latent" stackId="a" fill={C_LATENT} />
                <Bar dataKey="realise" name="Réalisé" stackId="a" fill={C_REALISE} radius={[0, 4, 4, 0]} />
              </>
            ) : (
              <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                {parValeur.map((v: any, i: number) => <Cell key={i} fill={v.pct >= 0 ? '#22c55e' : '#ef4444'} />)}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Évolution */}
      <Card
        title={vue === 'valeur' ? 'Évolution de la valeur du portefeuille' : 'Évolution de la plus-value latente'}
        subtitle={perfHisto != null ? `${signed(perfHisto)} de plus-value sur la période (tous comptes)` : 'Tous comptes'}
        right={
          <div className="flex gap-3 flex-wrap">
            <div className="flex gap-1">
              <Seg active={vue === 'valeur'} onClick={() => setVue('valeur')} label="Valeur vs coût" />
              <Seg active={vue === 'pv'} onClick={() => setVue('pv')} label="Plus-value" />
            </div>
            <div className="flex gap-1">
              {[{ k: '1mo', l: 'Mois' }, { k: '1y', l: 'Année' }, { k: 'max', l: 'Total' }].map(p =>
                <Seg key={p.k} active={period === p.k} onClick={() => setPeriod(p.k)} label={p.l} />)}
            </div>
          </div>
        }>
        {loadingHisto ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Chargement de l'historique...</div>
        ) : ptsHisto ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={histo}>
              <defs>
                <linearGradient id="gradVal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} minTickGap={40} />
              <YAxis stroke="#475569" tick={{ fontSize: 11 }} width={55} tickFormatter={short}
                domain={vue === 'valeur' ? [(min: number) => min * 0.95, (max: number) => max * 1.03] : ['auto', 'auto']} />
              <Tooltip content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload
                return (
                  <Tip>
                    <p className="text-slate-400">{new Date(p.date).toLocaleDateString('fr-FR')}</p>
                    <p className="text-white">Valeur : {fmt(p.valeur)}</p>
                    <p className="text-amber-400">Coût : {fmt(p.cout)}</p>
                    <p className={`font-semibold ${tone(p.plusvalue)}`}>Plus-value : {signed(p.plusvalue)}</p>
                  </Tip>
                )
              }} />
              {vue === 'valeur' ? (
                <>
                  <Area type="monotone" dataKey="valeur" stroke="#6366f1" strokeWidth={2} fill="url(#gradVal)" dot={false} isAnimationActive={false} />
                  <Area type="stepAfter" dataKey="cout" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="5 4" fill="none" dot={false} isAnimationActive={false} />
                </>
              ) : (
                <>
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                  <Area type="monotone" dataKey="plusvalue"
                    stroke={perfHisto != null && histo[histo.length - 1].plusvalue < 0 ? '#ef4444' : '#22c55e'}
                    strokeWidth={2} fillOpacity={0.15}
                    fill={histo[histo.length - 1].plusvalue < 0 ? '#ef4444' : '#22c55e'} dot={false} isAnimationActive={false} />
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm">Données insuffisantes pour cette période</div>
        )}
        {vue === 'valeur' && ptsHisto && (
          <p className="text-xs text-slate-500 mt-2">Ligne pleine : valeur de marché · pointillés : coût de revient des titres détenus.</p>
        )}
      </Card>

      {/* Répartition */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Répartition par valeur" subtitle={compte === 'Tous' ? 'Tous comptes' : `Compte ${compte}`}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieValeur} cx="50%" cy="50%" outerRadius={95} innerRadius={50} dataKey="value" paddingAngle={1}>
                {pieValeur.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#1e293b" />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend formatter={legendFmt} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Répartition par compte" subtitle="Valeur actuelle">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieCompte} cx="50%" cy="50%" outerRadius={95} innerRadius={50} dataKey="value" paddingAngle={1}>
                {pieCompte.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#1e293b" />)}
              </Pie>
              <Tooltip formatter={(v: any) => fmt(Number(v))} />
              <Legend formatter={legendFmt} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Dividendes + achats mensuels */}
      <div className="grid md:grid-cols-2 gap-6">
        {divData.length > 0 && (
          <Card title="Dividendes par mois" subtitle="Par compte">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={divData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="mois" stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={moisLabel} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={short} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} labelFormatter={(l: any) => moisLabel(String(l))} />
                {divComptes.length > 1 && <Legend formatter={legendFmt} />}
                {divComptes.map((c, i) => <Bar key={c} dataKey={c} stackId="d" fill={COLORS[(i + 6) % COLORS.length]} />)}
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
        <Card title="Achats par mois" subtitle="Montant investi, 24 derniers mois">
          {achatsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={achatsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="mois" stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={moisLabel} />
                <YAxis stroke="#475569" tick={{ fontSize: 11 }} tickFormatter={short} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} labelFormatter={(l: any) => moisLabel(String(l))} />
                <Bar dataKey="montant" name="Achats" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-500 text-sm">Aucune donnée</p>}
        </Card>
      </div>
    </div>
  )
}

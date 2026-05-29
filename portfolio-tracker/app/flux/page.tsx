'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

const COMPTES = ['SG - PEA', 'TR - CTO']
const TYPES = ['Depot', 'Retrait', 'Dividende']

export default function FluxPage() {
  const router = useRouter()
  const [flux, setFlux] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    compte: 'SG - PEA',
    type: 'Depot',
    montant: '',
    commentaire: '',
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/flux')
    if (res.status === 401) { router.push('/'); return }
    setFlux(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/flux', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ date: new Date().toISOString().slice(0, 10), compte: 'SG - PEA', type: 'Depot', montant: '', commentaire: '' })
    await load()
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer ce flux ?')) return
    await fetch(`/api/flux?id=${id}`, { method: 'DELETE' })
    await load()
  }

  const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

  // Totaux
  const totalDepots = flux.filter(f => f.type === 'Depot').reduce((s, f) => s + f.montant, 0)
  const totalRetraits = flux.filter(f => f.type === 'Retrait').reduce((s, f) => s + f.montant, 0)
  const totalDividendes = flux.filter(f => f.type === 'Dividende').reduce((s, f) => s + f.montant, 0)

  const typeColor = (type: string) => {
    if (type === 'Depot') return 'bg-blue-900/50 text-blue-400'
    if (type === 'Retrait') return 'bg-red-900/50 text-red-400'
    return 'bg-yellow-900/50 text-yellow-400'
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Flux de trésorerie</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? '✕ Annuler' : '+ Nouveau flux'}
          </button>
        </div>

        // Remplace le bloc des 3 KPIs existants (totalDepots / totalRetraits / totalDividendes)
// par ce bloc étendu avec les soldes par compte

{/* KPIs + Soldes */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
    <p className="text-slate-400 text-xs mb-1">Total dépôts</p>
    <p className="text-xl font-bold text-blue-400">{fmt(totalDepots)}</p>
  </div>
  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
    <p className="text-slate-400 text-xs mb-1">Total retraits</p>
    <p className="text-xl font-bold text-red-400">{fmt(totalRetraits)}</p>
  </div>
  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
    <p className="text-slate-400 text-xs mb-1">Dividendes reçus</p>
    <p className="text-xl font-bold text-yellow-400">{fmt(totalDividendes)}</p>
  </div>
  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
    <p className="text-slate-400 text-xs mb-1">Cash net total</p>
    <p className={`text-xl font-bold ${(totalDepots - totalRetraits) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
      {fmt(totalDepots - totalRetraits)}
    </p>
  </div>
</div>

{/* Solde par compte */}
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
  {Object.entries(
    flux.reduce((acc: any, f: any) => {
      if (!acc[f.compte]) acc[f.compte] = { depots: 0, retraits: 0, dividendes: 0 }
      if (f.type === 'Depot') acc[f.compte].depots += f.montant
      if (f.type === 'Retrait') acc[f.compte].retraits += f.montant
      if (f.type === 'Dividende') acc[f.compte].dividendes += f.montant
      return acc
    }, {})
  ).map(([compte, totaux]: [string, any]) => {
    const solde = totaux.depots - totaux.retraits
    return (
      <div key={compte} className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-200">{compte}</h3>
          <span className={`text-lg font-bold ${solde >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmt(solde)}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-700/50 rounded-lg p-2">
            <p className="text-slate-400 mb-0.5">Dépôts</p>
            <p className="text-blue-400 font-medium">{fmt(totaux.depots)}</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-2">
            <p className="text-slate-400 mb-0.5">Retraits</p>
            <p className="text-red-400 font-medium">{fmt(totaux.retraits)}</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-2">
            <p className="text-slate-400 mb-0.5">Dividendes</p>
            <p className="text-yellow-400 font-medium">{fmt(totaux.dividendes)}</p>
          </div>
        </div>
      </div>
    )
  })}
</div>

        {/* Formulaire */}
        {showForm && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
            <h2 className="font-semibold mb-4">Nouveau flux</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Compte</label>
                <select value={form.compte} onChange={e => setForm({ ...form, compte: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                  {COMPTES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Montant (€)</label>
                <input type="number" step="0.01" placeholder="100.00" value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Commentaire (optionnel)</label>
                <input type="text" placeholder="ex: Dividende Carrefour" value={form.commentaire} onChange={e => setForm({ ...form, commentaire: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={saving}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors">
                  {saving ? 'Sauvegarde...' : '✓ Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tableau */}
        {loading ? (
          <p className="text-slate-400">Chargement...</p>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700 text-sm text-slate-400">
              {flux.length} flux enregistré(s)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-left border-b border-slate-700">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Compte</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3">Commentaire</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {flux.map((f: any) => (
                    <tr key={f.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-slate-300">{f.date}</td>
                      <td className="px-4 py-3 text-slate-300">{f.compte}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor(f.type)}`}>{f.type}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">{fmt(f.montant)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{f.commentaire || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDelete(f.id)} className="text-slate-500 hover:text-red-400 transition-colors text-xs">
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

const COMPTES = ['SG - PEA', 'TR - CTO']
const TYPES = ['Achat', 'Vente']

export default function TransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    symbole: '',
    nom: '',
    compte: 'SG - PEA',
    type: 'Achat',
    quantite: '',
    prix_unitaire: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const res = await fetch('/api/transactions')
    if (res.status === 401) { router.push('/'); return }
    setTransactions(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const cout = form.quantite && form.prix_unitaire
    ? (parseFloat(form.quantite) * parseFloat(form.prix_unitaire)).toFixed(2)
    : '—'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ date: new Date().toISOString().slice(0, 10), symbole: '', nom: '', compte: 'SG - PEA', type: 'Achat', quantite: '', prix_unitaire: '' })
      await load()
    } else {
      setError('Erreur lors de la sauvegarde')
    }
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Supprimer cette transaction ?')) return
    await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' })
    await load()
  }

  const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Transactions</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {showForm ? '✕ Annuler' : '+ Nouvelle transaction'}
          </button>
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
            <h2 className="font-semibold mb-4">Nouvelle transaction</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Symbole (ex: AAPL, BTC-EUR)</label>
                <input type="text" placeholder="AAPL" value={form.symbole} onChange={e => setForm({ ...form, symbole: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nom (optionnel)</label>
                <input type="text" placeholder="Apple Inc." value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
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
                <label className="block text-xs text-slate-400 mb-1">Quantité</label>
                <input type="number" step="any" placeholder="10" value={form.quantite} onChange={e => setForm({ ...form, quantite: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Prix unitaire (€)</label>
                <input type="number" step="any" placeholder="150.00" value={form.prix_unitaire} onChange={e => setForm({ ...form, prix_unitaire: e.target.value })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
              </div>
              <div className="flex items-end">
                <div className="bg-slate-700 rounded-lg px-3 py-2 text-sm w-full">
                  <span className="text-slate-400">Coût total : </span>
                  <span className="font-semibold text-white">{cout} €</span>
                </div>
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={saving}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors">
                  {saving ? 'Sauvegarde...' : '✓ Enregistrer'}
                </button>
              </div>
              {error && <p className="col-span-full text-red-400 text-sm">{error}</p>}
            </form>
          </div>
        )}

        {/* Tableau */}
        {loading ? (
          <p className="text-slate-400">Chargement...</p>
        ) : (
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700 text-sm text-slate-400">
              {transactions.length} transaction(s)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-left border-b border-slate-700">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Symbole</th>
                    <th className="px-4 py-3">Compte</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Quantité</th>
                    <th className="px-4 py-3 text-right">Prix unit.</th>
                    <th className="px-4 py-3 text-right">Coût total</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t: any) => (
                    <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-slate-300">{t.date}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">{t.symbole}</span>
                        {t.nom && <span className="text-slate-400 text-xs ml-2">{t.nom}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{t.compte}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.type === 'Achat' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">{parseFloat(t.quantite).toFixed(t.quantite < 1 ? 6 : 4)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{fmt(t.prix_unitaire)}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">{fmt(t.cout_total)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDelete(t.id)} className="text-slate-500 hover:text-red-400 transition-colors text-xs">
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

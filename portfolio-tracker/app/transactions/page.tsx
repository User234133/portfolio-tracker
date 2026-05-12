'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'

const COMPTES = ['SG - PEA', 'TR - CTO']
const TYPES = ['Achat', 'Vente']

type Asset = { symbole: string; nom: string; compte: string }

export default function TransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Formulaire
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    symbole: '',
    nom: '',
    compte: 'SG - PEA',
    type: 'Achat',
    quantite: '',
    prix_total: '',
  })
  const [isNewSymbole, setIsNewSymbole] = useState(false)
  const [loadingNom, setLoadingNom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nomTimeout = useRef<NodeJS.Timeout | null>(null)

  // PRU calculé automatiquement
  const pru = form.quantite && form.prix_total && parseFloat(form.quantite) > 0
    ? (parseFloat(form.prix_total) / parseFloat(form.quantite))
    : null

  async function load() {
    const res = await fetch('/api/transactions')
    if (res.status === 401) { router.push('/'); return }
    const data = await res.json()
    setTransactions(data)

    // Extrait les symboles uniques depuis les transactions
    const seen = new Set<string>()
    const uniqueAssets: Asset[] = []
    for (const t of data) {
      if (!seen.has(t.symbole + t.compte)) {
        seen.add(t.symbole + t.compte)
        uniqueAssets.push({ symbole: t.symbole, nom: t.nom, compte: t.compte })
      }
    }
    setAssets(uniqueAssets)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Quand on sélectionne un symbole existant
  function handleSelectSymbole(value: string) {
    if (value === '__new__') {
      setIsNewSymbole(true)
      setForm(f => ({ ...f, symbole: '', nom: '' }))
      return
    }
    setIsNewSymbole(false)
    const asset = assets.find(a => a.symbole === value)
    setForm(f => ({
      ...f,
      symbole: value,
      nom: asset?.nom || '',
      compte: asset?.compte || f.compte,
    }))
  }

  // Fetch du nom depuis Yahoo Finance quand on tape un nouveau symbole
  async function fetchNom(symbole: string) {
    if (!symbole || symbole.length < 1) return
    setLoadingNom(true)
    try {
      const res = await fetch(`/api/prix?symbole=${encodeURIComponent(symbole)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.nom) setForm(f => ({ ...f, nom: data.nom }))
      }
    } catch {}
    setLoadingNom(false)
  }

  function handleSymboleInput(value: string) {
    const upper = value.toUpperCase()
    setForm(f => ({ ...f, symbole: upper, nom: '' }))
    if (nomTimeout.current) clearTimeout(nomTimeout.current)
    nomTimeout.current = setTimeout(() => fetchNom(upper), 600)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pru) { setError('Quantité et prix total requis'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        prix_unitaire: pru,
        cout_total: parseFloat(form.prix_total),
      }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ date: new Date().toISOString().slice(0, 10), symbole: '', nom: '', compte: 'SG - PEA', type: 'Achat', quantite: '', prix_total: '' })
      setIsNewSymbole(false)
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

  const fmt = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 4 })
  const fmtEur = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

  // Symboles uniques pour la liste déroulante
  const uniqueSymboles = [...new Map(assets.map(a => [a.symbole, a])).values()]

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Transactions</h1>
          <button onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {showForm ? '✕ Annuler' : '+ Nouvelle transaction'}
          </button>
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
            <h2 className="font-semibold mb-5">Nouvelle transaction</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">

                {/* Date */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Date</label>
                  <input type="date" value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
                </div>

                {/* Sélecteur symbole */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Actif</label>
                  <select
                    onChange={e => handleSelectSymbole(e.target.value)}
                    defaultValue=""
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="" disabled>Choisir un actif...</option>
                    {uniqueSymboles.map(a => (
                      <option key={a.symbole} value={a.symbole}>{a.symbole} — {a.nom}</option>
                    ))}
                    <option value="__new__">➕ Nouveau symbole</option>
                  </select>
                </div>

                {/* Champ symbole si nouveau */}
                {isNewSymbole && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Symbole Yahoo Finance</label>
                    <input type="text" placeholder="ex: AAPL, MC.PA, BTC-EUR"
                      value={form.symbole}
                      onChange={e => handleSymboleInput(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
                  </div>
                )}

                {/* Nom auto */}
                <div className={isNewSymbole ? 'col-span-2 md:col-span-1' : ''}>
                  <label className="block text-xs text-slate-400 mb-1">
                    Nom {loadingNom && <span className="text-indigo-400 ml-1">⟳ Recherche...</span>}
                  </label>
                  <input type="text" placeholder="Nom de l'entreprise"
                    value={form.nom}
                    onChange={e => setForm({ ...form, nom: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                </div>

                {/* Compte */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Compte</label>
                  <select value={form.compte} onChange={e => setForm({ ...form, compte: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    {COMPTES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    {TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>

                {/* Quantité */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Quantité d'actions</label>
                  <input type="number" step="any" placeholder="10"
                    value={form.quantite}
                    onChange={e => setForm({ ...form, quantite: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
                </div>

                {/* Prix total */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Prix total payé (€)</label>
                  <input type="number" step="any" placeholder="1500.00"
                    value={form.prix_total}
                    onChange={e => setForm({ ...form, prix_total: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" required />
                </div>

                {/* PRU calculé */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">PRU calculé automatiquement</label>
                  <div className={`w-full rounded-lg px-3 py-2 text-sm border ${pru ? 'bg-indigo-900/30 border-indigo-700 text-indigo-300 font-semibold' : 'bg-slate-700/50 border-slate-600 text-slate-500'}`}>
                    {pru ? `${pru.toFixed(4)} €` : '— remplis quantité + total'}
                  </div>
                </div>
              </div>

              {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

              <button type="submit" disabled={saving || !pru}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-semibold px-6 py-2 rounded-lg text-sm transition-colors">
                {saving ? 'Sauvegarde...' : '✓ Enregistrer'}
              </button>
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
                  <tr className="text-slate-400 text-left border-b border-slate-700 text-xs">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Symbole</th>
                    <th className="px-4 py-3">Compte</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Quantité</th>
                    <th className="px-4 py-3 text-right">PRU</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t: any) => (
                    <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3 text-slate-300 text-xs">{t.date}</td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">{t.symbole}</span>
                        {t.nom && <span className="text-slate-400 text-xs ml-2 hidden md:inline">{t.nom}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{t.compte}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.type === 'Achat' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300 text-xs">{parseFloat(t.quantite).toFixed(t.quantite < 1 ? 6 : 4)}</td>
                      <td className="px-4 py-3 text-right text-slate-300 text-xs">{fmt(t.prix_unitaire)}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">{fmtEur(t.cout_total)}</td>
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

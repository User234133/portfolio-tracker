'use client'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import RefreshButton from '@/components/RefreshButton'
import AnalysePortefeuille from '@/components/AnalysePortefeuille'
import CoursParValeur from '@/components/CoursParValeur'

type Onglet = 'analyse' | 'cours'

export default function Graphiques() {
  const [onglet, setOnglet] = useState<Onglet | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  // Un lien du type /graphiques?symbole=XXX ouvre directement l'onglet « Cours par valeur »
  useEffect(() => {
    setOnglet(new URLSearchParams(window.location.search).get('symbole') ? 'cours' : 'analyse')
    setUpdatedAt(new Date())
  }, [])

  const tabs: { key: Onglet; label: string }[] = [
    { key: 'analyse', label: '📊 Portefeuille' },
    { key: 'cours', label: '📈 Cours par valeur' },
  ]

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h1 className="text-2xl font-bold">Graphiques</h1>
          <RefreshButton updatedAt={updatedAt} onRefreshed={() => { setRefreshKey(k => k + 1); setUpdatedAt(new Date()) }} />
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 mb-6">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setOnglet(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                onglet === t.key ? 'bg-indigo-600 text-ink' : 'text-slate-300 hover:text-ink hover:bg-slate-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        {onglet === 'analyse' && <AnalysePortefeuille refreshKey={refreshKey} />}
        {onglet === 'cours' && <CoursParValeur refreshKey={refreshKey} />}
      </main>
    </div>
  )
}

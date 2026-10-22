'use client'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import AnalysePortefeuille from '@/components/AnalysePortefeuille'
import CoursParValeur from '@/components/CoursParValeur'

type Onglet = 'analyse' | 'cours'

export default function Graphiques() {
  const [onglet, setOnglet] = useState<Onglet | null>(null)

  // Un lien du type /graphiques?symbole=XXX ouvre directement l'onglet « Cours par valeur »
  useEffect(() => {
    setOnglet(new URLSearchParams(window.location.search).get('symbole') ? 'cours' : 'analyse')
  }, [])

  const tabs: { key: Onglet; label: string }[] = [
    { key: 'analyse', label: '📊 Portefeuille & P&L' },
    { key: 'cours', label: '📈 Cours par valeur' },
  ]

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <h1 className="text-2xl font-bold mr-4">Graphiques</h1>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setOnglet(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                onglet === t.key ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
        {onglet === 'analyse' && <AnalysePortefeuille />}
        {onglet === 'cours' && <CoursParValeur />}
      </main>
    </div>
  )
}

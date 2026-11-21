'use client'
import { useState } from 'react'

export default function RefreshButton({ onRefreshed, updatedAt }: { onRefreshed: () => void | Promise<void>; updatedAt?: Date | null }) {
  const [busy, setBusy] = useState(false)

  async function refresh() {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/refresh', { method: 'POST' })
      await onRefreshed()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end sm:flex-row sm:items-center gap-1 sm:gap-3">
      {updatedAt && (
        <span className="text-xs text-slate-400">
          Mis à jour à {updatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      <button
        onClick={refresh}
        disabled={busy}
        className="bg-indigo-600 hover:bg-indigo-700 text-ink px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-70"
      >
        <span className={busy ? 'inline-block animate-spin' : 'inline-block'}>🔄</span>{' '}
        <span className="hidden sm:inline">{busy ? 'Actualisation...' : 'Actualiser les cours'}</span>
        <span className="sm:hidden">{busy ? '...' : 'Actualiser'}</span>
      </button>
    </div>
  )
}

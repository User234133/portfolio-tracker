'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/dashboard')
    } else {
      setError('Raté ! Ce n’est pas le bon mot de passe 🙈')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm border border-slate-700">
        <div className="flex justify-center mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={96} height={96} className="rounded-3xl border-[3px] border-ink animate-wiggle" />
        </div>
        <h1 className="text-3xl text-center mb-1">Portfolio 🤑</h1>
        <p className="text-slate-400 text-center text-sm mb-6">Dis le mot magique pour entrer !</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            placeholder="Mot de passe secret"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-ink placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-ink font-semibold py-3 rounded-lg"
          >
            Ouvre-toi, sésame ! 🚀
          </button>
        </form>
      </div>
    </div>
  )
}

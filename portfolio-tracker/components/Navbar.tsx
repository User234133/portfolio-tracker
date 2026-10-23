'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/graphiques', label: 'Graphiques', icon: '📉' },
  { href: '/transactions', label: 'Transactions', icon: '💹' },
  { href: '/flux', label: 'Flux', icon: '💰' },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  return (
    <>
      {/* Barre du haut (menu complet sur ordinateur) */}
      <nav className="sticky top-0 z-40 bg-white border-b-[3px] border-ink pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-display text-xl text-ink">
              <span className="inline-block animate-wiggle text-2xl">🤑</span>
              Portfolio
            </Link>
            <div className="hidden md:flex gap-2">
              {links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${
                    pathname === link.href
                      ? 'bg-indigo-600 text-ink'
                      : 'text-slate-300 hover:text-ink hover:bg-slate-700'
                  }`}
                >
                  {link.icon} {link.label}
                </Link>
              ))}
            </div>
          </div>
          <button onClick={logout} className="text-slate-400 hover:text-ink text-sm font-medium px-2 py-2">
            <span className="hidden md:inline">Déconnexion</span>
            <span className="md:hidden text-xl" aria-label="Déconnexion">🚪</span>
          </button>
        </div>
      </nav>

      {/* Barre d'onglets du bas (téléphone) */}
      <div className="bottom-tabs md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t-[3px] border-ink pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4">
          {links.map(link => {
            const active = pathname === link.href
            return (
              <Link key={link.href} href={link.href}
                className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold ${active ? 'text-ink' : 'text-slate-400'}`}>
                <span className={`text-xl leading-none px-4 py-1 rounded-full border-2 ${active ? 'bg-indigo-600 border-ink' : 'border-transparent'}`}>
                  {link.icon}
                </span>
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}

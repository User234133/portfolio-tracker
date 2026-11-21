import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { checkAuth } from '@/lib/auth'

// Vide le cache des cours (5 min) : la prochaine lecture va chercher les prix frais chez Yahoo
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  revalidateTag('prices')
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const symbole = searchParams.get('symbole')
  if (!symbole) return NextResponse.json({ error: 'Symbole manquant' }, { status: 400 })

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbole)}?interval=1d&range=1d`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    if (!result) return NextResponse.json({ nom: null, prix: null })

    const nom = result.meta?.longName || result.meta?.shortName || null
    const prix = result.meta?.regularMarketPrice || null

    return NextResponse.json({ nom, prix })
  } catch {
    return NextResponse.json({ nom: null, prix: null })
  }
}

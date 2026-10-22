import { NextRequest, NextResponse } from 'next/server'
import { dbExecute } from '@/lib/db'
import { checkAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await dbExecute('SELECT * FROM transactions ORDER BY date DESC')
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { date, symbole, nom, compte, type, quantite, prix_unitaire } = body
  const cout_total = parseFloat(quantite) * parseFloat(prix_unitaire)
  await dbExecute(
    'INSERT INTO transactions (date, symbole, nom, compte, type, quantite, prix_unitaire, cout_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [date, symbole.toUpperCase(), nom || symbole, compte, type, parseFloat(quantite), parseFloat(prix_unitaire), cout_total]
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
  await dbExecute('DELETE FROM transactions WHERE id = ?', [id])
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { dbExecute } from '@/lib/db'
import { checkAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const result = await dbExecute('SELECT * FROM flux_tresorerie ORDER BY date DESC')
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const { date, compte, type, montant, commentaire } = body
  await dbExecute(
    'INSERT INTO flux_tresorerie (date, compte, type, montant, commentaire) VALUES (?, ?, ?, ?, ?)',
    [date, compte, type, parseFloat(montant), commentaire || null]
  )
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })
  await dbExecute('DELETE FROM flux_tresorerie WHERE id = ?', [id])
  return NextResponse.json({ ok: true })
}

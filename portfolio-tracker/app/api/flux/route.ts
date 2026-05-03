import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await db.execute(
    'SELECT * FROM flux_tresorerie ORDER BY date DESC'
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { date, compte, type, montant, commentaire } = body

  if (!date || !compte || !type || !montant) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }

  await db.execute({
    sql: 'INSERT INTO flux_tresorerie (date, compte, type, montant, commentaire) VALUES (?, ?, ?, ?, ?)',
    args: [date, compte, type, parseFloat(montant), commentaire || null],
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

  await db.execute({ sql: 'DELETE FROM flux_tresorerie WHERE id = ?', args: [id] })
  return NextResponse.json({ ok: true })
}

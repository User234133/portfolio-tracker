import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await db.execute(
    'SELECT * FROM transactions ORDER BY date DESC'
  )
  return NextResponse.json(result.rows)
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { date, symbole, nom, compte, type, quantite, prix_unitaire } = body

  if (!date || !symbole || !compte || !type || !quantite || !prix_unitaire) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }

  const cout_total = parseFloat(quantite) * parseFloat(prix_unitaire)

  await db.execute({
    sql: 'INSERT INTO transactions (date, symbole, nom, compte, type, quantite, prix_unitaire, cout_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [date, symbole.toUpperCase(), nom || symbole, compte, type, parseFloat(quantite), parseFloat(prix_unitaire), cout_total],
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

  await db.execute({ sql: 'DELETE FROM transactions WHERE id = ?', args: [id] })
  return NextResponse.json({ ok: true })
}

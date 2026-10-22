const TURSO_URL = process.env.TURSO_DATABASE_URL!.replace('libsql://', 'https://')
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN!

export async function dbExecute(sql: string, args: any[] = []) {
  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: args.map(a => valueToTurso(a)) } },
        { type: 'close' },
      ],
    }),
  })

  const data = await res.json()
  const result = data.results?.[0]?.response?.result

  if (!result) return { rows: [] }

  const cols = result.cols.map((c: any) => c.name)
  const rows = result.rows.map((row: any) =>
    Object.fromEntries(cols.map((col: string, i: number) => [col, row[i]?.value ?? null]))
  )

  return { rows }
}

function valueToTurso(v: any) {
  if (v === null || v === undefined) return { type: 'null' }
  if (typeof v === 'number') return { type: 'float', value: v }
  return { type: 'text', value: String(v) }
}

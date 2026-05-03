import { NextRequest } from 'next/server'

export function checkAuth(request: NextRequest): boolean {
  const cookie = request.cookies.get('auth')
  return cookie?.value === process.env.APP_PASSWORD
}

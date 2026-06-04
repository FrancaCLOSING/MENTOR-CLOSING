import { NextRequest, NextResponse } from 'next/server'
import { getConversation, clearConversation } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ messages: [] })
  const messages = await getConversation(key)
  return NextResponse.json({ messages })
}

export async function DELETE(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (key) await clearConversation(key)
  return NextResponse.json({ ok: true })
}

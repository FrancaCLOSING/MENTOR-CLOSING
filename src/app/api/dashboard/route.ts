import { NextResponse } from 'next/server'
import { getStats, getMemory, getProgress, supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const [stats, memory, progress, recentSessions] = await Promise.all([
    getStats(),
    getMemory(),
    getProgress(),
    supabaseAdmin
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(r => r.data || []),
  ])

  return NextResponse.json({ stats, memory, progress, recentSessions })
}

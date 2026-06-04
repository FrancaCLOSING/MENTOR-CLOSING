import { NextResponse } from 'next/server'
import { getStats, getMemory, getProgress, getSkills, getWarmupPhrases, supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const [stats, memory, progress, skills, warmup, recentSessions] = await Promise.all([
    getStats(),
    getMemory(),
    getProgress(),
    getSkills(),
    getWarmupPhrases(5),
    supabaseAdmin.from('sessions').select('*')
      .order('created_at', { ascending: false }).limit(10).then(r => r.data || []),
  ])
  return NextResponse.json({ stats, memory, progress, skills, warmup, recentSessions })
}

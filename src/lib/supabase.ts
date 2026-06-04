import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(url, anon)
export const supabaseAdmin = createClient(url, service)

// ── Types ──────────────────────────────────────
export type ProgressRow = {
  id: string; step_key: string; completed_at: string | null
  drill_scores: number[]; created_at: string
}
export type MemoryRow = {
  id: string; error_desc: string; count: number
  last_seen: string; created_at: string
}
export type SessionRow = {
  id: string; type: string; module_id: number | null
  step_id: number | null; score: number | null
  duration_seconds: number | null; notes: string | null; created_at: string
}
export type Msg = { role: 'user' | 'assistant'; content: string }

// ── Progress ──────────────────────────────────────
export async function getProgress(): Promise<ProgressRow[]> {
  const { data } = await supabaseAdmin.from('progress').select('*')
  return data || []
}
export async function markStepDone(stepKey: string) {
  await supabaseAdmin.from('progress').upsert(
    { step_key: stepKey, completed_at: new Date().toISOString() },
    { onConflict: 'step_key' }
  )
}
export async function saveDrillScore(stepKey: string, score: number) {
  const { data } = await supabaseAdmin.from('progress')
    .select('drill_scores').eq('step_key', stepKey).single()
  const updated = [...(data?.drill_scores || []), score]
  await supabaseAdmin.from('progress').upsert(
    { step_key: stepKey, drill_scores: updated },
    { onConflict: 'step_key' }
  )
  return updated
}

// ── Conversations (persist chat history) ──────────────────────────
export async function saveConversation(stepKey: string, messages: Msg[]) {
  await supabaseAdmin.from('conversations').upsert(
    { step_key: stepKey, messages, updated_at: new Date().toISOString() },
    { onConflict: 'step_key' }
  )
}
export async function getConversation(stepKey: string): Promise<Msg[]> {
  try {
    const { data } = await supabaseAdmin.from('conversations')
      .select('messages').eq('step_key', stepKey).single()
    return (data?.messages as Msg[]) || []
  } catch { return [] }
}
export async function clearConversation(stepKey: string) {
  await supabaseAdmin.from('conversations').delete().eq('step_key', stepKey)
}

// ── Memory ──────────────────────────────────────
export async function getMemory(): Promise<MemoryRow[]> {
  const { data } = await supabaseAdmin.from('memory')
    .select('*').order('count', { ascending: false }).limit(8)
  return data || []
}
export async function addMemoryError(errorDesc: string) {
  const { data } = await supabaseAdmin.from('memory')
    .select('*').ilike('error_desc', errorDesc).single()
  if (data) {
    await supabaseAdmin.from('memory')
      .update({ count: data.count + 1, last_seen: new Date().toISOString() })
      .eq('id', data.id)
  } else {
    await supabaseAdmin.from('memory').insert({ error_desc: errorDesc, count: 1 })
  }
}
export async function extractAndSaveErrors(text: string) {
  const re = /\[ERREUR-RÉCURRENTE:\s*([^\]]+)\]/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const desc = m[1].trim()
    if (desc.length > 4) await addMemoryError(desc)
  }
}

// ── Skills radar ──────────────────────────────────────
export async function updateSkill(skillName: string, score: number) {
  const { data } = await supabaseAdmin.from('skills')
    .select('*').eq('skill_name', skillName).single()
  if (data) {
    const newAvg = (data.score_avg * data.sessions_count + score) / (data.sessions_count + 1)
    await supabaseAdmin.from('skills').update({
      score_avg: Math.round(newAvg * 10) / 10,
      sessions_count: data.sessions_count + 1,
      updated_at: new Date().toISOString()
    }).eq('skill_name', skillName)
  } else {
    await supabaseAdmin.from('skills').insert({
      skill_name: skillName, score_avg: score, sessions_count: 1
    })
  }
}
export async function getSkills() {
  const { data } = await supabaseAdmin.from('skills').select('*')
  return data || []
}

// ── Warmup phrases ──────────────────────────────────────
export async function addWarmupPhrase(phrase: string, context: string, moduleId: number) {
  const { data } = await supabaseAdmin.from('warmup_phrases')
    .select('*').eq('phrase', phrase).single()
  if (data) {
    await supabaseAdmin.from('warmup_phrases')
      .update({ miss_count: data.miss_count + 1 }).eq('id', data.id)
  } else {
    await supabaseAdmin.from('warmup_phrases')
      .insert({ phrase, context, module_id: moduleId, miss_count: 1 })
  }
}
export async function getWarmupPhrases(limit = 5) {
  const { data } = await supabaseAdmin.from('warmup_phrases')
    .select('*').order('miss_count', { ascending: false }).limit(limit)
  return data || []
}

// ── Sessions ──────────────────────────────────────
export async function saveSession(session: Omit<SessionRow, 'id' | 'created_at'>) {
  await supabaseAdmin.from('sessions').insert(session)
}
export async function getStats() {
  const [sessions, memory, progress] = await Promise.all([
    supabaseAdmin.from('sessions').select('score, type').not('score', 'is', null),
    supabaseAdmin.from('memory').select('count', { count: 'exact' }),
    supabaseAdmin.from('progress').select('step_key, completed_at'),
  ])
  const scores = (sessions.data || []).map(s => s.score as number)
  const avg = scores.length
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null
  return {
    totalSessions: sessions.data?.length || 0,
    avgScore: avg,
    memoryCount: memory.count || 0,
    completedSteps: (progress.data || []).filter(p => p.completed_at).length,
  }
}

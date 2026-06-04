import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getMemory, extractAndSaveErrors, supabaseAdmin } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DRILL_MAP: Record<string, string> = {
  prix: '2-3', valeur: '2-3', silence: '2-3',
  cher: '3-5', trop: '3-5',
  réfléchir: '3-6', réflexion: '3-6',
  partenaire: '3-7', copain: '3-7', mari: '3-7',
  identité: '0-3', 'qui tu veux': '0-3',
  douleur: '0-4', problème: '0-4',
  vision: '1-5', futur: '1-5',
  vdi: '1-5',
}

export async function POST(req: NextRequest) {
  const { transcript, context } = await req.json()

  if (!transcript || transcript.length < 50) {
    return NextResponse.json({ error: 'Transcript trop court' }, { status: 400 })
  }

  const memory = await getMemory()
  const memCtx = memory.length
    ? '\n\nERREURS MÉMORISÉES :\n' + memory.map(e => `- "${e.error_desc}" (${e.count}x)`).join('\n')
    : ''

  const system = `Tu es MENTOR, expert closing (VDI², AVIR, 11 frames, NEPQ, Sandler).
Analyse ce transcript ligne par ligne. Pour chaque réplique du closer :
- score /10
- ce qui est bien (si ≥7)
- ce qui cloche (si <7)  
- phrase exacte manquée (si <8)
- tag [ERREUR-RÉCURRENTE: description] si pattern récurrent

Synthèse : score moyen, top 3 erreurs, plan d'entraînement ciblé, drillLink (clé parmi 0-3,0-4,1-5,1-6,1-7,2-3,3-5,3-6,3-7 ou vide).

Retourne UNIQUEMENT ce JSON valide :
{"global":{"score":0,"summary":"","errors":[],"plan":"","drillLink":""},"lines":[{"who":"closer","text":"","score":0,"ok":"","bad":"","better":""}]}${memCtx}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system,
      messages: [{ role: 'user', content: `Transcript:\n${transcript}${context ? '\nContexte: ' + context : ''}` }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract errors from raw response
    await extractAndSaveErrors(raw)

    // Parse JSON robustly
    let data
    try {
      data = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) data = JSON.parse(match[0])
      else throw new Error('JSON invalide dans la réponse')
    }

    // Auto-detect drill link from errors if not provided
    if (!data.global?.drillLink && data.global?.errors?.length) {
      const allErrors = data.global.errors.join(' ').toLowerCase()
      for (const [keyword, key] of Object.entries(DRILL_MAP)) {
        if (allErrors.includes(keyword)) {
          data.global.drillLink = key
          break
        }
      }
    }

    // Save to DB
    await supabaseAdmin.from('call_analyses').insert({
      transcript,
      context: context || null,
      global_score: data.global?.score || 0,
      summary: data.global?.summary || '',
      errors: data.global?.errors || [],
      plan: data.global?.plan || '',
      line_results: data.lines || [],
    })

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Analysis error:', error)
    const message = error instanceof Error ? error.message : 'Analyse échouée'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

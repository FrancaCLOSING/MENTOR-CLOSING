import { NextRequest } from 'next/server'
import { buildSystemPrompt, buildFullCallPrompt } from '@/lib/curriculum'
import { getMemory, extractAndSaveErrors, saveDrillScore, markStepDone, saveSession, saveConversation, updateSkill } from '@/lib/supabase'
import type { Phase } from '@/lib/curriculum'

export const maxDuration = 60

// Map module/step to skill name for radar
function getSkillName(moduleId: number, phase: Phase): string {
  const map: Record<number, string> = { 0: 'psychologie', 1: 'decouverte', 2: 'prix', 3: 'objections' }
  return map[moduleId] || 'general'
}

export async function POST(req: NextRequest) {
  const { messages, moduleId, stepId, phase, mode, personaIdx } = await req.json()
  const memory = await getMemory()

  const system = mode === 'fullcall'
    ? buildFullCallPrompt(personaIdx ?? 0, memory)
    : buildSystemPrompt(moduleId ?? 0, stepId ?? 0, phase as Phase, memory)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      stream: true,
      system,
      messages: messages.slice(-16),
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    return new Response(JSON.stringify(err), { status: response.status })
  }

  const encoder = new TextEncoder()
  let fullText = ''

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullText += parsed.delta.text
                controller.enqueue(encoder.encode(parsed.delta.text))
              }
            } catch {}
          }
        }
      }
      controller.close()

      // ── Post-processing ──
      try {
        await extractAndSaveErrors(fullText)

        // Save conversation history for resuming
        if (moduleId != null && stepId != null) {
          const stepKey = `${moduleId}-${stepId}`
          const allMsgs = [...messages, { role: 'assistant', content: fullText }]
          await saveConversation(stepKey, allMsgs)
        }

        // Score parsing
        const scoreMatch = fullText.match(/SCORE:\s*(\d+)\/10/i)
        if (scoreMatch) {
          const score = parseInt(scoreMatch[1])

          // Update skill radar
          if (moduleId != null) {
            await updateSkill(getSkillName(moduleId, phase as Phase), score)
          }

          if (phase === 'd' && moduleId != null && stepId != null) {
            const scores = await saveDrillScore(`${moduleId}-${stepId}`, score)
            await saveSession({ type: 'drill', module_id: moduleId, step_id: stepId, score, duration_seconds: null, notes: null })
            const last2 = scores.slice(-2)
            if (last2.length === 2 && last2.every(s => s >= 8)) {
              await markStepDone(`${moduleId}-${stepId}`)
            }
          }
        }

        // Step validation tag
        if (fullText.includes('[ÉTAPE-VALIDÉE]') && moduleId != null && stepId != null) {
          await markStepDone(`${moduleId}-${stepId}`)
          const score = scoreMatch ? parseInt(scoreMatch[1]) : null
          await saveSession({
            type: phase === 'r' ? 'roleplay' : 'learn',
            module_id: moduleId, step_id: stepId,
            score, duration_seconds: null, notes: null
          })
        }
      } catch (e) { console.error('Post-processing error:', e) }
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }
  })
}

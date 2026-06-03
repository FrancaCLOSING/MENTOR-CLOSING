import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { buildSystemPrompt, buildFullCallPrompt } from '@/lib/curriculum'
import { getMemory, extractAndSaveErrors, saveDrillScore, markStepDone, saveSession } from '@/lib/supabase'
import type { Phase } from '@/lib/curriculum'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { messages, moduleId, stepId, phase, mode, personaIdx } = await req.json()

  const memory = await getMemory()

  const system = mode === 'fullcall'
    ? buildFullCallPrompt(personaIdx ?? 0, memory)
    : buildSystemPrompt(moduleId ?? 0, stepId ?? 0, phase as Phase, memory)

  // Stream response
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    system,
    messages: messages.slice(-14),
  })

  const encoder = new TextEncoder()
  let fullText = ''

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text
          fullText += text
          controller.enqueue(encoder.encode(text))
        }
      }
      controller.close()

      // Post-processing (async, non-blocking for client)
      try {
        await extractAndSaveErrors(fullText)

        // Parse score
        const scoreMatch = fullText.match(/SCORE:\s*(\d+)\/10/i)
        if (scoreMatch && phase === 'd' && moduleId != null && stepId != null) {
          const score = parseInt(scoreMatch[1])
          const scores = await saveDrillScore(`${moduleId}-${stepId}`, score)
          await saveSession({ type: 'drill', module_id: moduleId, step_id: stepId, score, duration_seconds: null, notes: null })
          
          // Auto-validate: 2 consecutive ≥8
          const last2 = scores.slice(-2)
          if (last2.length === 2 && last2.every(s => s >= 8)) {
            await markStepDone(`${moduleId}-${stepId}`)
          }
        }

        // Validate step via tag
        if (fullText.includes('[ÉTAPE-VALIDÉE]') && moduleId != null && stepId != null) {
          await markStepDone(`${moduleId}-${stepId}`)
          if (phase === 'r') {
            await saveSession({ type: 'roleplay', module_id: moduleId, step_id: stepId, score: parseInt(fullText.match(/SCORE:\s*(\d+)/i)?.[1] || '0'), duration_seconds: null, notes: null })
          } else if (phase === 'c') {
            await saveSession({ type: 'learn', module_id: moduleId, step_id: stepId, score: null, duration_seconds: null, notes: null })
          }
        }
      } catch (e) {
        console.error('Post-processing error:', e)
      }
    }
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    }
  })
}

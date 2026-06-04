import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioBlob = formData.get('audio') as Blob

    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio file' }, { status: 400 })
    }

    // Convert Blob to File for OpenAI SDK
    const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' })

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'fr',
      response_format: 'text',
    })

    return NextResponse.json({ text: transcription })
  } catch (error: unknown) {
    console.error('Transcription error:', error)
    const message = error instanceof Error ? error.message : 'Transcription failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const config = { api: { bodyParser: false } }

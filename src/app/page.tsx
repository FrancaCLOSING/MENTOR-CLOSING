'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { MODULES, PERSONAS, type Phase } from '@/lib/curriculum'
import type { MemoryRow, ProgressRow } from '@/lib/supabase'

// ── Types ────────────────────────────────────────
type View = 'dash' | 'learn' | 'fullcall' | 'transcript' | 'settings'
type Msg = { role: 'user' | 'assistant'; content: string }

interface DashData {
  stats: { totalSessions: number; avgScore: string | null; memoryCount: number; completedSteps: number }
  memory: MemoryRow[]
  progress: ProgressRow[]
}

// ── Score class helper ───────────────────────────
function sc(n: number) { return n >= 8 ? 'text-[var(--gn)]' : n >= 6 ? 'text-[var(--go)]' : 'text-[var(--rd)]' }

// ── Format message content ───────────────────────
function Bubble({ content }: { content: string }) {
  const fmt = (t: string) => {
    t = t.replace(/SCORE:\s*(\d+)\/10/gi, (_, n) =>
      `<div class="score-card"><span class="font-display font-black text-3xl ${sc(+n)}">${n}</span><span class="text-xs text-[var(--mu)]">/10</span></div>`)
    t = t.replace(/\[ÉTAPE-VALIDÉE\]/g, '<span class="text-[var(--gn)] text-xs">✅ Étape validée</span>')
    t = t.replace(/\[ERREUR-RÉCURRENTE:[^\]]+\]/g, '')
    t = t.replace(/⛔ STOP[— ]+([^\n]+(?:\n(?![A-Z🎯✅❌💬⚠️\n])[^\n]+)*)/g,
      (_, b) => `<div class="stop-box"><strong class="text-[var(--rd)]">⛔ STOP</strong> — ${b.trim()}</div>`)
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/\*([^*\n]+)\*/g, '<em class="text-[var(--p3)] not-italic font-medium">$1</em>')
    t = t.replace(/^#{1,3} (.+)$/gm, '<h4 class="font-display font-bold text-sm text-[var(--p2)] mb-1">$1</h4>')
    t = t.replace(/^> "(.+)"$/gm, '<div class="phrase-box">"$1"</div>')
    t = t.replace(/^> (.+)$/gm, '<div class="phrase-box">$1</div>')
    t = t.replace(/^[-•] (.+)$/gm, '<li class="ml-4 text-[var(--mu2)] mb-1">$1</li>')
    t = t.replace(/(<li.*<\/li>)/gs, m => `<ul class="my-2">${m}</ul>`)
    t = t.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')
    return t
  }
  return <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: fmt(content) }} />
}

// ── VoiceButton ──────────────────────────────────
function VoiceButton({ onTranscript, disabled }: { onTranscript: (t: string) => void; disabled: boolean }) {
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function toggle() {
    if (recording) {
      mediaRef.current?.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setLoading(true)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fd = new FormData(); fd.append('audio', blob)
        try {
          const r = await fetch('/api/transcribe', { method: 'POST', body: fd })
          const d = await r.json()
          if (d.text) onTranscript(d.text)
        } catch (e) { console.error(e) }
        setLoading(false)
      }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
    } catch { alert('Micro non disponible') }
  }

  return (
    <button
      onClick={toggle}
      disabled={disabled || loading}
      className={`w-11 h-11 rounded-[10px] flex items-center justify-center text-lg transition-all flex-shrink-0 border
        ${recording ? 'bg-[var(--rd)] border-[var(--rd)] mic-recording text-white' : 'bg-[var(--bg3)] border-[var(--b2)] text-[var(--mu2)] hover:text-white'}
        ${(disabled || loading) ? 'opacity-40 cursor-not-allowed' : ''}`}
      title={recording ? 'Arrêter' : 'Parler'}
    >
      {loading ? '⏳' : recording ? '⏹' : '🎙️'}
    </button>
  )
}

// ── ChatPanel ────────────────────────────────────
function ChatPanel({
  chatId, moduleId, stepId, phase, mode, personaIdx, quickActions
}: {
  chatId: string; moduleId: number; stepId: number; phase: Phase
  mode?: 'learn' | 'fullcall'; personaIdx?: number; quickActions: { l: string; m: string }[]
}) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const prevChatId = useRef('')

  // Auto-start when step changes
  useEffect(() => {
    if (chatId === prevChatId.current) return
    prevChatId.current = chatId
    setMsgs([])
    const starters: Record<Phase, string> = {
      c: `Démarre le cours sur le module ${moduleId + 1}, étape ${stepId + 1}. Commence directement par le mécanisme psychologique profond.`,
      d: `Lance le drill. Donne la phrase modèle exacte et demande la 1ère reformulation.`,
      r: `Lance le roleplay (module ${moduleId + 1}). Présente le persona choisi, puis démarre l'appel.`,
    }
    const fullcallStarter = `Lance le call complet. Présente le persona ${PERSONAS[personaIdx ?? 0].n}, puis démarre : joue la prospect qui décroche le téléphone.`
    callAPI([{ role: 'user', content: mode === 'fullcall' ? fullcallStarter : starters[phase] }])
  }, [chatId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function callAPI(newMsgs: Msg[]) {
    setLoading(true)
    const allMsgs = [...msgs, ...newMsgs]
    setMsgs([...allMsgs, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMsgs, moduleId, stepId, phase, mode: mode ?? 'learn', personaIdx }),
      })

      if (!res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMsgs(prev => {
          const copy = [...prev]
          copy[copy.length - 1] = { role: 'assistant', content: acc }
          return copy
        })
      }

      setMsgs(prev => {
        const copy = [...prev]
        copy[copy.length - 1] = { role: 'assistant', content: acc }
        return copy
      })
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function send(text?: string) {
    const txt = (text ?? input).trim()
    if (!txt || loading) return
    setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
    await callAPI([{ role: 'user', content: txt }])
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4 max-w-[680px]">
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 msg-in ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${m.role === 'user' ? 'bg-[var(--bg4)] text-[var(--mu)]' : 'bg-[var(--p)]'}`}>
                {m.role === 'user' ? '👤' : '🎓'}
              </div>
              <div className={`max-w-[88%] rounded-xl px-4 py-3 text-sm border ${m.role === 'user'
                ? 'bg-[var(--bg3)] border-[rgba(124,109,240,0.15)] rounded-tr-sm'
                : 'bg-[var(--bg2)] border-[var(--b1)] rounded-tl-sm'}`}>
                {m.content === '' && m.role === 'assistant'
                  ? <div className="flex gap-1 py-1">{[0,1,2].map(i => <span key={i} className={`w-1.5 h-1.5 rounded-full bg-[var(--p2)] typing-dot`} style={{ animationDelay: `${i*0.2}s` }} />)}</div>
                  : <Bubble content={m.content} />
                }
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--b1)] bg-[var(--bg)] flex-shrink-0">
        {quickActions.length > 0 && (
          <div className="flex gap-1.5 mb-2.5 flex-wrap max-w-[680px]">
            {quickActions.map((q, i) => (
              <button key={i} onClick={() => send(q.m)}
                className="bg-[var(--bg3)] border border-[var(--b1)] text-[var(--mu2)] px-2.5 py-1 rounded-full text-[11px] cursor-pointer hover:text-[var(--p2)] hover:border-[var(--p2)] transition-colors whitespace-nowrap">
                {q.l}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 max-w-[680px]">
          <textarea
            ref={taRef}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Réponds, reformule, ou pose une question..."
            rows={1}
            className="flex-1 bg-[var(--bg3)] border border-[var(--b2)] rounded-[9px] px-3 py-2.5 text-sm text-[#eeeef8] outline-none resize-none min-h-[44px] max-h-[130px] placeholder:text-[var(--mu)] focus:border-[var(--p)] transition-colors"
          />
          <VoiceButton onTranscript={t => { setInput(t); setTimeout(() => send(t), 100) }} disabled={loading} />
          <button onClick={() => send()}
            disabled={loading || !input.trim()}
            className="w-11 h-11 bg-[var(--p)] rounded-[9px] flex items-center justify-center text-base text-white hover:bg-[var(--p2)] hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 flex-shrink-0">
            →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ──────────────────────────────────────
function Sidebar({ view, setView, progress, mod, setMod, setStep, memory }:
  { view: View; setView: (v: View) => void; progress: string[]; mod: number; setMod: (m: number) => void; setStep: (s: number) => void; memory: MemoryRow[] }) {
  const total = MODULES.reduce((a, m) => a + m.steps.length, 0)
  const pct = Math.round(progress.length / total * 100)

  function navItem(id: View | 'learn' | 'rp', label: string, icon: string, onClick?: () => void) {
    const active = view === id
    return (
      <div onClick={onClick ?? (() => setView(id as View))}
        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-all select-none
          ${active ? 'bg-[var(--pg)] text-[var(--p2)]' : 'text-[var(--mu)] hover:bg-[var(--bg3)] hover:text-[#eeeef8]'}`}>
        <span className="text-sm w-4 text-center">{icon}</span>{label}
      </div>
    )
  }

  return (
    <nav className="w-[228px] h-full bg-[var(--bg2)] border-r border-[var(--b1)] flex flex-col overflow-y-auto flex-shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[var(--b1)]">
        <div className="font-display font-black text-lg tracking-tight">MENTOR<span className="text-[var(--p2)]">.</span></div>
        <div className="text-[9.5px] text-[var(--mu)] uppercase tracking-widest mt-0.5">Prof de Closing IA</div>
      </div>

      {/* Nav */}
      <div className="p-2 pt-3">
        <div className="text-[9.5px] text-[var(--mu)] uppercase tracking-widest px-2.5 mb-1.5">Navigation</div>
        {navItem('dash', 'Tableau de bord', '⚡')}
        {navItem('learn' as View, 'Apprendre', '📚', () => setView('learn'))}
        {navItem('rp' as View, 'Roleplay', '🎭', () => { const m = MODULES[mod]; const i = m.steps.findIndex(s => s.ph === 'r'); if (i > -1) setStep(i); setView('learn') })}
        {navItem('fullcall', 'Call complet', '📞')}
        {navItem('transcript', 'Analyser un call', '🎙️')}
      </div>

      {/* Modules */}
      <div className="p-2">
        <div className="text-[9.5px] text-[var(--mu)] uppercase tracking-widest px-2.5 mb-1.5">Modules</div>
        {MODULES.map((m, i) => {
          const locked = i > mod
          const done = i < mod
          const c = progress.filter(k => k.startsWith(`${i}-`)).length
          return (
            <div key={i} onClick={() => { if (!locked) { setMod(i); setStep(0); setView('learn') } }}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all select-none
                ${locked ? 'opacity-40 cursor-not-allowed text-[var(--mu)]' : 'cursor-pointer text-[var(--mu)] hover:bg-[var(--bg3)] hover:text-[#eeeef8]'}`}>
              <span className="text-sm w-4 text-center">{m.icon}</span>
              <span className="flex-1 truncate">{m.title.split(' ')[0]} {m.title.split(' ')[1] || ''}</span>
              {done ? <span className="w-1.5 h-1.5 rounded-full bg-[var(--gn)] flex-shrink-0" /> : locked ? <span className="text-[9.5px] opacity-30">🔒</span> : null}
            </div>
          )
        })}
      </div>

      {/* Memory errors */}
      {memory.length > 0 && (
        <div className="mx-2 mt-2 bg-[var(--pg)] border border-[rgba(124,109,240,0.2)] rounded-lg p-3 cursor-pointer hover:bg-[rgba(124,109,240,0.2)] transition-colors" onClick={() => setView('dash')}>
          <div className="text-[11px] font-semibold text-[var(--p2)] mb-1">🎯 Session du jour prête</div>
          <div className="text-[10.5px] text-[var(--mu2)] leading-snug">{memory[0].error_desc.slice(0, 40)}…</div>
        </div>
      )}

      {/* Progress */}
      <div className="p-2.5 mt-auto">
        <div className="flex justify-between text-[10px] text-[var(--mu)] mb-1.5">
          <span>Progression</span><span>{pct}%</span>
        </div>
        <div className="h-[2px] bg-[var(--bg4)] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[var(--p)] to-[var(--p2)] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Settings */}
      <div className="p-2 border-t border-[var(--b1)]">
        <div onClick={() => setView('settings')}
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs text-[var(--mu)] hover:bg-[var(--bg3)] hover:text-[#eeeef8] transition-all">
          <span className="text-sm w-4 text-center">⚙️</span>Paramètres
        </div>
      </div>
    </nav>
  )
}

// ── Step sidebar ─────────────────────────────────
function StepSidebar({ mod, step, setStep, progress }:
  { mod: number; step: number; setStep: (s: number) => void; progress: string[] }) {
  const m = MODULES[mod]
  const pct = Math.round(step / m.steps.length * 100)
  const phCls: Record<Phase, string> = { c: 'text-[var(--p2)] bg-[rgba(165,148,249,0.1)]', d: 'text-[var(--go)] bg-[var(--gob)]', r: 'text-[var(--gn)] bg-[var(--gnb)]' }
  return (
    <div className="w-[248px] bg-[var(--bg2)] border-r border-[var(--b1)] flex flex-col overflow-hidden flex-shrink-0">
      <div className="p-4 border-b border-[var(--b1)]">
        <div className="font-display font-bold text-[13px]">Module {mod + 1}</div>
        <div className="text-[11px] text-[var(--mu)] mt-0.5">{m.title}</div>
        <div className="h-[2px] bg-[var(--bg4)] rounded-full mt-3"><div className="h-full bg-gradient-to-r from-[var(--p)] to-[var(--p2)] rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {m.steps.map((s, i) => {
          const key = `${mod}-${i}`, done = progress.includes(key), active = i === step
          return (
            <div key={i} onClick={() => setStep(i)}
              className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer mb-1 transition-all ${active ? 'bg-[var(--pg)]' : 'hover:bg-[var(--bg3)]'}`}>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[7.5px] mt-0.5 flex-shrink-0 transition-all border-[1.5px]
                ${done ? 'bg-[var(--gn)] border-[var(--gn)] text-black' : active ? 'bg-[var(--p)] border-[var(--p)] text-white' : 'bg-[var(--bg4)] border-[var(--b2)] text-[var(--mu)]'}`}>
                {done ? '✓' : i + 1}
              </div>
              <div>
                <div className="text-[9px] text-[var(--mu)] uppercase tracking-[0.4px]">{s.l}</div>
                <div className="text-[11.5px] leading-snug mt-0.5">{s.t}</div>
                <span className={`text-[8.5px] px-1.5 py-0.5 rounded mt-1 inline-block ${phCls[s.ph]}`}>{s.l}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════
export default function App() {
  const [view, setView] = useState<View>('dash')
  const [mod, setMod] = useState(0)
  const [step, setStep] = useState(0)
  const [dash, setDash] = useState<DashData | null>(null)
  const [progress, setProgress] = useState<string[]>([])
  const [memory, setMemory] = useState<MemoryRow[]>([])
  const [fcPersona, setFcPersona] = useState<number | null>(null)
  const [trText, setTrText] = useState('')
  const [trCtx, setTrCtx] = useState('')
  const [trResult, setTrResult] = useState<{ global: { score: number; summary: string; errors: string[]; plan: string; drillLink?: string }; lines: { who: string; text: string; score: number; ok?: string; bad?: string; better?: string }[] } | null>(null)
  const [trLoading, setTrLoading] = useState(false)

  const chatKey = `${mod}-${step}-${view}`

  // Load dashboard data
  const loadDash = useCallback(async () => {
    try {
      const r = await fetch('/api/dashboard')
      const d = await r.json()
      setDash(d)
      setMemory(d.memory || [])
      setProgress((d.progress as ProgressRow[]).filter(p => p.completed_at).map(p => p.step_key))
      // Auto-set current mod/step
      const allSteps = MODULES.flatMap((m, mi) => m.steps.map((_, si) => `${mi}-${si}`))
      const doneKeys = new Set((d.progress as ProgressRow[]).filter(p => p.completed_at).map(p => p.step_key))
      const nextStep = allSteps.find(k => !doneKeys.has(k))
      if (nextStep) {
        const [mi, si] = nextStep.split('-').map(Number)
        setMod(mi); setStep(si)
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { loadDash() }, [loadDash])

  // Refresh progress after step changes
  const handleStepChange = (s: number) => { setStep(s); setTimeout(loadDash, 2000) }

  const phaseFor = (m: number, s: number): Phase => MODULES[m]?.steps[s]?.ph ?? 'c'
  const phase = phaseFor(mod, step)

  const quickActions: Record<Phase, { l: string; m: string }[]> = {
    c: [
      { l: '🔄 Autre explication', m: "Réexplique avec un angle différent ou une métaphore." },
      { l: '💡 Exemple concret', m: "Donne un autre exemple concret dans la niche." },
      { l: '✅ Compris, passe', m: "[VALIDER-ÉTAPE] J'ai compris ce concept en profondeur." },
    ],
    d: [
      { l: '🔁 Recommencer', m: "Recommence le drill, donne-moi la phrase modèle." },
      { l: '💡 Version parfaite', m: "Montre-moi la version parfaite de cette phrase." },
    ],
    r: [
      { l: '⏸ Feedback', m: "STOP. Feedback immédiat sur ma dernière réplique." },
      { l: '🔁 Recommencer', m: "Recommence le roleplay depuis le début." },
      { l: '🎭 Persona plus dur', m: "Change de persona pour le niveau de difficulté supérieur." },
      { l: '✅ Débrief complet', m: "Le roleplay est terminé. Fais le débrief complet avec notes, erreurs et phrases manquées." },
    ],
  }

  async function analyzeCall() {
    if (!trText || trText.length < 50) return
    setTrLoading(true); setTrResult(null)
    try {
      const r = await fetch('/api/analyze-call', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: trText, context: trCtx }),
      })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setTrResult(d)
      await loadDash()
    } catch (e: unknown) { alert('Erreur : ' + (e instanceof Error ? e.message : 'inconnue')) }
    setTrLoading(false)
  }

  // ── RENDER ────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar view={view} setView={setView} progress={progress} mod={mod} setMod={m => { setMod(m); setStep(0) }} setStep={setStep} memory={memory} />

      <main className="flex-1 flex flex-col overflow-hidden">

        {/* DASHBOARD */}
        {view === 'dash' && (
          <div className="flex-1 overflow-y-auto p-9">
            <div className="max-w-[840px]">
              <div className="mb-7">
                <h1 className="font-display font-black text-[26px]">Bonjour, <span className="text-[var(--p2)]">Closer</span> 👋</h1>
                <p className="text-sm text-[var(--mu)] mt-1.5">{memory.length ? `🎯 MENTOR a mémorisé ${memory.length} erreur(s) — session ciblée prête` : 'Continue ta progression vers le stade Inconscient Compétent'}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3 mb-7">
                {[
                  { v: dash?.stats.totalSessions ?? 0, l: 'Sessions' },
                  { v: dash?.stats.avgScore ?? '—', l: 'Score moyen /10' },
                  { v: `M${mod + 1}`, l: 'Module actuel' },
                  { v: memory.length, l: 'Erreurs suivies' },
                ].map((s, i) => (
                  <div key={i} className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4">
                    <div className="font-display font-bold text-3xl">{s.v}</div>
                    <div className="text-xs text-[var(--mu)] mt-1">{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Memory panel */}
              {memory.length > 0 && (
                <div className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4 mb-6">
                  <div className="text-xs font-semibold text-[var(--mu2)] mb-3">🧠 Tes erreurs récurrentes — ciblées à chaque session</div>
                  {memory.slice(0, 4).map((e, i) => (
                    <div key={i} className="flex items-start gap-2 py-2 border-b border-[var(--b1)] last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--rd)] mt-1.5 flex-shrink-0" />
                      <div><div className="text-xs">{e.error_desc}</div><div className="text-[10.5px] text-[var(--mu)]">{e.count}x détectée</div></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Modules */}
              <div className="text-sm font-display font-bold mb-3">Modules</div>
              <div className="grid grid-cols-2 gap-3 mb-7">
                {MODULES.map((m, i) => {
                  const lk = i > mod, dn = i < mod, cu = i === mod
                  const c = progress.filter(k => k.startsWith(`${i}-`)).length
                  return (
                    <div key={i} onClick={() => { if (!lk) { setMod(i); setStep(0); setView('learn') } }}
                      className={`bg-[var(--bg2)] border rounded-xl p-5 relative overflow-hidden transition-all
                        ${lk ? 'opacity-40 cursor-not-allowed border-[var(--b1)]' : 'cursor-pointer hover:-translate-y-0.5 border-[var(--b1)] hover:border-[var(--b2)]'}
                        ${dn ? 'after:bg-[var(--gn)]' : cu ? 'after:bg-[var(--p)]' : 'after:bg-[var(--b1)]'}`}
                      style={{ ['--tw-border-opacity' as string]: 1 }}>
                      <div className={`absolute top-0 left-0 right-0 h-0.5 ${dn ? 'bg-[var(--gn)]' : cu ? 'bg-[var(--p)]' : 'bg-[var(--b1)]'}`} />
                      <div className="text-[10px] text-[var(--mu)] uppercase tracking-widest mb-1">Module {i + 1}</div>
                      <div className="font-display font-bold text-[14.5px] mb-1">{m.icon} {m.title}</div>
                      <div className="text-xs text-[var(--mu)] leading-relaxed mb-3">{m.desc}</div>
                      <div className="h-[2px] bg-[var(--bg4)] rounded-full mb-3"><div className="h-full bg-gradient-to-r from-[var(--p)] to-[var(--p2)] rounded-full" style={{ width: `${Math.round(c / m.steps.length * 100)}%` }} /></div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10.5px] text-[var(--mu)]">{c}/{m.steps.length}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${dn ? 'bg-[var(--gnb)] text-[var(--gn)]' : cu ? 'bg-[var(--pg)] text-[var(--p2)]' : 'bg-[var(--bg4)] text-[var(--mu)]'}`}>
                          {dn ? '✓ Terminé' : cu ? 'En cours' : '🔒'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Actions */}
              <div className="text-sm font-display font-bold mb-3">Actions</div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { l: '📚 Continuer le cours', fn: () => setView('learn') },
                  { l: '🎭 Roleplay', fn: () => { const ri = MODULES[mod].steps.findIndex(s => s.ph === 'r'); if (ri > -1) setStep(ri); setView('learn') } },
                  { l: '📞 Call complet', fn: () => setView('fullcall') },
                  { l: '🎙️ Analyser un call', fn: () => setView('transcript') },
                ].map((a, i) => (
                  <button key={i} onClick={a.fn}
                    className={`${i === 0 ? 'bg-[var(--p)] text-white' : 'bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)]'} px-4 py-2.5 rounded-[9px] text-sm font-semibold cursor-pointer hover:opacity-80 transition-opacity`}>
                    {a.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LEARN */}
        {view === 'learn' && (
          <div className="flex flex-1 min-h-0">
            <StepSidebar mod={mod} step={step} setStep={handleStepChange} progress={progress} />
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              <div className="px-7 py-3 border-b border-[var(--b1)] flex items-center gap-3 flex-shrink-0 bg-[var(--bg)]">
                <button onClick={() => setView('dash')} className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-1.5 rounded-[8px] text-xs hover:text-white transition-colors flex-shrink-0">← Retour</button>
                <div className="font-display font-bold text-sm flex-1 truncate">{MODULES[mod].steps[step]?.t}</div>
                <span className={`text-[9.5px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex-shrink-0
                  ${phase === 'c' ? 'bg-[rgba(165,148,249,0.1)] text-[var(--p2)]' : phase === 'd' ? 'bg-[var(--gob)] text-[var(--go)]' : 'bg-[var(--gnb)] text-[var(--gn)]'}`}>
                  {phase === 'c' ? 'Comprendre' : phase === 'd' ? 'Drilling' : 'Roleplay'}
                </span>
              </div>
              <ChatPanel chatId={chatKey} moduleId={mod} stepId={step} phase={phase} mode="learn" quickActions={quickActions[phase]} />
            </div>
          </div>
        )}

        {/* FULL CALL */}
        {view === 'fullcall' && (
          <div className="flex flex-1 min-h-0">
            {/* Persona picker */}
            <div className="w-[240px] bg-[var(--bg2)] border-r border-[var(--b1)] flex flex-col p-4 overflow-y-auto flex-shrink-0">
              <div className="font-display font-bold text-sm mb-1">📞 Call Complet</div>
              <div className="text-xs text-[var(--mu)] mb-4 leading-relaxed">Simulation A→Z — Orientation → VDI² → Prix → Objections → Closing</div>
              <div className="text-[10px] text-[var(--mu)] uppercase tracking-widest mb-2">Choisir la difficulté</div>
              <div className="flex flex-col gap-2">
                {PERSONAS.map((p, i) => (
                  <div key={i} onClick={() => setFcPersona(i)}
                    className={`bg-[var(--bg3)] border rounded-lg p-3 cursor-pointer transition-all hover:border-[var(--p)]
                      ${fcPersona === i ? 'border-[var(--p)]' : 'border-[var(--b1)]'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span>{p.e}</span>
                      <strong className="text-xs">{p.n}</strong>
                      <span className="ml-auto text-[10px] text-[var(--mu)]">{p.d}/5</span>
                    </div>
                    <div className="text-[11px] text-[var(--mu)] leading-snug">{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              <div className="px-7 py-3 border-b border-[var(--b1)] flex items-center gap-3 flex-shrink-0 bg-[var(--bg)]">
                <button onClick={() => setView('dash')} className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-1.5 rounded-[8px] text-xs hover:text-white transition-colors">← Retour</button>
                <div className="font-display font-bold text-sm flex-1">
                  {fcPersona !== null ? `Call avec ${PERSONAS[fcPersona].n} (diff ${PERSONAS[fcPersona].d}/5)` : 'Choisis un persona pour commencer'}
                </div>
              </div>
              {fcPersona !== null ? (
                <ChatPanel chatId={`fc-${fcPersona}`} moduleId={mod} stepId={step} phase="r" mode="fullcall" personaIdx={fcPersona}
                  quickActions={[
                    { l: '⏸ Feedback', m: 'STOP. Feedback immédiat sur ma dernière réplique.' },
                    { l: '🔁 Recommencer', m: 'Recommence le call depuis le début.' },
                    { l: '✅ Débrief par phase', m: 'Call terminé. Débrief complet avec notes par phase (Orientation/VDI²/Prix/Objections/Closing), erreurs et phrases manquées.' },
                  ]} />
              ) : (
                <div className="flex-1 flex items-center justify-center text-[var(--mu)] text-sm">← Choisis un persona</div>
              )}
            </div>
          </div>
        )}

        {/* TRANSCRIPT */}
        {view === 'transcript' && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-7 py-3 border-b border-[var(--b1)] flex items-center gap-3 bg-[var(--bg)] flex-shrink-0">
              <div className="font-display font-bold text-sm">🎙️ Analyse de call réel</div>
              <span className="text-[9.5px] px-2.5 py-1 rounded-full font-bold uppercase bg-[rgba(224,86,160,0.1)] text-[#e056a0]">Live</span>
            </div>
            <div className="p-8 max-w-[760px]">
              <p className="text-sm text-[var(--mu)] mb-5 leading-relaxed">Colle le transcript de ton vrai call. MENTOR analyse chaque réplique — note /10, erreur précise, phrase exacte manquée. Les erreurs récurrentes sont mémorisées automatiquement.</p>
              <div className="mb-4">
                <label className="block text-[10px] text-[var(--mu)] uppercase tracking-wider mb-1.5">Transcript</label>
                <textarea value={trText} onChange={e => setTrText(e.target.value)} placeholder={"Closer : Bonjour, je suis...\nProspect : Bonjour..."}
                  className="w-full bg-[var(--bg3)] border border-[var(--b2)] rounded-[9px] px-3 py-2.5 text-sm text-[#eeeef8] outline-none resize-y min-h-[180px] placeholder:text-[var(--mu)] focus:border-[var(--p)] transition-colors" />
              </div>
              <div className="mb-5">
                <label className="block text-[10px] text-[var(--mu)] uppercase tracking-wider mb-1.5">Contexte (optionnel)</label>
                <input value={trCtx} onChange={e => setTrCtx(e.target.value)} placeholder="Ex: call de 30 min, perdu sur l'objection prix..."
                  className="w-full bg-[var(--bg3)] border border-[var(--b2)] rounded-[9px] px-3 py-2.5 text-sm text-[#eeeef8] outline-none placeholder:text-[var(--mu)] focus:border-[var(--p)] transition-colors" />
              </div>
              <button onClick={analyzeCall} disabled={trLoading || trText.length < 50}
                className="bg-[var(--gn)] text-black font-bold px-5 py-2.5 rounded-[9px] text-sm cursor-pointer hover:bg-[var(--gn2)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {trLoading ? '⏳ Analyse en cours...' : '🔍 Analyser ce call'}
              </button>

              {trResult && (
                <div className="mt-8">
                  {/* Global score */}
                  <div className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-5 mb-5">
                    <div className="flex items-baseline gap-3 mb-3">
                      <span className={`font-display font-black text-4xl ${sc(trResult.global.score)}`}>{trResult.global.score}</span>
                      <span className="text-sm text-[var(--mu)]">/10 — Score global</span>
                    </div>
                    <p className="text-sm text-[var(--mu2)] leading-relaxed mb-3">{trResult.global.summary}</p>
                    {trResult.global.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 py-2 border-t border-[var(--b1)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--rd)] mt-1.5 flex-shrink-0" />
                        <div className="text-xs">{e}</div>
                      </div>
                    ))}
                    {trResult.global.plan && <div className="mt-3 bg-[var(--gob)] rounded-lg px-3 py-2 text-xs text-[var(--go)]"><strong>Plan :</strong> {trResult.global.plan}</div>}
                    {trResult.global.drillLink && (
                      <button onClick={() => { const [mi, si] = trResult.global.drillLink!.split('-').map(Number); setMod(mi); setStep(si); setView('learn') }}
                        className="mt-3 bg-[var(--p)] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[var(--p2)] transition-colors">
                        🎯 S'entraîner sur cette erreur →
                      </button>
                    )}
                  </div>

                  {/* Line by line */}
                  <div className="font-display font-bold text-sm mb-3">Ligne par ligne</div>
                  {trResult.lines.filter(l => l.who === 'closer' && l.text).map((l, i) => (
                    <div key={i} className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4 mb-3">
                      <div className="text-xs text-[var(--mu2)] italic border-l-2 border-[var(--b2)] pl-3 mb-3 leading-relaxed">{l.text}</div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className={`font-display font-black text-xl ${sc(l.score)}`}>{l.score}</span>
                        <span className="text-xs text-[var(--mu)]">/10</span>
                      </div>
                      <div className="text-xs leading-relaxed">
                        {l.ok && <div className="text-[var(--gn)] mb-1">✓ {l.ok}</div>}
                        {l.bad && <div className="text-[var(--rd)]">✗ {l.bad}</div>}
                      </div>
                      {l.better && l.score < 8 && <div className="mt-2 bg-[var(--pg)] rounded-lg px-3 py-2 text-xs text-[var(--p3)] italic">💬 "{l.better}"</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {view === 'settings' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-[440px]">
            <h1 className="font-display font-bold text-xl mb-6">⚙️ Paramètres</h1>
            <div className="border-t border-[var(--b1)] pt-5">
              <div className="font-display font-bold text-sm mb-3">Mémoire des erreurs ({memory.length})</div>
              {memory.length === 0 && <p className="text-xs text-[var(--mu)] mb-4">Aucune erreur mémorisée pour l'instant.</p>}
              {memory.map((e, i) => (
                <div key={i} className="flex items-start gap-2 py-2 border-b border-[var(--b1)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--rd)] mt-1.5 flex-shrink-0" />
                  <div><div className="text-xs">{e.error_desc}</div><div className="text-[10.5px] text-[var(--mu)]">{e.count}x</div></div>
                </div>
              ))}
              <div className="flex gap-2 mt-4 flex-wrap">
                <button onClick={async () => { if (!confirm('Effacer la mémoire ?')) return; await fetch('/api/dashboard'); loadDash() }}
                  className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-2 rounded-lg text-xs hover:text-white transition-colors">
                  🗑️ Effacer la mémoire
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

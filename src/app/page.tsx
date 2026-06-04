'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { MODULES, PERSONAS, type Phase } from '@/lib/curriculum'
import type { MemoryRow, ProgressRow } from '@/lib/supabase'

type View = 'dash' | 'learn' | 'fullcall' | 'transcript' | 'settings' | 'warmup'
type Msg = { role: 'user' | 'assistant'; content: string }

interface DashData {
  stats: { totalSessions: number; avgScore: string | null; memoryCount: number; completedSteps: number }
  memory: MemoryRow[]
  progress: ProgressRow[]
  skills: { skill_name: string; score_avg: number; sessions_count: number }[]
  warmup: { phrase: string; context: string; miss_count: number }[]
}

function sc(n: number) { return n >= 8 ? 'text-[var(--gn)]' : n >= 6 ? 'text-[var(--go)]' : 'text-[var(--rd)]' }

function Bubble({ content }: { content: string }) {
  const fmt = (t: string) => {
    t = t.replace(/SCORE:\s*(\d+)\/10/gi, (_, n) =>
      `<div class="score-card"><span class="font-display font-black text-3xl ${sc(+n)}">${n}</span><span class="text-xs text-[var(--mu)]">/10</span></div>`)
    t = t.replace(/\[ÉTAPE-VALIDÉE\]/g, '<span class="text-[var(--gn)] text-xs font-semibold">✅ Étape validée</span>')
    t = t.replace(/\[ERREUR-RÉCURRENTE:[^\]]+\]/g, '')
    t = t.replace(/⛔ STOP[— ]+([^\n]+(?:\n(?![A-Z🎯✅❌💬⚠️\n])[^\n]+)*)/g,
      (_, b) => `<div class="stop-box"><strong class="text-[var(--rd)]">⛔ STOP</strong> — ${b.trim()}</div>`)
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    t = t.replace(/\*([^*\n]+)\*/g, '<em class="text-[var(--p3)] not-italic font-medium">$1</em>')
    t = t.replace(/^#{1,3} (.+)$/gm, '<h4 class="font-display font-bold text-sm text-[var(--p2)] mb-1 mt-2">$1</h4>')
    t = t.replace(/^> "(.+)"$/gm, '<div class="phrase-box">"$1"</div>')
    t = t.replace(/^> (.+)$/gm, '<div class="phrase-box">$1</div>')
    t = t.replace(/^[-•] (.+)$/gm, '<li class="ml-4 text-[var(--mu2)] mb-1">$1</li>')
    t = t.replace(/(<li[^>]*>[\s\S]*?<\/li>)/g, m => `<ul class="my-2">${m}</ul>`)
    t = t.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')
    return t
  }
  return <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: fmt(content) }} />
}

// ── Skill Radar ──────────────────────────────────────
function SkillRadar({ skills }: { skills: { skill_name: string; score_avg: number }[] }) {
  const skillMap: Record<string, string> = {
    psychologie: 'Psychologie', decouverte: 'VDI²', prix: 'Prix', objections: 'Objections'
  }
  const defaultSkills = ['psychologie', 'decouverte', 'prix', 'objections']
  const data = defaultSkills.map(k => ({
    name: skillMap[k], val: skills.find(s => s.skill_name === k)?.score_avg || 0
  }))
  const cx = 80, cy = 80, r = 60
  const points = data.map((_, i) => {
    const angle = (i / data.length) * 2 * Math.PI - Math.PI / 2
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
  const dataPoints = data.map((d, i) => {
    const angle = (i / data.length) * 2 * Math.PI - Math.PI / 2
    const pct = d.val / 10
    return { x: cx + r * pct * Math.cos(angle), y: cy + r * pct * Math.sin(angle) }
  })
  const polygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ')
  const grid = [0.25, 0.5, 0.75, 1].map(pct =>
    points.map((p, i) => {
      const angle = (i / data.length) * 2 * Math.PI - Math.PI / 2
      return `${cx + r * pct * Math.cos(angle)},${cy + r * pct * Math.sin(angle)}`
    }).join(' ')
  )
  return (
    <div className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4">
      <div className="text-xs font-semibold text-[var(--mu2)] mb-3">📊 Radar de compétences</div>
      <div className="flex items-center gap-4">
        <svg width="160" height="160" viewBox="0 0 160 160">
          {grid.map((g, i) => <polygon key={i} points={g} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />)}
          {points.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />)}
          <polygon points={polygon} fill="rgba(124,109,240,0.2)" stroke="var(--p2)" strokeWidth="1.5" />
          {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--p2)" />)}
          {points.map((p, i) => {
            const dx = p.x - cx, dy = p.y - cy
            const lx = p.x + (dx > 0 ? 8 : dx < 0 ? -8 : 0)
            const ly = p.y + (dy > 0 ? 10 : dy < 0 ? -6 : 0)
            return <text key={i} x={lx} y={ly} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)">{data[i].name}</text>
          })}
        </svg>
        <div className="flex flex-col gap-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[var(--p2)]" />
              <div className="text-xs text-[var(--mu2)]">{d.name}</div>
              <div className={`text-xs font-bold ml-auto ${sc(d.val)}`}>{d.val > 0 ? d.val.toFixed(1) : '—'}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Timer ──────────────────────────────────────
function SessionTimer() {
  const [secs, setSecs] = useState(0)
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [active])
  const m = Math.floor(secs / 60), s = secs % 60
  return (
    <div className="flex items-center gap-2">
      <div className={`text-xs font-mono ${active ? 'text-[var(--gn)]' : 'text-[var(--mu)]'}`}>
        {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </div>
      <button onClick={() => setActive(a => !a)}
        className="text-[9px] px-2 py-0.5 rounded bg-[var(--bg4)] text-[var(--mu)] hover:text-white transition-colors">
        {active ? '⏸' : '▶'}
      </button>
      {secs > 0 && <button onClick={() => { setSecs(0); setActive(false) }}
        className="text-[9px] text-[var(--mu)] hover:text-[var(--rd)] transition-colors">✕</button>}
    </div>
  )
}

// ── VoiceButton ──────────────────────────────────
function VoiceButton({ onTranscript, disabled }: { onTranscript: (t: string) => void; disabled: boolean }) {
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function toggle() {
    if (recording) { mediaRef.current?.stop(); setRecording(false); return }
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
      mr.start(); mediaRef.current = mr; setRecording(true)
    } catch { alert('Micro non disponible') }
  }

  return (
    <button onClick={toggle} disabled={disabled || loading}
      className={`w-11 h-11 rounded-[10px] flex items-center justify-center text-lg transition-all flex-shrink-0 border
        ${recording ? 'bg-[var(--rd)] border-[var(--rd)] mic-recording text-white' : 'bg-[var(--bg3)] border-[var(--b2)] text-[var(--mu2)] hover:text-white'}
        ${(disabled || loading) ? 'opacity-40 cursor-not-allowed' : ''}`}
      title={recording ? 'Arrêter' : 'Parler'}>
      {loading ? '⏳' : recording ? '⏹' : '🎙️'}
    </button>
  )
}

// ── ChatPanel ──────────────────────────────────────
function ChatPanel({
  chatId, moduleId, stepId, phase, mode, personaIdx, quickActions, onReload
}: {
  chatId: string; moduleId: number; stepId: number; phase: Phase
  mode?: 'learn' | 'fullcall'; personaIdx?: number
  quickActions: { l: string; m: string }[]
  onReload?: () => void
}) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [resumed, setResumed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const prevChatId = useRef('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (chatId === prevChatId.current) return
    prevChatId.current = chatId
    // Abort any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setMsgs([])
    setResumed(false)
    loadOrStart()
  }, [chatId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  async function loadOrStart() {
    if (mode === 'fullcall') { startFresh(); return }
    // Try to load existing conversation
    try {
      const r = await fetch(`/api/conversation?key=${moduleId}-${stepId}`)
      const d = await r.json()
      if (d.messages && d.messages.length > 1) {
        setMsgs(d.messages)
        setResumed(true)
        return
      }
    } catch {}
    startFresh()
  }

  function startFresh() {
    const starters: Record<Phase, string> = {
      c: `Démarre le cours sur "${MODULES[moduleId]?.steps[stepId]?.t}". Commence directement par le mécanisme psychologique profond. Rappelle mes erreurs mémorisées si pertinent.`,
      d: `Lance le drill sur "${MODULES[moduleId]?.steps[stepId]?.t}". Rappelle mes erreurs mémorisées liées à ce drill, puis donne la phrase modèle.`,
      r: `Lance le roleplay (module ${moduleId + 1}, "${MODULES[moduleId]?.steps[stepId]?.t}"). Annonce le persona (adapté à mon niveau), puis démarre l'appel.`,
    }
    const fcStarter = `Lance le call complet avec ${PERSONAS[personaIdx ?? 0].n}. Présente le persona puis démarre l'appel.`
    callAPI([{ role: 'user', content: mode === 'fullcall' ? fcStarter : starters[phase] }])
  }

  async function callAPI(newMsgs: Msg[]) {
    setLoading(true)
    const allMsgs = [...msgs.filter(m => !(m.role === 'assistant' && m.content === '')), ...newMsgs]
    setMsgs([...allMsgs, { role: 'assistant', content: '' }])
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMsgs, moduleId, stepId, phase, mode: mode ?? 'learn', personaIdx }),
        signal: abortRef.current?.signal,
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
      // Notify parent to refresh progress
      if (acc.includes('[ÉTAPE-VALIDÉE]')) onReload?.()
    } catch (e: unknown) {
      if ((e as Error)?.name !== 'AbortError') console.error(e)
    } finally { setLoading(false) }
  }

  async function send(text?: string) {
    const txt = (text ?? input).trim()
    if (!txt || loading) return
    setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
    setResumed(false)
    await callAPI([{ role: 'user', content: txt }])
  }

  async function restart() {
    await fetch(`/api/conversation?key=${moduleId}-${stepId}`, { method: 'DELETE' })
    setMsgs([]); setResumed(false)
    abortRef.current = new AbortController()
    startFresh()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4 max-w-[680px]">
          {resumed && (
            <div className="flex items-center justify-between bg-[var(--pg)] border border-[rgba(124,109,240,0.2)] rounded-xl px-4 py-3">
              <div className="text-xs text-[var(--p2)]">↩️ Conversation reprise — tu continues là où tu t'es arrêtée</div>
              <button onClick={restart} className="text-[10px] text-[var(--mu)] hover:text-[var(--rd)] transition-colors ml-3">Recommencer</button>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`flex gap-3 msg-in ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0
                ${m.role === 'user' ? 'bg-[var(--bg4)] text-[var(--mu)]' : 'bg-[var(--p)]'}`}>
                {m.role === 'user' ? '👤' : '🎓'}
              </div>
              <div className={`max-w-[88%] rounded-xl px-4 py-3 text-sm border
                ${m.role === 'user'
                  ? 'bg-[var(--bg3)] border-[rgba(124,109,240,0.15)] rounded-tr-sm'
                  : 'bg-[var(--bg2)] border-[var(--b1)] rounded-tl-sm'}`}>
                {m.content === '' && m.role === 'assistant'
                  ? <div className="flex gap-1 py-1">{[0,1,2].map(j => (
                      <span key={j} className="w-1.5 h-1.5 rounded-full bg-[var(--p2)] typing-dot" style={{ animationDelay: `${j*0.2}s` }} />
                    ))}</div>
                  : <Bubble content={m.content} />}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
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
          <textarea ref={taRef} value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px' }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Réponds, reformule, ou pose une question..." rows={1}
            className="flex-1 bg-[var(--bg3)] border border-[var(--b2)] rounded-[9px] px-3 py-2.5 text-sm text-[#eeeef8] outline-none resize-none min-h-[44px] max-h-[130px] placeholder:text-[var(--mu)] focus:border-[var(--p)] transition-colors" />
          <VoiceButton onTranscript={t => { setInput(t); setTimeout(() => send(t), 100) }} disabled={loading} />
          <button onClick={() => send()} disabled={loading || !input.trim()}
            className="w-11 h-11 bg-[var(--p)] rounded-[9px] flex items-center justify-center text-base text-white hover:bg-[var(--p2)] hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 flex-shrink-0">
            →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ──────────────────────────────────────
function Sidebar({ view, setView, progress, mod, setMod, setStep, memory, goLearn, goRP }:
  { view: View; setView: (v: View) => void; progress: string[]; mod: number
    setMod: (m: number) => void; setStep: (s: number) => void
    memory: MemoryRow[]; goLearn: () => void; goRP: () => void }) {
  const total = MODULES.reduce((a, m) => a + m.steps.length, 0)
  const pct = Math.round(progress.length / total * 100)

  return (
    <nav className="w-[228px] h-full bg-[var(--bg2)] border-r border-[var(--b1)] flex flex-col overflow-y-auto flex-shrink-0">
      <div className="px-4 py-5 border-b border-[var(--b1)]">
        <div className="font-display font-black text-lg tracking-tight">MENTOR<span className="text-[var(--p2)]">.</span></div>
        <div className="text-[9.5px] text-[var(--mu)] uppercase tracking-widest mt-0.5">Prof de Closing IA</div>
      </div>
      <div className="p-2 pt-3">
        <div className="text-[9.5px] text-[var(--mu)] uppercase tracking-widest px-2.5 mb-1.5">Navigation</div>
        {[
          { id: 'dash', label: 'Tableau de bord', icon: '⚡', fn: () => setView('dash') },
          { id: 'warmup', label: 'Warmup 5 min', icon: '🔥', fn: () => setView('warmup') },
          { id: 'learn', label: 'Apprendre', icon: '📚', fn: goLearn },
          { id: 'rp', label: 'Roleplay', icon: '🎭', fn: goRP },
          { id: 'fullcall', label: 'Call complet', icon: '📞', fn: () => setView('fullcall') },
          { id: 'transcript', label: 'Analyser un call', icon: '🎙️', fn: () => setView('transcript') },
        ].map(item => (
          <div key={item.id} onClick={item.fn}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-all select-none
              ${view === item.id ? 'bg-[var(--pg)] text-[var(--p2)]' : 'text-[var(--mu)] hover:bg-[var(--bg3)] hover:text-[#eeeef8]'}`}>
            <span className="text-sm w-4 text-center">{item.icon}</span>{item.label}
          </div>
        ))}
      </div>
      <div className="p-2">
        <div className="text-[9.5px] text-[var(--mu)] uppercase tracking-widest px-2.5 mb-1.5">Modules</div>
        {MODULES.map((m, i) => {
          const locked = i > mod
          const done = i < mod
          return (
            <div key={i} onClick={() => { if (!locked) { setMod(i); setStep(0); goLearn() } }}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all select-none
                ${locked ? 'opacity-40 cursor-not-allowed text-[var(--mu)]' : 'cursor-pointer text-[var(--mu)] hover:bg-[var(--bg3)] hover:text-[#eeeef8]'}`}>
              <span className="text-sm w-4 text-center">{m.icon}</span>
              <span className="flex-1 truncate">{m.title.split(' ').slice(0,2).join(' ')}</span>
              {done ? <span className="w-1.5 h-1.5 rounded-full bg-[var(--gn)] flex-shrink-0" />
                : locked ? <span className="text-[9.5px] opacity-30">🔒</span> : null}
            </div>
          )
        })}
      </div>
      {memory.length > 0 && (
        <div className="mx-2 mt-2 bg-[var(--pg)] border border-[rgba(124,109,240,0.2)] rounded-lg p-3 cursor-pointer hover:bg-[rgba(124,109,240,0.2)] transition-colors" onClick={() => setView('warmup')}>
          <div className="text-[11px] font-semibold text-[var(--p2)] mb-1">🔥 Warmup disponible</div>
          <div className="text-[10.5px] text-[var(--mu2)] leading-snug">{memory[0].error_desc.slice(0, 40)}…</div>
        </div>
      )}
      <div className="p-2.5 mt-auto">
        <div className="flex justify-between text-[10px] text-[var(--mu)] mb-1.5">
          <span>Progression</span><span>{pct}%</span>
        </div>
        <div className="h-[2px] bg-[var(--bg4)] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[var(--p)] to-[var(--p2)] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="p-2 border-t border-[var(--b1)]">
        <div onClick={() => setView('settings')}
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs text-[var(--mu)] hover:bg-[var(--bg3)] hover:text-[#eeeef8] transition-all">
          <span className="text-sm w-4 text-center">⚙️</span>Paramètres
        </div>
      </div>
    </nav>
  )
}

// ── Step Sidebar ──────────────────────────────────────
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
        <div className="h-[2px] bg-[var(--bg4)] rounded-full mt-3"><div className="h-full bg-gradient-to-r from-[var(--p)] to-[var(--p2)] rounded-full" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {m.steps.map((s, i) => {
          const key = `${mod}-${i}`, dn = progress.includes(key), active = i === step
          return (
            <div key={i} onClick={() => setStep(i)}
              className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer mb-1 transition-all ${active ? 'bg-[var(--pg)]' : 'hover:bg-[var(--bg3)]'}`}>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[7.5px] mt-0.5 flex-shrink-0 border-[1.5px] transition-all
                ${dn ? 'bg-[var(--gn)] border-[var(--gn)] text-black' : active ? 'bg-[var(--p)] border-[var(--p)] text-white' : 'bg-[var(--bg4)] border-[var(--b2)] text-[var(--mu)]'}`}>
                {dn ? '✓' : i + 1}
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

  const loadDash = useCallback(async () => {
    try {
      const r = await fetch('/api/dashboard')
      const d = await r.json()
      setDash(d)
      setMemory(d.memory || [])
      const done = new Set((d.progress as ProgressRow[]).filter(p => p.completed_at).map((p: ProgressRow) => p.step_key))
      setProgress(Array.from(done) as string[])
      // Auto-navigate to current step
      const allSteps = MODULES.flatMap((m, mi) => m.steps.map((_, si) => `${mi}-${si}`))
      const nextStep = allSteps.find(k => !done.has(k))
      if (nextStep) {
        const [mi, si] = nextStep.split('-').map(Number)
        setMod(mi); setStep(si)
      }
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { loadDash() }, [loadDash])

  const phase = MODULES[mod]?.steps[step]?.ph ?? 'c'

  function goLearn() { setView('learn') }
  function goRP() {
    const m = MODULES[mod]
    const ri = m.steps.findIndex(s => s.ph === 'r')
    if (ri > -1) setStep(ri)
    setView('learn')
  }
  function pickMod(i: number) {
    if (i > mod) return
    setMod(i); setStep(0); setView('learn')
  }

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
      { l: '✅ Débrief complet', m: "Le roleplay est terminé. Débrief complet avec notes, erreurs et phrases manquées." },
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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar view={view} setView={setView} progress={progress} mod={mod}
        setMod={(m) => { setMod(m); setStep(0) }} setStep={setStep}
        memory={memory} goLearn={goLearn} goRP={goRP} />

      <main className="flex-1 flex flex-col overflow-hidden">

        {/* DASHBOARD */}
        {view === 'dash' && (
          <div className="flex-1 overflow-y-auto p-9">
            <div className="max-w-[860px]">
              <div className="mb-7">
                <h1 className="font-display font-black text-[26px]">Bonjour, <span className="text-[var(--p2)]">Closer</span> 👋</h1>
                <p className="text-sm text-[var(--mu)] mt-1.5">
                  {memory.length ? `🎯 ${memory.length} erreur(s) mémorisée(s) — fais le warmup avant de commencer` : 'Continue ta progression vers le stade Inconscient Compétent'}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-7">
                {[
                  { v: dash?.stats.totalSessions ?? 0, l: 'Sessions' },
                  { v: dash?.stats.avgScore ?? '—', l: 'Score moyen /10' },
                  { v: `M${mod + 1}`, l: 'Module actuel' },
                  { v: memory.length, l: 'Erreurs suivies' },
                ].map((s, i) => (
                  <div key={i} className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4">
                    <div className="font-display font-bold text-3xl">{String(s.v)}</div>
                    <div className="text-xs text-[var(--mu)] mt-1">{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Warmup banner */}
              {memory.length > 0 && (
                <div onClick={() => setView('warmup')}
                  className="bg-gradient-to-r from-[rgba(124,109,240,0.15)] to-[rgba(0,210,200,0.08)] border border-[rgba(124,109,240,0.25)] rounded-xl p-4 mb-6 cursor-pointer hover:border-[var(--p2)] transition-colors flex items-center justify-between">
                  <div>
                    <div className="font-display font-bold text-sm text-[var(--p2)] mb-1">🔥 Warmup du jour</div>
                    <div className="text-xs text-[var(--mu2)]">Phrases clés à retravailler · 5 minutes · Ciblé sur tes erreurs récurrentes</div>
                  </div>
                  <div className="text-[var(--p2)] text-sm">→</div>
                </div>
              )}

              {/* Skill radar + memory */}
              <div className="grid grid-cols-2 gap-4 mb-7">
                {dash?.skills && dash.skills.length > 0
                  ? <SkillRadar skills={dash.skills} />
                  : <div className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4 flex items-center justify-center text-xs text-[var(--mu)]">Fais des sessions pour voir ton radar</div>
                }
                {memory.length > 0 && (
                  <div className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4">
                    <div className="text-xs font-semibold text-[var(--mu2)] mb-3">🧠 Erreurs mémorisées</div>
                    {memory.slice(0, 4).map((e, i) => (
                      <div key={i} className="flex items-start gap-2 py-1.5 border-b border-[var(--b1)] last:border-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--rd)] mt-1.5 flex-shrink-0" />
                        <div><div className="text-xs">{e.error_desc}</div><div className="text-[10.5px] text-[var(--mu)]">{e.count}x</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-sm font-display font-bold mb-3">Modules</div>
              <div className="grid grid-cols-2 gap-3 mb-7">
                {MODULES.map((m, i) => {
                  const lk = i > mod, dn = i < mod, cu = i === mod
                  const c = progress.filter(k => k.startsWith(`${i}-`)).length
                  return (
                    <div key={i} onClick={() => { if (!lk) { setMod(i); setStep(0); setView('learn') } }}
                      className={`bg-[var(--bg2)] border rounded-xl p-5 relative overflow-hidden transition-all
                        ${lk ? 'opacity-40 cursor-not-allowed border-[var(--b1)]' : 'cursor-pointer hover:-translate-y-0.5 border-[var(--b1)] hover:border-[var(--b2)]'}`}>
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

              <div className="text-sm font-display font-bold mb-3">Actions</div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { l: '🔥 Warmup 5 min', fn: () => setView('warmup'), primary: true },
                  { l: '📚 Continuer le cours', fn: goLearn, primary: false },
                  { l: '🎭 Roleplay', fn: goRP, primary: false },
                  { l: '📞 Call complet', fn: () => setView('fullcall'), primary: false },
                  { l: '🎙️ Analyser un call', fn: () => setView('transcript'), primary: false },
                ].map((a, i) => (
                  <button key={i} onClick={a.fn}
                    className={`${a.primary ? 'bg-[var(--p)] text-white' : 'bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)]'} px-4 py-2.5 rounded-[9px] text-sm font-semibold cursor-pointer hover:opacity-80 transition-opacity`}>
                    {a.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WARMUP */}
        {view === 'warmup' && (
          <div className="flex flex-1 min-h-0 flex-col">
            <div className="px-7 py-3 border-b border-[var(--b1)] flex items-center gap-3 bg-[var(--bg)] flex-shrink-0">
              <button onClick={() => setView('dash')} className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-1.5 rounded-[8px] text-xs hover:text-white transition-colors">← Retour</button>
              <div className="font-display font-bold text-sm flex-1">🔥 Warmup — 5 minutes de phrases clés</div>
              <SessionTimer />
            </div>
            <div className="flex-1 min-h-0">
              <ChatPanel
                chatId={`warmup-${mod}`}
                moduleId={mod} stepId={step} phase={phase}
                mode="learn"
                quickActions={[
                  { l: '🔁 Phrase suivante', m: "Passe à la phrase suivante à travailler." },
                  { l: '✅ Warmup terminé', m: "Le warmup est terminé. Donne-moi un récap rapide de mes points forts et ce à travailler en priorité aujourd'hui." },
                ]}
                onReload={loadDash}
              />
            </div>
          </div>
        )}

        {/* LEARN */}
        {view === 'learn' && (
          <div className="flex flex-1 min-h-0">
            <StepSidebar mod={mod} step={step} setStep={(s) => { setStep(s) }} progress={progress} />
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              <div className="px-7 py-3 border-b border-[var(--b1)] flex items-center gap-3 flex-shrink-0 bg-[var(--bg)]">
                <button onClick={() => setView('dash')} className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-1.5 rounded-[8px] text-xs hover:text-white transition-colors flex-shrink-0">← Retour</button>
                <div className="font-display font-bold text-sm flex-1 truncate">{MODULES[mod].steps[step]?.t}</div>
                <SessionTimer />
                <span className={`text-[9.5px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex-shrink-0
                  ${phase === 'c' ? 'bg-[rgba(165,148,249,0.1)] text-[var(--p2)]' : phase === 'd' ? 'bg-[var(--gob)] text-[var(--go)]' : 'bg-[var(--gnb)] text-[var(--gn)]'}`}>
                  {phase === 'c' ? 'Comprendre' : phase === 'd' ? 'Drilling' : 'Roleplay'}
                </span>
              </div>
              <ChatPanel chatId={chatKey} moduleId={mod} stepId={step} phase={phase} mode="learn"
                quickActions={quickActions[phase]} onReload={loadDash} />
            </div>
          </div>
        )}

        {/* FULL CALL */}
        {view === 'fullcall' && (
          <div className="flex flex-1 min-h-0">
            <div className="w-[240px] bg-[var(--bg2)] border-r border-[var(--b1)] flex flex-col p-4 overflow-y-auto flex-shrink-0">
              <div className="font-display font-bold text-sm mb-1">📞 Call Complet</div>
              <div className="text-xs text-[var(--mu)] mb-4 leading-relaxed">Simulation A→Z · Orientation → VDI² → Prix → Objections → Closing</div>
              <div className="text-[10px] text-[var(--mu)] uppercase tracking-widest mb-2">Difficulté</div>
              <div className="flex flex-col gap-2">
                {PERSONAS.map((p, i) => (
                  <div key={i} onClick={() => setFcPersona(i)}
                    className={`bg-[var(--bg3)] border rounded-lg p-3 cursor-pointer transition-all hover:border-[var(--p)] ${fcPersona === i ? 'border-[var(--p)]' : 'border-[var(--b1)]'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span>{p.e}</span><strong className="text-xs">{p.n}</strong>
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
                  {fcPersona !== null ? `Call avec ${PERSONAS[fcPersona].n} (diff ${PERSONAS[fcPersona].d}/5)` : 'Choisis un persona'}
                </div>
                <SessionTimer />
              </div>
              {fcPersona !== null
                ? <ChatPanel chatId={`fc-${fcPersona}`} moduleId={mod} stepId={step} phase="r" mode="fullcall" personaIdx={fcPersona}
                    quickActions={[
                      { l: '⏸ Feedback', m: 'STOP. Feedback immédiat.' },
                      { l: '🔁 Recommencer', m: 'Recommence le call depuis le début.' },
                      { l: '✅ Débrief par phase', m: 'Call terminé. Débrief complet avec notes par phase (Orientation/VDI²/Prix/Objections/Closing), erreurs et phrases manquées.' },
                    ]} onReload={loadDash} />
                : <div className="flex-1 flex items-center justify-center text-[var(--mu)] text-sm">← Choisis un persona</div>
              }
            </div>
          </div>
        )}

        {/* TRANSCRIPT */}
        {view === 'transcript' && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-7 py-3 border-b border-[var(--b1)] flex items-center gap-3 bg-[var(--bg)] flex-shrink-0">
              <button onClick={() => setView('dash')} className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-1.5 rounded-[8px] text-xs hover:text-white transition-colors">← Retour</button>
              <div className="font-display font-bold text-sm">🎙️ Analyse de call réel</div>
            </div>
            <div className="p-8 max-w-[760px]">
              <p className="text-sm text-[var(--mu)] mb-5 leading-relaxed">Colle le transcript de ton vrai call. MENTOR analyse chaque réplique — note /10, erreur précise, phrase exacte manquée. Les erreurs récurrentes sont mémorisées automatiquement.</p>
              <div className="mb-4">
                <label className="block text-[10px] text-[var(--mu)] uppercase tracking-wider mb-1.5">Transcript</label>
                <textarea value={trText} onChange={e => setTrText(e.target.value)}
                  placeholder={"Closer : Bonjour, je suis...\nProspect : Bonjour..."}
                  className="w-full bg-[var(--bg3)] border border-[var(--b2)] rounded-[9px] px-3 py-2.5 text-sm text-[#eeeef8] outline-none resize-y min-h-[180px] placeholder:text-[var(--mu)] focus:border-[var(--p)] transition-colors" />
              </div>
              <div className="mb-5">
                <label className="block text-[10px] text-[var(--mu)] uppercase tracking-wider mb-1.5">Contexte (optionnel)</label>
                <input value={trCtx} onChange={e => setTrCtx(e.target.value)}
                  placeholder="Ex: call de 30 min, perdu sur l'objection prix..."
                  className="w-full bg-[var(--bg3)] border border-[var(--b2)] rounded-[9px] px-3 py-2.5 text-sm text-[#eeeef8] outline-none placeholder:text-[var(--mu)] focus:border-[var(--p)] transition-colors" />
              </div>
              <button onClick={analyzeCall} disabled={trLoading || trText.length < 50}
                className="bg-[var(--gn)] text-black font-bold px-5 py-2.5 rounded-[9px] text-sm cursor-pointer hover:bg-[var(--gn2)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {trLoading ? '⏳ Analyse en cours...' : '🔍 Analyser ce call'}
              </button>
              {trResult && (
                <div className="mt-8">
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
            <button onClick={() => setView('dash')} className="text-xs text-[var(--mu)] mb-6 flex items-center gap-1 hover:text-white transition-colors">← Retour</button>
            <h1 className="font-display font-bold text-xl mb-6">⚙️ Paramètres</h1>
            <div className="border-t border-[var(--b1)] pt-5">
              <div className="font-display font-bold text-sm mb-3">Mémoire des erreurs ({memory.length})</div>
              {memory.length === 0 && <p className="text-xs text-[var(--mu)] mb-4">Aucune erreur mémorisée.</p>}
              {memory.map((e, i) => (
                <div key={i} className="flex items-start gap-2 py-2 border-b border-[var(--b1)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--rd)] mt-1.5 flex-shrink-0" />
                  <div><div className="text-xs">{e.error_desc}</div><div className="text-[10.5px] text-[var(--mu)]">{e.count}x</div></div>
                </div>
              ))}
              <div className="flex gap-2 mt-4 flex-wrap">
                <button onClick={async () => { if (!confirm('Effacer la mémoire ?')) return; await loadDash() }}
                  className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-2 rounded-lg text-xs hover:text-white transition-colors">
                  🗑️ Effacer la mémoire
                </button>
                <button onClick={() => { if (confirm('Réinitialiser toute la progression ?')) window.location.reload() }}
                  className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-2 rounded-lg text-xs hover:text-[var(--rd)] transition-colors">
                  ⚠️ Reset complet
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { MODULES, PERSONAS, type Phase } from '@/lib/curriculum'
import type { MemoryRow, ProgressRow } from '@/lib/supabase'

type View = 'dash' | 'learn' | 'roleplay' | 'fullcall' | 'transcript' | 'settings' | 'warmup' | 'reference'
type Msg = { role: 'user' | 'assistant'; content: string }

interface DashData {
  stats: { totalSessions: number; avgScore: string | null; memoryCount: number; completedSteps: number }
  memory: MemoryRow[]
  progress: ProgressRow[]
  skills: { skill_name: string; score_avg: number; sessions_count: number }[]
  warmup: { phrase: string; context: string; miss_count: number }[]
}

function sc(n: number) { return n >= 8 ? 'text-[var(--gn)]' : n >= 6 ? 'text-[var(--go)]' : 'text-[var(--rd)]' }

// ── Format mentor messages as "document" style, user messages as compact bubble
function MentorMessage({ content }: { content: string }) {
  const fmt = (t: string) => {
    t = t.replace(/SCORE:\s*(\d+)\/10/gi, (_, n) => {
      const cls = +n >= 8 ? 'text-[var(--gn)]' : +n >= 6 ? 'text-[var(--go)]' : 'text-[var(--rd)]'
      return `<div class="inline-flex items-baseline gap-1 bg-[var(--bg4)] rounded-lg px-3 py-1 my-1"><span class="font-display font-black text-3xl ${cls}">${n}</span><span class="text-xs text-[var(--mu)]">/10</span></div>`
    })
    t = t.replace(/\[ÉTAPE-VALIDÉE\]/g, '<div class="mt-3 bg-[var(--gnb)] border border-[rgba(0,210,200,0.2)] rounded-lg px-4 py-2 text-sm text-[var(--gn)] font-semibold">✅ Étape validée — on passe à la suite</div>')
    t = t.replace(/\[ERREUR-RÉCURRENTE:[^\]]+\]/g, '')
    t = t.replace(/⛔ STOP[— ]+([^\\n]+(?:\\n(?![A-Z🎯✅❌💬⚠️\\n])[^\\n]+)*)/g,
      (_, b) => `<div class="my-3 bg-[var(--rdb)] border border-[rgba(255,107,107,0.25)] rounded-xl p-4"><div class="font-bold text-[var(--rd)] mb-1">⛔ STOP</div><div class="text-sm leading-relaxed">${b.trim()}</div></div>`)
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong class="text-[#eeeef8] font-semibold">$1</strong>')
    t = t.replace(/\*([^*\\n]+)\*/g, '<em class="text-[var(--p3)] not-italic font-medium">$1</em>')
    t = t.replace(/^#{1,3} (.+)$/gm, '<h4 class="font-display font-bold text-base text-[var(--p2)] mt-5 mb-2 pb-1 border-b border-[var(--b1)]">$1</h4>')
    t = t.replace(/^> "(.+)"$/gm, '<div class="my-3 bg-[var(--bg4)] border-l-[3px] border-[var(--p)] rounded-r-xl px-4 py-3 text-sm italic text-[#eeeef8] leading-relaxed font-medium">"$1"</div>')
    t = t.replace(/^> (.+)$/gm, '<div class="my-3 bg-[var(--bg4)] border-l-[3px] border-[var(--p)] rounded-r-xl px-4 py-3 text-sm leading-relaxed">$1</div>')
    t = t.replace(/^[-•] (.+)$/gm, '<li class="ml-5 text-[var(--mu2)] mb-1.5 text-sm">$1</li>')
    t = t.replace(/(<li[^>]*>[\s\S]*?<\/li>)/g, m => `<ul class="my-2 space-y-1">${m}</ul>`)
    t = t.replace(/`([^`]+)`/g, '<code class="bg-[var(--bg4)] text-[var(--p3)] px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    t = t.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')
    return t
  }
  return (
    <div className="text-sm leading-relaxed text-[#eeeef8]"
      dangerouslySetInnerHTML={{ __html: fmt(content) }} />
  )
}

function UserMessage({ content }: { content: string }) {
  return <div className="text-sm leading-relaxed">{content}</div>
}

// ── Skill Radar ──────────────────────────────────────
function SkillRadar({ skills }: { skills: { skill_name: string; score_avg: number }[] }) {
  const skillMap: Record<string, string> = { psychologie: 'Psycho', decouverte: 'VDI²', prix: 'Prix', objections: 'Objections' }
  const keys = ['psychologie', 'decouverte', 'prix', 'objections']
  const data = keys.map(k => ({ name: skillMap[k], val: skills.find(s => s.skill_name === k)?.score_avg || 0 }))
  const cx = 75, cy = 75, r = 55
  const angle = (i: number) => (i / data.length) * 2 * Math.PI - Math.PI / 2
  const pts = data.map((_, i) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) }))
  const dpts = data.map((d, i) => ({ x: cx + r * (d.val / 10) * Math.cos(angle(i)), y: cy + r * (d.val / 10) * Math.sin(angle(i)) }))
  const grid = [0.25, 0.5, 0.75, 1].map(p => keys.map((_, i) => `${cx + r * p * Math.cos(angle(i))},${cy + r * p * Math.sin(angle(i))}`).join(' '))
  return (
    <div className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4">
      <div className="text-xs font-semibold text-[var(--mu2)] mb-3">📊 Radar de compétences</div>
      <div className="flex items-center gap-4">
        <svg width="150" height="150" viewBox="0 0 150 150">
          {grid.map((g, i) => <polygon key={i} points={g} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>)}
          {pts.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>)}
          <polygon points={dpts.map(p => `${p.x},${p.y}`).join(' ')} fill="rgba(124,109,240,0.2)" stroke="var(--p2)" strokeWidth="1.5"/>
          {dpts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--p2)"/>)}
          {pts.map((p, i) => {
            const dx = p.x - cx, dy = p.y - cy
            return <text key={i} x={p.x+(dx>0?9:dx<0?-9:0)} y={p.y+(dy>0?11:dy<0?-5:0)} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.45)">{data[i].name}</text>
          })}
        </svg>
        <div className="flex flex-col gap-2 flex-1">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--p2)]"/>
              <div className="text-xs text-[var(--mu2)] flex-1">{d.name}</div>
              <div className={`text-xs font-bold ${sc(d.val)}`}>{d.val > 0 ? d.val.toFixed(1) : '—'}</div>
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
    <div className="flex items-center gap-1.5">
      <div className={`text-xs font-mono ${active ? 'text-[var(--gn)]' : 'text-[var(--mu)]'}`}>
        {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
      </div>
      <button onClick={() => setActive(a => !a)} className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg4)] text-[var(--mu)] hover:text-white transition-colors">
        {active ? '⏸' : '▶'}
      </button>
      {secs > 0 && <button onClick={() => { setSecs(0); setActive(false) }} className="text-[9px] text-[var(--mu)] hover:text-[var(--rd)]">✕</button>}
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
        } catch(e) { console.error(e) }
        setLoading(false)
      }
      mr.start(); mediaRef.current = mr; setRecording(true)
    } catch { alert('Micro non disponible') }
  }
  return (
    <button onClick={toggle} disabled={disabled||loading}
      className={`w-11 h-11 rounded-[10px] flex items-center justify-center text-lg transition-all flex-shrink-0 border ${recording ? 'bg-[var(--rd)] border-[var(--rd)] mic-recording text-white' : 'bg-[var(--bg3)] border-[var(--b2)] text-[var(--mu2)] hover:text-white'} ${(disabled||loading)?'opacity-40 cursor-not-allowed':''}`}
      title={recording ? 'Arrêter' : 'Parler'}>
      {loading ? '⏳' : recording ? '⏹' : '🎙️'}
    </button>
  )
}

// ── Chat Panel (shared for learn, warmup, fullcall) ──
function ChatPanel({ chatId, moduleId, stepId, phase, mode, personaIdx, quickActions, onReload, placeholder }:
  { chatId: string; moduleId: number; stepId: number; phase: Phase; mode?: 'learn'|'fullcall'|'roleplay'
    personaIdx?: number; quickActions: {l:string;m:string}[]; onReload?: ()=>void; placeholder?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [resumed, setResumed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const prevChatId = useRef('')
  const abortRef = useRef<AbortController|null>(null)

  useEffect(() => {
    if (chatId === prevChatId.current) return
    prevChatId.current = chatId
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setMsgs([]); setResumed(false)
    loadOrStart()
  }, [chatId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function loadOrStart() {
    if (mode === 'fullcall' || mode === 'roleplay') { startFresh(); return }
    try {
      const r = await fetch(`/api/conversation?key=${moduleId}-${stepId}`)
      const d = await r.json()
      if (d.messages && d.messages.length > 1) { setMsgs(d.messages); setResumed(true); return }
    } catch {}
    startFresh()
  }

  function startFresh() {
    const step = MODULES[moduleId]?.steps[stepId]
    const starters: Record<Phase, string> = {
      c: `Démarre le cours sur "${step?.t}". Mécanisme psychologique profond en premier. Rappelle mes erreurs mémorisées si pertinent.`,
      d: `Lance le drill sur "${step?.t}". Rappelle mes erreurs mémorisées liées à ce drill, puis donne la phrase modèle.`,
      r: `Lance le roleplay "${step?.t}" module ${moduleId+1}. Annonce le persona adapté à mon niveau, puis démarre l'appel.`,
    }
    const rpStarter = `Lance un roleplay ciblé sur les objections. Choisis le persona adapté à mon niveau actuel (module ${moduleId+1}). Annonce-le, puis démarre directement l'appel.`
    const fcStarter = `Lance le call complet avec ${PERSONAS[personaIdx??0].n}. Présente-le brièvement, puis démarre : joue la prospect qui décroche.`
    const starter = mode === 'fullcall' ? fcStarter : mode === 'roleplay' ? rpStarter : starters[phase]
    callAPI([{ role: 'user', content: starter }])
  }

  async function callAPI(newMsgs: Msg[]) {
    setLoading(true)
    const allMsgs = [...msgs.filter(m => !(m.role==='assistant'&&m.content==='')), ...newMsgs]
    setMsgs([...allMsgs, { role: 'assistant', content: '' }])
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMsgs, moduleId, stepId, phase, mode: mode??'learn', personaIdx }),
        signal: abortRef.current?.signal,
      })
      if (!res.body) return
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let acc = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        acc += decoder.decode(value, { stream: true })
        setMsgs(prev => { const c=[...prev]; c[c.length-1]={role:'assistant',content:acc}; return c })
      }
      setMsgs(prev => { const c=[...prev]; c[c.length-1]={role:'assistant',content:acc}; return c })
      if (acc.includes('[ÉTAPE-VALIDÉE]')) onReload?.()
    } catch(e:unknown) { if((e as Error)?.name!=='AbortError') console.error(e) }
    finally { setLoading(false) }
  }

  async function send(text?: string) {
    const txt = (text??input).trim(); if (!txt||loading) return
    setInput(''); if(taRef.current) taRef.current.style.height='auto'
    setResumed(false); await callAPI([{ role:'user', content:txt }])
  }

  async function restart() {
    await fetch(`/api/conversation?key=${moduleId}-${stepId}`, { method:'DELETE' })
    setMsgs([]); setResumed(false); abortRef.current = new AbortController(); startFresh()
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages area — full width, document style for mentor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-6 py-6 flex flex-col gap-0">
          {resumed && (
            <div className="flex items-center justify-between bg-[var(--pg)] border border-[rgba(124,109,240,0.2)] rounded-xl px-4 py-3 mb-4">
              <div className="text-xs text-[var(--p2)]">↩️ Conversation reprise — tu continues là où tu t'es arrêtée</div>
              <button onClick={restart} className="text-[10px] text-[var(--mu)] hover:text-[var(--rd)] transition-colors ml-3 flex-shrink-0">Recommencer</button>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`msg-in ${m.role==='user' ? 'flex justify-end mb-4' : 'mb-6'}`}>
              {m.role === 'assistant' ? (
                <div>
                  {/* Mentor header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-[var(--p)] flex items-center justify-center text-xs">🎓</div>
                    <span className="text-[10px] text-[var(--mu)] uppercase tracking-widest font-semibold">MENTOR</span>
                  </div>
                  {/* Mentor content — document style, full width */}
                  <div className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-5 ml-8">
                    {m.content === '' ? (
                      <div className="flex gap-1 py-1">{[0,1,2].map(j=>(<span key={j} className="w-1.5 h-1.5 rounded-full bg-[var(--p2)] typing-dot" style={{animationDelay:`${j*0.2}s`}}/>))}</div>
                    ) : (
                      <MentorMessage content={m.content} />
                    )}
                  </div>
                </div>
              ) : (
                /* User message — compact bubble on the right */
                <div className="max-w-[65%] bg-[var(--bg3)] border border-[rgba(124,109,240,0.15)] rounded-2xl rounded-tr-sm px-4 py-3">
                  <UserMessage content={m.content} />
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef}/>
        </div>
      </div>
      {/* Input */}
      <div className="border-t border-[var(--b1)] bg-[var(--bg)] px-6 py-4 flex-shrink-0">
        {quickActions.length > 0 && (
          <div className="flex gap-1.5 mb-3 flex-wrap max-w-[800px] mx-auto">
            {quickActions.map((q,i)=>(
              <button key={i} onClick={()=>send(q.m)}
                className="bg-[var(--bg3)] border border-[var(--b1)] text-[var(--mu2)] px-2.5 py-1 rounded-full text-[11px] hover:text-[var(--p2)] hover:border-[var(--p2)] transition-colors whitespace-nowrap">
                {q.l}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 max-w-[800px] mx-auto">
          <textarea ref={taRef} value={input}
            onChange={e=>{setInput(e.target.value);e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,130)+'px'}}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}}
            placeholder={placeholder||'Réponds, reformule, ou pose une question...'} rows={1}
            className="flex-1 bg-[var(--bg3)] border border-[var(--b2)] rounded-[9px] px-3 py-2.5 text-sm text-[#eeeef8] outline-none resize-none min-h-[44px] max-h-[130px] placeholder:text-[var(--mu)] focus:border-[var(--p)] transition-colors"/>
          <VoiceButton onTranscript={t=>{setInput(t);setTimeout(()=>send(t),100)}} disabled={loading}/>
          <button onClick={()=>send()} disabled={loading||!input.trim()}
            className="w-11 h-11 bg-[var(--p)] rounded-[9px] flex items-center justify-center text-base text-white hover:bg-[var(--p2)] hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 flex-shrink-0">
            →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reference panel — all frameworks at a glance ──
function Reference() {
  const sections = [
    {
      title: `📐 Structure VDI²`,
      color: `var(--p)`,
      items: [
        { label: `V — Vision`, desc: `Où elle veut aller. "Dans ta tête, quand tu imagines la version de toi qui a atteint ça — elle vit comment ?"` },
        { label: `D — Douleur`, desc: `Pourquoi maintenant. 3 niveaux : Logique → Émotionnel → Identitaire` },
        { label: `I — Identité`, desc: `Qui elle veut devenir. "Est-ce que tu es prête à devenir la femme qui a ce corps ?"` },
        { label: `² — Inaction`, desc: `Le coût du statu quo. "Dans 5 ans si rien ne change..."` },
      ]
    },
    {
      title: `🛡️ Framework AVIR`,
      color: `var(--gn)`,
      items: [
        { label: `A — Accueillir`, desc: `"Ok, j'entends parfaitement. Aucun souci avec ça."` },
        { label: `V — Véhicule`, desc: `"Si on met [objection] de côté 2 secondes — est-ce que tu le ferais ?"` },
        { label: `I — Isoler`, desc: `"Quand tu me dis ça... qu'est-ce que tu veux dire exactement ?"` },
        { label: `R — Reframer`, desc: `Utiliser le bon frame selon l'objection réelle` },
      ]
    },
    {
      title: `🔥 Les 11 Frames`,
      color: `var(--go)`,
      items: [
        { label: `F1 — Risque`, desc: `"Qu'est-ce qui est le plus risqué — agir ou ne rien faire ?"` },
        { label: `F2 — Île déserte`, desc: `"On décide depuis où on est, pas depuis où on veut aller"` },
        { label: `F3 — Problème/Symptôme`, desc: `"Le vrai sujet ce n'est pas [objection], c'est [racine]"` },
        { label: `F4 — Certitude`, desc: `"Est-ce que tu connais quelqu'un qui décide avec 100% de certitude ?"` },
        { label: `F5 — Confort/Inconfort`, desc: `"Les décisions confortables te gardent là où tu es"` },
        { label: `F6 — Miroir 5 ans`, desc: `"Dans 5 ans si rien ne change..."` },
        { label: `F7 — Identité`, desc: `"Tu veux devenir quelqu'un, pas juste avoir quelque chose"` },
        { label: `F8 — Argent outil`, desc: `"L'argent n'est pas une contrainte — c'est l'outil qui va t'y amener"` },
        { label: `F9 — Zone de confort`, desc: `"Rester dans ta zone de confort a un coût invisible"` },
        { label: `F10 — Temps/Argent`, desc: `"L'argent se récupère. Le temps passé mal dans son corps, jamais."` },
        { label: `F11 — Pourquoi pas moi`, desc: `"Les autres n'ont pas de superpouvoirs — elles ont le bon mindset"` },
      ]
    },
    {
      title: `🧠 Pain Funnel (3 niveaux)`,
      color: `var(--rd)`,
      items: [
        { label: `N1 — Logique`, desc: `"C'est quoi concrètement le problème aujourd'hui ?"` },
        { label: `N2 — Émotionnel`, desc: `"Et ça t'impacte comment au quotidien ?"` },
        { label: `N3 — Identitaire`, desc: `"Et quand tu te regardes dans le miroir, ça te dit quoi sur toi ?"` },
      ]
    },
    {
      title: `👥 Personas (difficulté croissante)`,
      color: `var(--p2)`,
      items: PERSONAS.map(p => ({ label: `${p.e} ${p.n} — Niveau ${p.d}/5`, desc: `${p.desc} | Objection : ${p.obj}` }))
    }
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-[760px] mx-auto">
        <h1 className="font-display font-black text-2xl mb-2">📖 Référence rapide</h1>
        <p className="text-sm text-[var(--mu)] mb-8">Tous les frameworks et phrases clés — consultables en 2 secondes.</p>
        {sections.map((s, si) => (
          <div key={si} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-[2px] flex-1" style={{background:`linear-gradient(90deg, ${s.color}, transparent)`}}/>
              <h2 className="font-display font-bold text-sm text-[#eeeef8] whitespace-nowrap">{s.title}</h2>
              <div className="h-[2px] flex-1" style={{background:`linear-gradient(270deg, ${s.color}, transparent)`}}/>
            </div>
            <div className="grid gap-2">
              {s.items.map((item, ii) => (
                <div key={ii} className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4 flex gap-4">
                  <div className="w-1 rounded-full flex-shrink-0" style={{background:s.color}}/>
                  <div>
                    <div className="font-semibold text-sm text-[#eeeef8] mb-1">{item.label}</div>
                    <div className="text-xs text-[var(--mu2)] leading-relaxed italic">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sidebar ──────────────────────────────────────
function Sidebar({ view, setView, progress, mod, setMod, setStep, memory }:
  { view: View; setView: (v:View)=>void; progress: string[]; mod: number
    setMod:(m:number)=>void; setStep:(s:number)=>void; memory: MemoryRow[] }) {
  const total = MODULES.reduce((a,m)=>a+m.steps.length,0)
  const pct = Math.round(progress.length/total*100)
  const navItems = [
    { id:'dash', label:'Tableau de bord', icon:'⚡' },
    { id:'warmup', label:'Warmup 5 min', icon:'🔥' },
    { id:'learn', label:'Apprendre', icon:'📚' },
    { id:'roleplay', label:'Roleplay', icon:'🎭' },
    { id:'fullcall', label:'Call complet', icon:'📞' },
    { id:'transcript', label:'Analyser un call', icon:'🎙️' },
    { id:'reference', label:'Référence', icon:'📖' },
  ]
  return (
    <nav className="w-[228px] h-full bg-[var(--bg2)] border-r border-[var(--b1)] flex flex-col overflow-y-auto flex-shrink-0">
      <div className="px-4 py-5 border-b border-[var(--b1)]">
        <div className="font-display font-black text-lg tracking-tight">MENTOR<span className="text-[var(--p2)]">.</span></div>
        <div className="text-[9.5px] text-[var(--mu)] uppercase tracking-widest mt-0.5">Prof de Closing IA</div>
      </div>
      <div className="p-2 pt-3">
        <div className="text-[9.5px] text-[var(--mu)] uppercase tracking-widest px-2.5 mb-1.5">Navigation</div>
        {navItems.map(item => (
          <div key={item.id} onClick={()=>setView(item.id as View)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-all select-none ${view===item.id ? 'bg-[var(--pg)] text-[var(--p2)]' : 'text-[var(--mu)] hover:bg-[var(--bg3)] hover:text-[#eeeef8]'}`}>
            <span className="text-sm w-4 text-center">{item.icon}</span>{item.label}
          </div>
        ))}
      </div>
      <div className="p-2">
        <div className="text-[9.5px] text-[var(--mu)] uppercase tracking-widest px-2.5 mb-1.5">Modules</div>
        {MODULES.map((m,i)=>{
          const locked=i>mod, done=i<mod
          return (
            <div key={i} onClick={()=>{if(!locked){setMod(i);setStep(0);setView('learn')}}}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all select-none ${locked?'opacity-40 cursor-not-allowed text-[var(--mu)]':'cursor-pointer text-[var(--mu)] hover:bg-[var(--bg3)] hover:text-[#eeeef8]'}`}>
              <span className="text-sm w-4 text-center">{m.icon}</span>
              <span className="flex-1 truncate">{m.title.split(' ').slice(0,2).join(' ')}</span>
              {done?<span className="w-1.5 h-1.5 rounded-full bg-[var(--gn)] flex-shrink-0"/>:locked?<span className="text-[9.5px] opacity-30">🔒</span>:null}
            </div>
          )
        })}
      </div>
      {memory.length > 0 && (
        <div className="mx-2 mt-2 bg-[var(--pg)] border border-[rgba(124,109,240,0.2)] rounded-lg p-3 cursor-pointer hover:bg-[rgba(124,109,240,0.2)] transition-colors" onClick={()=>setView('warmup')}>
          <div className="text-[11px] font-semibold text-[var(--p2)] mb-1">🔥 Warmup disponible</div>
          <div className="text-[10.5px] text-[var(--mu2)] leading-snug">{memory[0].error_desc.slice(0,38)}…</div>
        </div>
      )}
      <div className="p-2.5 mt-auto">
        <div className="flex justify-between text-[10px] text-[var(--mu)] mb-1.5"><span>Progression</span><span>{pct}%</span></div>
        <div className="h-[2px] bg-[var(--bg4)] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[var(--p)] to-[var(--p2)] rounded-full transition-all duration-500" style={{width:`${pct}%`}}/>
        </div>
      </div>
      <div className="p-2 border-t border-[var(--b1)]">
        <div onClick={()=>setView('settings')} className="flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer text-xs text-[var(--mu)] hover:bg-[var(--bg3)] hover:text-[#eeeef8] transition-all">
          <span className="text-sm w-4 text-center">⚙️</span>Paramètres
        </div>
      </div>
    </nav>
  )
}

// ── Step sidebar for learn view ──────────────────
function StepSidebar({ mod, step, setStep, progress }:
  { mod:number; step:number; setStep:(s:number)=>void; progress:string[] }) {
  const m = MODULES[mod]
  const pct = Math.round(step/m.steps.length*100)
  const phCls: Record<Phase,string> = { c:'text-[var(--p2)] bg-[rgba(165,148,249,0.1)]', d:'text-[var(--go)] bg-[var(--gob)]', r:'text-[var(--gn)] bg-[var(--gnb)]' }
  return (
    <div className="w-[240px] bg-[var(--bg2)] border-r border-[var(--b1)] flex flex-col overflow-hidden flex-shrink-0">
      <div className="p-4 border-b border-[var(--b1)]">
        <div className="font-display font-bold text-[13px]">Module {mod+1}</div>
        <div className="text-[11px] text-[var(--mu)] mt-0.5">{m.title}</div>
        <div className="h-[2px] bg-[var(--bg4)] rounded-full mt-3"><div className="h-full bg-gradient-to-r from-[var(--p)] to-[var(--p2)] rounded-full" style={{width:`${pct}%`}}/></div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {m.steps.map((s,i)=>{
          const key=`${mod}-${i}`, dn=progress.includes(key), active=i===step
          return (
            <div key={i} onClick={()=>setStep(i)}
              className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer mb-1 transition-all ${active?'bg-[var(--pg)]':'hover:bg-[var(--bg3)]'}`}>
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[7.5px] mt-0.5 flex-shrink-0 border-[1.5px] transition-all ${dn?'bg-[var(--gn)] border-[var(--gn)] text-black':active?'bg-[var(--p)] border-[var(--p)] text-white':'bg-[var(--bg4)] border-[var(--b2)] text-[var(--mu)]'}`}>
                {dn?'✓':i+1}
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
  const [dash, setDash] = useState<DashData|null>(null)
  const [progress, setProgress] = useState<string[]>([])
  const [memory, setMemory] = useState<MemoryRow[]>([])
  const [fcPersona, setFcPersona] = useState<number|null>(null)
  const [trText, setTrText] = useState('')
  const [trCtx, setTrCtx] = useState('')
  const [trResult, setTrResult] = useState<any>(null)
  const [trLoading, setTrLoading] = useState(false)

  const phase = MODULES[mod]?.steps[step]?.ph ?? 'c'

  const loadDash = useCallback(async () => {
    try {
      const r = await fetch('/api/dashboard')
      const d = await r.json()
      setDash(d); setMemory(d.memory||[])
      const done = new Set((d.progress as ProgressRow[]).filter(p=>p.completed_at).map((p:ProgressRow)=>p.step_key))
      setProgress(Array.from(done) as string[])
      // Navigate to first incomplete step
      const allSteps = MODULES.flatMap((m,mi)=>m.steps.map((_,si)=>`${mi}-${si}`))
      const next = allSteps.find(k=>!done.has(k))
      if (next) { const [mi,si]=next.split('-').map(Number); setMod(mi); setStep(si) }
    } catch(e) { console.error(e) }
  }, [])

  useEffect(() => { loadDash() }, [loadDash])

  const quickActions: Record<Phase,{l:string;m:string}[]> = {
    c: [
      { l:'🔄 Autre explication', m:'Réexplique avec un angle différent ou une métaphore.' },
      { l:'💡 Exemple concret', m:'Donne un autre exemple concret dans la niche.' },
      { l:'✅ Compris, passe', m:'[VALIDER-ÉTAPE] J\'ai compris ce concept en profondeur.' },
    ],
    d: [
      { l:'🔁 Recommencer', m:'Recommence le drill, donne-moi la phrase modèle.' },
      { l:'💡 Version parfaite', m:'Montre-moi la version parfaite de cette phrase.' },
    ],
    r: [
      { l:'⏸ Feedback', m:'STOP. Feedback immédiat sur ma dernière réplique.' },
      { l:'🔁 Recommencer', m:'Recommence le roleplay depuis le début.' },
      { l:'🎭 Persona plus dur', m:'Change de persona pour le niveau supérieur.' },
      { l:'✅ Débrief', m:'Roleplay terminé. Débrief complet avec notes, erreurs et phrases manquées.' },
    ],
  }

  async function analyzeCall() {
    if (!trText||trText.length<50) return
    setTrLoading(true); setTrResult(null)
    try {
      const r = await fetch('/api/analyze-call', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({transcript:trText,context:trCtx}) })
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setTrResult(d); await loadDash()
    } catch(e:unknown) { alert('Erreur : '+(e instanceof Error?e.message:'inconnue')) }
    setTrLoading(false)
  }

  // Topbar helper
  function Topbar({ title, badge, badgeCls }: { title: string; badge?: string; badgeCls?: string }) {
    return (
      <div className="px-7 py-3 border-b border-[var(--b1)] flex items-center gap-3 bg-[var(--bg)] flex-shrink-0 min-h-[50px]">
        <button onClick={()=>setView('dash')} className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-1.5 rounded-[8px] text-xs hover:text-white transition-colors flex-shrink-0">← Retour</button>
        <div className="font-display font-bold text-sm flex-1 truncate">{title}</div>
        <SessionTimer/>
        {badge && <span className={`text-[9.5px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex-shrink-0 ${badgeCls}`}>{badge}</span>}
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar view={view} setView={setView} progress={progress} mod={mod}
        setMod={m=>{setMod(m);setStep(0)}} setStep={setStep} memory={memory}/>

      <main className="flex-1 flex flex-col overflow-hidden">

        {/* DASHBOARD */}
        {view==='dash' && (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-[860px]">
              <div className="mb-7">
                <h1 className="font-display font-black text-[26px]">Bonjour, <span className="text-[var(--p2)]">Closer</span> 👋</h1>
                <p className="text-sm text-[var(--mu)] mt-1.5">{memory.length ? `🎯 ${memory.length} erreur(s) mémorisée(s) — fais le warmup avant de commencer` : 'Continue ta progression vers le stade Inconscient Compétent'}</p>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-7">
                {[{v:dash?.stats.totalSessions??0,l:'Sessions'},{v:dash?.stats.avgScore??'—',l:'Score moyen /10'},{v:`M${mod+1}`,l:'Module actuel'},{v:memory.length,l:'Erreurs suivies'}].map((s,i)=>(
                  <div key={i} className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4">
                    <div className="font-display font-bold text-3xl">{String(s.v)}</div>
                    <div className="text-xs text-[var(--mu)] mt-1">{s.l}</div>
                  </div>
                ))}
              </div>
              {memory.length>0 && (
                <div onClick={()=>setView('warmup')} className="bg-gradient-to-r from-[rgba(124,109,240,0.15)] to-[rgba(0,210,200,0.08)] border border-[rgba(124,109,240,0.25)] rounded-xl p-4 mb-6 cursor-pointer hover:border-[var(--p2)] transition-colors flex items-center justify-between">
                  <div><div className="font-display font-bold text-sm text-[var(--p2)] mb-1">🔥 Warmup du jour</div><div className="text-xs text-[var(--mu2)]">Phrases clés à retravailler · 5 minutes · Ciblé sur tes erreurs</div></div>
                  <div className="text-[var(--p2)] text-sm flex-shrink-0">→</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 mb-7">
                {dash?.skills&&dash.skills.length>0 ? <SkillRadar skills={dash.skills}/> : <div className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4 flex items-center justify-center text-xs text-[var(--mu)]">Fais des sessions pour voir ton radar</div>}
                {memory.length>0 && (
                  <div className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4">
                    <div className="text-xs font-semibold text-[var(--mu2)] mb-3">🧠 Erreurs mémorisées</div>
                    {memory.slice(0,4).map((e,i)=>(
                      <div key={i} className="flex items-start gap-2 py-1.5 border-b border-[var(--b1)] last:border-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--rd)] mt-1.5 flex-shrink-0"/>
                        <div><div className="text-xs">{e.error_desc}</div><div className="text-[10.5px] text-[var(--mu)]">{e.count}x</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-sm font-display font-bold mb-3">Modules</div>
              <div className="grid grid-cols-2 gap-3 mb-7">
                {MODULES.map((m,i)=>{
                  const lk=i>mod,dn=i<mod,cu=i===mod,c=progress.filter(k=>k.startsWith(`${i}-`)).length
                  return (
                    <div key={i} onClick={()=>{if(!lk){setMod(i);setStep(0);setView('learn')}}}
                      className={`bg-[var(--bg2)] border rounded-xl p-5 relative overflow-hidden transition-all ${lk?'opacity-40 cursor-not-allowed border-[var(--b1)]':'cursor-pointer hover:-translate-y-0.5 border-[var(--b1)] hover:border-[var(--b2)]'}`}>
                      <div className={`absolute top-0 left-0 right-0 h-0.5 ${dn?'bg-[var(--gn)]':cu?'bg-[var(--p)]':'bg-[var(--b1)]'}`}/>
                      <div className="text-[10px] text-[var(--mu)] uppercase tracking-widest mb-1">Module {i+1}</div>
                      <div className="font-display font-bold text-[14.5px] mb-1">{m.icon} {m.title}</div>
                      <div className="text-xs text-[var(--mu)] leading-relaxed mb-3">{m.desc}</div>
                      <div className="h-[2px] bg-[var(--bg4)] rounded-full mb-3"><div className="h-full bg-gradient-to-r from-[var(--p)] to-[var(--p2)] rounded-full" style={{width:`${Math.round(c/m.steps.length*100)}%`}}/></div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10.5px] text-[var(--mu)]">{c}/{m.steps.length}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${dn?'bg-[var(--gnb)] text-[var(--gn)]':cu?'bg-[var(--pg)] text-[var(--p2)]':'bg-[var(--bg4)] text-[var(--mu)]'}`}>{dn?'✓ Terminé':cu?'En cours':'🔒'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="text-sm font-display font-bold mb-3">Actions rapides</div>
              <div className="flex gap-2 flex-wrap">
                {[{l:'🔥 Warmup',fn:()=>setView('warmup'),p:true},{l:'📚 Apprendre',fn:()=>setView('learn'),p:false},{l:'🎭 Roleplay',fn:()=>setView('roleplay'),p:false},{l:'📞 Call complet',fn:()=>setView('fullcall'),p:false},{l:'🎙️ Analyser un call',fn:()=>setView('transcript'),p:false},{l:'📖 Référence',fn:()=>setView('reference'),p:false}].map((a,i)=>(
                  <button key={i} onClick={a.fn} className={`${a.p?'bg-[var(--p)] text-white':'bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)]'} px-4 py-2.5 rounded-[9px] text-sm font-semibold hover:opacity-80 transition-opacity`}>{a.l}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* WARMUP */}
        {view==='warmup' && (
          <div className="flex flex-col flex-1 min-h-0">
            <Topbar title="🔥 Warmup — 5 minutes de phrases clés" badge="WARMUP" badgeCls="bg-[var(--gob)] text-[var(--go)]"/>
            <ChatPanel chatId={`warmup-${mod}`} moduleId={mod} stepId={step} phase={phase} mode="learn"
              placeholder="Réponds à la phrase, reformule..."
              quickActions={[{l:'➡️ Phrase suivante',m:'Passe à la phrase suivante à travailler.'},{l:'✅ Terminer le warmup',m:'Warmup terminé. Récap rapide : points forts et priorité du jour.'}]}
              onReload={loadDash}/>
          </div>
        )}

        {/* LEARN */}
        {view==='learn' && (
          <div className="flex flex-1 min-h-0">
            <StepSidebar mod={mod} step={step} setStep={setStep} progress={progress}/>
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              <Topbar title={MODULES[mod].steps[step]?.t||''} badge={phase==='c'?'Comprendre':phase==='d'?'Drilling':'Roleplay'} badgeCls={phase==='c'?'bg-[rgba(165,148,249,0.1)] text-[var(--p2)]':phase==='d'?'bg-[var(--gob)] text-[var(--go)]':'bg-[var(--gnb)] text-[var(--gn)]'}/>
              <ChatPanel chatId={`learn-${mod}-${step}`} moduleId={mod} stepId={step} phase={phase} mode="learn" quickActions={quickActions[phase]} onReload={loadDash}/>
            </div>
          </div>
        )}

        {/* ROLEPLAY — dedicated space, no learn sidebar */}
        {view==='roleplay' && (
          <div className="flex flex-1 min-h-0">
            {/* Persona picker */}
            <div className="w-[220px] bg-[var(--bg2)] border-r border-[var(--b1)] flex flex-col p-4 overflow-y-auto flex-shrink-0">
              <div className="font-display font-bold text-sm mb-1">🎭 Roleplay</div>
              <div className="text-xs text-[var(--mu)] mb-4 leading-relaxed">Mode combat — face à face avec la prospect. Pas de cours, juste toi.</div>
              <div className="text-[10px] text-[var(--mu)] uppercase tracking-widest mb-2">Choisir la difficulté</div>
              <div className="flex flex-col gap-2">
                {PERSONAS.map((p,i)=>(
                  <div key={i} onClick={()=>{setStep(i); setView('roleplay')}}
                    className="bg-[var(--bg3)] border border-[var(--b1)] rounded-lg p-3 cursor-pointer hover:border-[var(--p)] transition-all">
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
              <Topbar title="🎭 Roleplay — Mode combat" badge="EN COURS" badgeCls="bg-[var(--gnb)] text-[var(--gn)]"/>
              <ChatPanel chatId={`rp-${mod}-${step}`} moduleId={mod} stepId={step} phase="r" mode="roleplay"
                personaIdx={step < PERSONAS.length ? step : 0}
                placeholder="Ta réplique..."
                quickActions={[{l:'⏸ Feedback',m:'STOP. Feedback immédiat sur ma dernière réplique.'},{l:'🔁 Recommencer',m:'Recommence le roleplay depuis le début.'},{l:'✅ Débrief',m:'Roleplay terminé. Débrief complet avec notes, erreurs et phrases manquées.'}]}
                onReload={loadDash}/>
            </div>
          </div>
        )}

        {/* FULL CALL */}
        {view==='fullcall' && (
          <div className="flex flex-1 min-h-0">
            <div className="w-[220px] bg-[var(--bg2)] border-r border-[var(--b1)] flex flex-col p-4 overflow-y-auto flex-shrink-0">
              <div className="font-display font-bold text-sm mb-1">📞 Call Complet</div>
              <div className="text-xs text-[var(--mu)] mb-4 leading-relaxed">Simulation A→Z — Orientation → VDI² → Prix → Objections → Closing</div>
              <div className="text-[10px] text-[var(--mu)] uppercase tracking-widest mb-2">Difficulté</div>
              <div className="flex flex-col gap-2">
                {PERSONAS.map((p,i)=>(
                  <div key={i} onClick={()=>setFcPersona(i)}
                    className={`bg-[var(--bg3)] border rounded-lg p-3 cursor-pointer transition-all hover:border-[var(--p)] ${fcPersona===i?'border-[var(--p)]':'border-[var(--b1)]'}`}>
                    <div className="flex items-center gap-2 mb-1"><span>{p.e}</span><strong className="text-xs">{p.n}</strong><span className="ml-auto text-[10px] text-[var(--mu)]">{p.d}/5</span></div>
                    <div className="text-[11px] text-[var(--mu)] leading-snug">{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              <Topbar title={fcPersona!==null?`Call avec ${PERSONAS[fcPersona].n} (diff ${PERSONAS[fcPersona].d}/5)`:`Choisis un persona`} badge={fcPersona!==null?'EN COURS':undefined} badgeCls="bg-[var(--rdb)] text-[var(--rd)]"/>
              {fcPersona!==null
                ? <ChatPanel chatId={`fc-${fcPersona}`} moduleId={mod} stepId={step} phase="r" mode="fullcall" personaIdx={fcPersona}
                    placeholder="Ta réplique..."
                    quickActions={[{l:'⏸ Feedback',m:'STOP. Feedback immédiat.'},{l:'🔁 Recommencer',m:'Recommence le call depuis le début.'},{l:'✅ Débrief par phase',m:'Call terminé. Débrief complet avec notes par phase (Orientation/VDI²/Prix/Objections/Closing), erreurs et phrases manquées.'}]}
                    onReload={loadDash}/>
                : <div className="flex-1 flex items-center justify-center text-[var(--mu)] text-sm">← Choisis un persona pour commencer</div>
              }
            </div>
          </div>
        )}

        {/* TRANSCRIPT */}
        {view==='transcript' && (
          <div className="flex-1 overflow-y-auto">
            <div className="px-7 py-3 border-b border-[var(--b1)] flex items-center gap-3 bg-[var(--bg)]">
              <button onClick={()=>setView('dash')} className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-1.5 rounded-[8px] text-xs hover:text-white transition-colors">← Retour</button>
              <div className="font-display font-bold text-sm">🎙️ Analyse de call réel</div>
            </div>
            <div className="p-8 max-w-[760px]">
              <p className="text-sm text-[var(--mu)] mb-5 leading-relaxed">Colle le transcript de ton vrai call. MENTOR analyse chaque réplique — note /10, erreur précise, phrase exacte manquée.</p>
              <div className="mb-4">
                <label className="block text-[10px] text-[var(--mu)] uppercase tracking-wider mb-1.5">Transcript</label>
                <textarea value={trText} onChange={e=>setTrText(e.target.value)} placeholder={"Closer : Bonjour...\nProspect : Bonjour..."} className="w-full bg-[var(--bg3)] border border-[var(--b2)] rounded-[9px] px-3 py-2.5 text-sm text-[#eeeef8] outline-none resize-y min-h-[180px] placeholder:text-[var(--mu)] focus:border-[var(--p)] transition-colors"/>
              </div>
              <div className="mb-5">
                <label className="block text-[10px] text-[var(--mu)] uppercase tracking-wider mb-1.5">Contexte (optionnel)</label>
                <input value={trCtx} onChange={e=>setTrCtx(e.target.value)} placeholder="Ex: call de 30 min, perdu sur l'objection prix..." className="w-full bg-[var(--bg3)] border border-[var(--b2)] rounded-[9px] px-3 py-2.5 text-sm text-[#eeeef8] outline-none placeholder:text-[var(--mu)] focus:border-[var(--p)] transition-colors"/>
              </div>
              <button onClick={analyzeCall} disabled={trLoading||trText.length<50} className="bg-[var(--gn)] text-black font-bold px-5 py-2.5 rounded-[9px] text-sm hover:bg-[var(--gn2)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {trLoading?'⏳ Analyse en cours...':'🔍 Analyser ce call'}
              </button>
              {trResult && (
                <div className="mt-8">
                  <div className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-5 mb-5">
                    <div className="flex items-baseline gap-3 mb-3"><span className={`font-display font-black text-4xl ${sc(trResult.global.score)}`}>{trResult.global.score}</span><span className="text-sm text-[var(--mu)]">/10 — Score global</span></div>
                    <p className="text-sm text-[var(--mu2)] leading-relaxed mb-3">{trResult.global.summary}</p>
                    {trResult.global.errors.map((e:string,i:number)=>(
                      <div key={i} className="flex items-start gap-2 py-2 border-t border-[var(--b1)]"><div className="w-1.5 h-1.5 rounded-full bg-[var(--rd)] mt-1.5 flex-shrink-0"/><div className="text-xs">{e}</div></div>
                    ))}
                    {trResult.global.plan&&<div className="mt-3 bg-[var(--gob)] rounded-lg px-3 py-2 text-xs text-[var(--go)]"><strong>Plan :</strong> {trResult.global.plan}</div>}
                    {trResult.global.drillLink&&(
                      <button onClick={()=>{const[mi,si]=trResult.global.drillLink.split('-').map(Number);setMod(mi);setStep(si);setView('learn')}} className="mt-3 bg-[var(--p)] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[var(--p2)] transition-colors">🎯 S'entraîner sur cette erreur →</button>
                    )}
                  </div>
                  <div className="font-display font-bold text-sm mb-3">Ligne par ligne</div>
                  {trResult.lines.filter((l:any)=>l.who==='closer'&&l.text).map((l:any,i:number)=>(
                    <div key={i} className="bg-[var(--bg2)] border border-[var(--b1)] rounded-xl p-4 mb-3">
                      <div className="text-xs text-[var(--mu2)] italic border-l-2 border-[var(--b2)] pl-3 mb-3 leading-relaxed">{l.text}</div>
                      <div className="flex items-baseline gap-2 mb-2"><span className={`font-display font-black text-xl ${sc(l.score)}`}>{l.score}</span><span className="text-xs text-[var(--mu)]">/10</span></div>
                      <div className="text-xs leading-relaxed">{l.ok&&<div className="text-[var(--gn)] mb-1">✓ {l.ok}</div>}{l.bad&&<div className="text-[var(--rd)]">✗ {l.bad}</div>}</div>
                      {l.better&&l.score<8&&<div className="mt-2 bg-[var(--pg)] rounded-lg px-3 py-2 text-xs text-[var(--p3)] italic">💬 "{l.better}"</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* REFERENCE */}
        {view==='reference' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-7 py-3 border-b border-[var(--b1)] flex items-center gap-3 bg-[var(--bg)] flex-shrink-0">
              <button onClick={()=>setView('dash')} className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-1.5 rounded-[8px] text-xs hover:text-white transition-colors">← Retour</button>
              <div className="font-display font-bold text-sm flex-1">📖 Référence rapide</div>
            </div>
            <Reference/>
          </div>
        )}

        {/* SETTINGS */}
        {view==='settings' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-[440px]">
            <button onClick={()=>setView('dash')} className="text-xs text-[var(--mu)] mb-6 flex items-center gap-1 hover:text-white transition-colors">← Retour</button>
            <h1 className="font-display font-bold text-xl mb-6">⚙️ Paramètres</h1>
            <div className="border-t border-[var(--b1)] pt-5">
              <div className="font-display font-bold text-sm mb-3">Mémoire des erreurs ({memory.length})</div>
              {memory.length===0&&<p className="text-xs text-[var(--mu)] mb-4">Aucune erreur mémorisée.</p>}
              {memory.map((e,i)=>(
                <div key={i} className="flex items-start gap-2 py-2 border-b border-[var(--b1)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--rd)] mt-1.5 flex-shrink-0"/>
                  <div><div className="text-xs">{e.error_desc}</div><div className="text-[10.5px] text-[var(--mu)]">{e.count}x</div></div>
                </div>
              ))}
              <div className="flex gap-2 mt-4 flex-wrap">
                <button onClick={async()=>{if(!confirm('Effacer la mémoire ?'))return;await loadDash()}} className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-2 rounded-lg text-xs hover:text-white transition-colors">🗑️ Effacer la mémoire</button>
                <button onClick={()=>{if(confirm('Réinitialiser toute la progression ?'))window.location.reload()}} className="bg-[var(--bg3)] border border-[var(--b2)] text-[var(--mu2)] px-3 py-2 rounded-lg text-xs hover:text-[var(--rd)] transition-colors">⚠️ Reset complet</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

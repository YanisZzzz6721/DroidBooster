"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { getHistory, getHistoryDetail, deleteHistory } from "@/lib/api"
import ScoreBar from "@/components/ScoreBar"
import PushButton from "@/components/PushButton"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Candidature {
  id:             number
  created_at:     string
  cv_nom:         string
  poste:          string | null
  entreprise:     string | null
  adresse:        string | null
  match_score:    number | null
  ats_score:      number | null
  lettre_docx:    string | null
  cv_optimise_md: string | null
}

interface CandidatureDetail extends Candidature {
  offre_texte:  string
  lettre_md:    string | null
  preferences:  string | null
}

interface CompanyGroup {
  entreprise: string
  adresse:    string | null
  poste:      string | null
  items:      Candidature[]
  latest:     string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number | null) {
  if (!s) return "#888"
  if (s >= 70) return "var(--turquoise)"
  if (s >= 50) return "var(--orange)"
  return "#c0392b"
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function formatShort(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  })
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch { return false }
}

function groupByCompany(list: Candidature[]): CompanyGroup[] {
  const map = new Map<string, CompanyGroup>()
  for (const c of list) {
    const key = c.entreprise?.toLowerCase().trim() || `__${c.cv_nom}`
    if (!map.has(key)) {
      map.set(key, {
        entreprise: c.entreprise || c.cv_nom,
        adresse:    c.adresse,
        poste:      c.poste,
        items:      [],
        latest:     c.created_at,
      })
    }
    const group = map.get(key)!
    group.items.push(c)
    if (c.created_at > group.latest) {
      group.latest     = c.created_at
      group.adresse    = c.adresse
      group.poste      = c.poste
    }
  }
  return Array.from(map.values()).sort((a, b) => b.latest.localeCompare(a.latest))
}

// ─── Hook scroll animation ─────────────────────────────────────────────────────

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.08 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return { ref, visible }
}

// ─── Composant Gauge ──────────────────────────────────────────────────────────

function Gauge({ score, label }: { score: number; label: string }) {
  const color = scoreColor(score)
  const r = 36, circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={96} height={96} viewBox="0 0 96 96">
        <circle cx={48} cy={48} r={r} fill="none" stroke="#e2e2df" strokeWidth={7} />
        <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="butt" transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
        <text x={48} y={53} textAnchor="middle" fontSize={20} fontWeight={700}
          fill={color} fontFamily="Space Grotesk, sans-serif">{score}</text>
      </svg>
      <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.5)" }}>{label}</span>
    </div>
  )
}

// ─── Bouton copier ─────────────────────────────────────────────────────────────

function CopyBtn({ text, label = "Copier" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function handle() {
    const ok = await copyToClipboard(text)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }
  return (
    <button onClick={handle} style={{
      background: copied ? "var(--turquoise)" : "var(--white)",
      border: `2px solid ${copied ? "var(--turquoise)" : "var(--black)"}`,
      boxShadow: copied ? "none" : "2px 2px 0 var(--black)",
      color: copied ? "#fff" : "var(--black)",
      padding: "4px 12px", fontSize: 11, cursor: "pointer",
      fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
      transition: "all 0.15s",
    }}>
      {copied ? "Copie !" : label}
    </button>
  )
}

// ─── Carte animée ──────────────────────────────────────────────────────────────

function AnimatedCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useScrollReveal()
  return (
    <div ref={ref} style={{
      opacity:   visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(20px)",
      transition: `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

// ─── Carte entreprise ──────────────────────────────────────────────────────────

function CompanyCard({ group, onOpen, onRemove, onRegenerate }: {
  group:        CompanyGroup
  onOpen:       (id: number) => void
  onRemove:     (id: number, e: React.MouseEvent) => void
  onRegenerate: (c: Candidature) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasLettre = group.items.some(c => c.lettre_docx)
  const hasCV     = group.items.some(c => c.cv_optimise_md)
  const bestATS   = Math.max(...group.items.map(c => c.ats_score ?? 0))
  const bestMatch = Math.max(...group.items.map(c => c.match_score ?? 0))

  return (
    <div style={{
      border:     "2px solid var(--black)",
      boxShadow:  "4px 4px 0 var(--black)",
      background: "var(--white)",
      overflow:   "hidden",
      transition: "box-shadow 0.1s, transform 0.1s",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "6px 6px 0 var(--black)"; (e.currentTarget as HTMLElement).style.transform = "translate(-1px,-1px)" }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "4px 4px 0 var(--black)"; (e.currentTarget as HTMLElement).style.transform = "translate(0,0)" }}
    >
      {/* Header entreprise */}
      <div
        onClick={() => setExpanded(p => !p)}
        style={{ padding: "20px 24px", cursor: "pointer", display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: "var(--black)" }}>{group.entreprise}</span>
            {group.poste && <span style={{ fontSize: 13, color: "var(--orange)", fontWeight: 600 }}>{group.poste}</span>}
          </div>
          {group.adresse && (
            <div style={{ fontSize: 12, color: "var(--gray-text)", fontFamily: "'IBM Plex Mono', monospace", marginBottom: 8 }}>
              {group.adresse}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: "var(--gray-text)" }}>
              {group.items.length} candidature{group.items.length > 1 ? "s" : ""}
            </span>
            {bestMatch > 0 && (
              <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, padding: "2px 8px", background: "var(--turquoise)", color: "#fff", border: "1.5px solid var(--black)" }}>
                Match {bestMatch}
              </span>
            )}
            {bestATS > 0 && (
              <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, padding: "2px 8px", background: scoreColor(bestATS), color: "#fff", border: "1.5px solid var(--black)" }}>
                ATS {bestATS}
              </span>
            )}
            {hasLettre && <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", padding: "2px 8px", border: "1.5px solid var(--black)" }}>Lettre</span>}
            {hasCV     && <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", padding: "2px 8px", border: "1.5px solid var(--black)" }}>CV</span>}
          </div>
        </div>
        <span style={{ fontSize: 20, color: "var(--gray-text)", transition: "transform 0.2s", transform: expanded ? "rotate(90deg)" : "rotate(0)" }}>›</span>
      </div>

      {/* Détail candidatures */}
      {expanded && (
        <div style={{ borderTop: "2px solid var(--black)" }}>
          {group.items.map((c, i) => (
            <div key={c.id} style={{
              padding: "16px 24px",
              borderBottom: i < group.items.length - 1 ? "1px solid var(--gray)" : "none",
              background: "#FAFAF8",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: "var(--gray-text)", marginBottom: 4 }}>
                    {formatShort(c.created_at)} · {c.cv_nom}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {c.match_score !== null && <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, padding: "2px 6px", background: "var(--turquoise)", color: "#fff" }}>M {c.match_score}</span>}
                    {c.ats_score  !== null && <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, padding: "2px 6px", background: scoreColor(c.ats_score), color: "#fff" }}>ATS {c.ats_score}</span>}
                  </div>
                </div>
                <button onClick={e => onRemove(c.id, e)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", fontSize: 14 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#c0392b")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--gray-text)")}>x</button>
              </div>

              {/* Actions par doc */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                {/* Lettre */}
                {c.lettre_docx && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px solid var(--gray)", background: "var(--white)" }}>
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "var(--orange)", flex: 1 }}>LETTRE .docx</span>
                    <button
                      onClick={() => fetch(`${API}/open-in-libreoffice/${c.lettre_docx!.split("/").pop()}`)}
                      style={{ background: "var(--white)", border: "2px solid var(--black)", boxShadow: "2px 2px 0 var(--black)", color: "var(--black)", padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}
                    >
                      ✎ LibreOffice
                    </button>
                    <button
                      onClick={() => window.open(`${API}/download-lettre/${c.lettre_docx!.split("/").pop()}?t=${Date.now()}`, "_blank")}
                      style={{ background: "var(--orange)", border: "2px solid var(--black)", boxShadow: "2px 2px 0 var(--black)", color: "#fff", padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}
                    >
                      ↓ Télécharger
                    </button>
                  </div>
                )}

                {/* CV */}
                {c.cv_optimise_md && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", border: "1px solid var(--gray)", background: "var(--white)" }}>
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: "var(--turquoise)", flex: 1 }}>CV OPTIMISE .md</span>
                    <CopyBtn text={c.cv_optimise_md} label="Copier" />
                    <button
                      onClick={() => downloadFile(c.cv_optimise_md!, `cv_${c.entreprise || "optimise"}.md`)}
                      style={{ background: "var(--turquoise)", border: "2px solid var(--black)", boxShadow: "2px 2px 0 var(--black)", color: "#fff", padding: "4px 12px", fontSize: 11, cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}
                    >
                      Telecharger
                    </button>
                  </div>
                )}

                {/* Actions globales */}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => onOpen(c.id)}
                    style={{ flex: 1, background: "var(--black)", border: "2px solid var(--black)", boxShadow: "3px 3px 0 var(--black)", color: "#fff", padding: "8px", fontSize: 12, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}
                  >
                    Voir le rapport complet
                  </button>
                  {c.cv_optimise_md && (
                    <button
                      onClick={() => onRegenerate(c)}
                      style={{ background: "var(--orange)", border: "2px solid var(--black)", boxShadow: "3px 3px 0 var(--black)", color: "#fff", padding: "8px 16px", fontSize: 12, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, whiteSpace: "nowrap" }}
                    >
                      Regenerer la lettre
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function History() {
  const [list,          setList]          = useState<Candidature[]>([])
  const [selected,      setSelected]      = useState<CandidatureDetail | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [view,          setView]          = useState<"list" | "detail">("list")
  const [tab,           setTab]           = useState<"chrono" | "enseigne">("chrono")
  const [regenerating,  setRegenerating]  = useState<number | null>(null)
  const [regenResult,   setRegenResult]   = useState<string | null>(null)

  useEffect(() => {
    getHistory()
      .then(d => setList(d.candidatures ?? d))
      .finally(() => setLoading(false))
  }, [])

  async function open(id: number) {
    setLoadingDetail(true)
    setView("detail")
    const detail = await getHistoryDetail(id)
    setSelected(detail)
    setLoadingDetail(false)
  }

  async function remove(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    await deleteHistory(id)
    setList(prev => prev.filter(c => c.id !== id))
    if (selected?.id === id) { setSelected(null); setView("list") }
  }

  function downloadLettre() {
    if (!selected?.lettre_docx) return
    const filename = selected.lettre_docx.split("/").pop()!
    window.open(`${API}/download-lettre/${filename}?t=${Date.now()}`, "_blank")
  }

  async function regenerateLetter(c: Candidature) {
    if (!c.cv_optimise_md) return
    setRegenerating(c.id)
    setRegenResult(null)
    try {
      const detail = await getHistoryDetail(c.id)
      const form   = new FormData()
      form.append("offre_texte", detail.offre_texte || "")
      form.append("cv_content",  c.cv_optimise_md)
      form.append("preferences", detail.preferences || "")
      form.append("mode",        "letter_only")
      const res  = await fetch(`${API}/run`, { method: "POST", body: form })
      const data = await res.json()
      if (data.lettre_md) setRegenResult(data.lettre_md)
    } catch {}
    finally { setRegenerating(null) }
  }

  const groups = groupByCompany(list)

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--gray-text)" }}>Chargement...</span>
    </div>
  )

  // ── VUE LISTE ──────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .history-header {
          animation: fadeInUp 0.4s ease both;
        }
      `}</style>

      {/* Header */}
      <div className="history-header" style={{ marginBottom: 28 }}>
        <span style={{ display: "inline-block", background: "var(--orange)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 10px", letterSpacing: 1, marginBottom: 8 }}>HISTORIQUE</span>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>
          Mes candidatures <span style={{ color: "var(--turquoise)" }}>({list.length})</span>
        </h1>
        <p style={{ color: "var(--gray-text)", marginTop: 6, fontSize: 14 }}>
          Clique sur une candidature pour voir le rapport complet.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24, border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)", width: "fit-content" }}>
        {[
          { key: "chrono",   label: "Chronologique" },
          { key: "enseigne", label: "Par enseigne"  },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            style={{
              padding:     "10px 24px",
              fontSize:    13,
              fontWeight:  tab === t.key ? 700 : 500,
              fontFamily:  "'Space Grotesk', sans-serif",
              background:  tab === t.key ? "var(--black)" : "var(--white)",
              color:       tab === t.key ? "#fff" : "var(--black)",
              border:      "none",
              borderRight: t.key === "chrono" ? "2px solid var(--black)" : "none",
              cursor:      "pointer",
              transition:  "all 0.1s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div style={{ padding: "80px 32px", border: "2px dashed var(--gray)", textAlign: "center", color: "var(--gray-text)" }}>
          Aucune candidature. Lance le pipeline sur la page Generer.
        </div>
      ) : tab === "chrono" ? (
        // ── ONGLET CHRONOLOGIQUE ──
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map((c, i) => (
            <AnimatedCard key={c.id} delay={i * 40}>
              <div
                onClick={() => open(c.id)}
                style={{
                  border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)",
                  background: "var(--white)", padding: "20px 24px", cursor: "pointer",
                  transition: "transform 0.1s, box-shadow 0.1s",
                  display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center",
                }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translate(-2px,-2px)"; el.style.boxShadow = "6px 6px 0 var(--black)" }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translate(0,0)"; el.style.boxShadow = "4px 4px 0 var(--black)" }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{c.entreprise || c.cv_nom}</span>
                    {c.poste && <span style={{ fontSize: 13, color: "var(--orange)", fontWeight: 600 }}>{c.poste}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                    {c.adresse && <span style={{ fontSize: 12, color: "var(--gray-text)", fontFamily: "'IBM Plex Mono', monospace" }}>{c.adresse}</span>}
                    <span style={{ fontSize: 12, color: "var(--gray-text)", fontFamily: "'IBM Plex Mono', monospace" }}>{formatShort(c.created_at)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {c.match_score !== null && <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, padding: "3px 10px", background: "var(--turquoise)", color: "#fff", border: "1.5px solid var(--black)" }}>Match {c.match_score}</span>}
                    {c.ats_score  !== null && <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, padding: "3px 10px", background: scoreColor(c.ats_score), color: "#fff", border: "1.5px solid var(--black)" }}>ATS {c.ats_score}</span>}
                    {c.lettre_docx    && <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 10px", border: "1.5px solid var(--black)" }}>Lettre DOCX</span>}
                    {c.cv_optimise_md && <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 10px", border: "1.5px solid var(--black)" }}>CV optimise</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <button onClick={e => remove(c.id, e)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", fontSize: 18 }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#c0392b")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--gray-text)")}>x</button>
                  <span style={{ fontSize: 20, color: "var(--gray-text)" }}>›</span>
                </div>
              </div>
            </AnimatedCard>
          ))}
        </div>
      ) : (
        // ── ONGLET PAR ENSEIGNE ──
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Résultat régénération */}
          {regenResult && (
            <div style={{ border: "2px solid var(--turquoise)", boxShadow: "4px 4px 0 var(--turquoise)", background: "#edfafa", padding: "20px 24px", animation: "fadeInUp 0.3s ease" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--turquoise)", fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Nouvelle lettre regeneree
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <CopyBtn text={regenResult} label="Copier la lettre" />
                  <button onClick={() => setRegenResult(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", fontSize: 16 }}>x</button>
                </div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", color: "var(--black)", fontFamily: "'Space Grotesk', sans-serif" }}>
                {regenResult}
              </div>
            </div>
          )}

          {regenerating !== null && (
            <div style={{ padding: "20px", border: "2px solid var(--black)", textAlign: "center", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: "var(--gray-text)" }}>
              Generation de la lettre en cours...
            </div>
          )}

          {groups.map((group, i) => (
            <AnimatedCard key={group.entreprise} delay={i * 60}>
              <CompanyCard
                group={group}
                onOpen={open}
                onRemove={remove}
                onRegenerate={regenerateLetter}
              />
            </AnimatedCard>
          ))}
        </div>
      )}
    </div>
  )

  // ── VUE DETAIL ────────────────────────────────────────────────────────────
  return (
    <div>
      <button
        onClick={() => { setView("list"); setSelected(null) }}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "none", border: "2px solid var(--black)", boxShadow: "3px 3px 0 var(--black)",
          cursor: "pointer", padding: "8px 16px", fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 13, fontWeight: 600, marginBottom: 28, transition: "all 0.1s",
        }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translate(-1px,-1px)"; el.style.boxShadow = "4px 4px 0 var(--black)" }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = "translate(0,0)"; el.style.boxShadow = "3px 3px 0 var(--black)" }}
      >
        &lt; Retour
      </button>

      {loadingDetail && (
        <div style={{ padding: "80px", textAlign: "center", border: "2px solid var(--black)" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--gray-text)" }}>Chargement...</span>
        </div>
      )}

      {selected && !loadingDetail && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* RECAP */}
          <AnimatedCard>
            <div style={{ background: "#0D2137", border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)" }}>
              <div style={{ padding: "28px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "var(--orange)", textTransform: "uppercase", letterSpacing: "0.15em" }}>
                      Candidature — {formatDate(selected.created_at)}
                    </span>
                    <div style={{ fontSize: 30, fontWeight: 700, color: "#fff", marginTop: 8, lineHeight: 1.2 }}>{selected.entreprise || selected.cv_nom}</div>
                    {selected.poste   && <div style={{ fontSize: 16, color: "var(--orange)", fontWeight: 600, marginTop: 6 }}>{selected.poste}</div>}
                    {selected.adresse && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 8 }}>{selected.adresse}</div>}
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 6 }}>
                      CV : {selected.cv_nom}{selected.preferences && ` · ${selected.preferences}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 28, flexShrink: 0 }}>
                    {selected.match_score !== null && <Gauge score={selected.match_score} label="Match" />}
                    {selected.ats_score   !== null && <Gauge score={selected.ats_score}   label="ATS"   />}
                  </div>
                </div>
              </div>
              {selected.offre_texte && (
                <div style={{ padding: "20px 32px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                      Ce que recherche l'employeur
                    </div>
                    <CopyBtn text={selected.offre_texte} label="Copier l'offre" />
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.8, fontFamily: "'IBM Plex Mono', monospace" }}>
                    {selected.offre_texte.slice(0, 600)}{selected.offre_texte.length > 600 && "..."}
                  </div>
                </div>
              )}
            </div>
          </AnimatedCard>

          {/* CV */}
          {selected.cv_optimise_md && (
            <AnimatedCard delay={80}>
              <div style={{ border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)" }}>
                <div style={{ padding: "12px 20px", borderBottom: "2px solid var(--black)", background: "var(--black)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>CV Optimise</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <CopyBtn text={selected.cv_optimise_md} label="Copier" />
                    <PushButton variant="primary" size="sm" onClick={() => downloadFile(selected.cv_optimise_md!, `cv_${selected.entreprise || "optimise"}.md`)}>
                      Telecharger (.md)
                    </PushButton>
                  </div>
                </div>
                <pre style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: 1.8, color: "var(--black)", whiteSpace: "pre-wrap", padding: "24px 28px", margin: 0 }}>
                  {selected.cv_optimise_md}
                </pre>
              </div>
            </AnimatedCard>
          )}

          {/* LETTRE */}
          {selected.lettre_md && (
            <AnimatedCard delay={120}>
              <div style={{ border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)" }}>
                <div style={{ padding: "12px 20px", borderBottom: "2px solid var(--black)", background: "var(--black)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>Lettre de Motivation</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <CopyBtn text={selected.lettre_md} label="Copier" />
                    {selected.lettre_docx && (
                      <PushButton variant="primary" size="sm" onClick={downloadLettre}>
                        Telecharger (.docx)
                      </PushButton>
                    )}
                  </div>
                </div>
                {selected.ats_score !== null && (
                  <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--gray)", background: "#FAFAF8", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gray-text)" }}>Score ATS</span>
                    <div style={{ flex: 1, maxWidth: 300 }}><ScoreBar score={selected.ats_score} /></div>
                    <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor(selected.ats_score) }}>{selected.ats_score}/100</span>
                  </div>
                )}
                <div style={{ padding: "28px", fontSize: 14, lineHeight: 2, color: "var(--black)", whiteSpace: "pre-wrap" }}>
                  {selected.lettre_md}
                </div>
              </div>
            </AnimatedCard>
          )}

          {/* OFFRE */}
          {selected.offre_texte && (
            <AnimatedCard delay={160}>
              <div style={{ border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)" }}>
                <div style={{ padding: "12px 20px", borderBottom: "2px solid var(--black)", background: "var(--black)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>Offre d'emploi complete</span>
                  <CopyBtn text={selected.offre_texte} label="Copier l'offre" />
                </div>
                <pre style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, lineHeight: 1.7, color: "var(--black)", whiteSpace: "pre-wrap", padding: "24px 28px", margin: 0 }}>
                  {selected.offre_texte}
                </pre>
              </div>
            </AnimatedCard>
          )}

        </div>
      )}
    </div>
  )
}
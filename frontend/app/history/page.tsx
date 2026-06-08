"use client"

import { useEffect, useState } from "react"
import { getHistory, getHistoryDetail, deleteHistory } from "@/lib/api"
import ScoreBar from "@/components/ScoreBar"
import PushButton from "@/components/PushButton"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
  offre_texte:    string
  lettre_md:      string | null
  preferences:    string | null
}

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

// ─── Jauge score ──────────────────────────────────────────────────────────────

function Gauge({ score, label }: { score: number; label: string }) {
  const color = scoreColor(score)
  const r = 36
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={96} height={96} viewBox="0 0 96 96">
        <circle cx={48} cy={48} r={r} fill="none" stroke="#e2e2df" strokeWidth={7} />
        <circle
          cx={48} cy={48} r={r} fill="none"
          stroke={color} strokeWidth={7}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="butt"
          transform="rotate(-90 48 48)"
        />
        <text x={48} y={53} textAnchor="middle" fontSize={20} fontWeight={700}
          fill={color} fontFamily="Space Grotesk, sans-serif">{score}</text>
      </svg>
      <span style={{
        fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em",
        fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.5)"
      }}>{label}</span>
    </div>
  )
}

// ─── Section bloc ─────────────────────────────────────────────────────────────

function Block({ title, tag, tagColor, children, action }: {
  title: string
  tag?: string
  tagColor?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div style={{ border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)" }}>
      <div style={{
        padding: "12px 20px",
        borderBottom: "2px solid var(--black)",
        background: "var(--black)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {title}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {tag && (
            <span style={{
              fontSize: 10, fontFamily: "'IBM Plex Mono', monospace",
              padding: "2px 8px",
              background: tagColor || "var(--turquoise)",
              color: "#fff",
            }}>{tag}</span>
          )}
          {action}
        </div>
      </div>
      <div style={{ background: "var(--white)" }}>
        {children}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function History() {
  const [list,          setList]          = useState<Candidature[]>([])
  const [selected,      setSelected]      = useState<CandidatureDetail | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [view,          setView]          = useState<"list" | "detail">("list")

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

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--gray-text)" }}>Chargement...</span>
    </div>
  )

  // ── VUE LISTE ──────────────────────────────────────────────────────────────
  if (view === "list") return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <span style={{ display: "inline-block", background: "var(--orange)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 10px", letterSpacing: 1, marginBottom: 8 }}>HISTORIQUE</span>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>
          Mes candidatures <span style={{ color: "var(--turquoise)" }}>({list.length})</span>
        </h1>
        <p style={{ color: "var(--gray-text)", marginTop: 6, fontSize: 14 }}>
          Clique sur une candidature pour voir le rapport complet.
        </p>
      </div>

      {list.length === 0 ? (
        <div style={{ padding: "80px 32px", border: "2px dashed var(--gray)", textAlign: "center", color: "var(--gray-text)" }}>
          Aucune candidature. Lance le pipeline sur la page Generer.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map(c => (
            <div
              key={c.id}
              onClick={() => open(c.id)}
              style={{
                border: "2px solid var(--black)",
                boxShadow: "4px 4px 0 var(--black)",
                background: "var(--white)",
                padding: "20px 24px",
                cursor: "pointer",
                transition: "transform 0.1s, box-shadow 0.1s",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 16,
                alignItems: "center",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = "translate(-2px,-2px)"
                el.style.boxShadow = "6px 6px 0 var(--black)"
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.transform = "translate(0,0)"
                el.style.boxShadow = "4px 4px 0 var(--black)"
              }}
            >
              <div>
                {/* Entreprise + poste */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "var(--black)" }}>
                    {c.entreprise || c.cv_nom}
                  </span>
                  {c.poste && (
                    <span style={{ fontSize: 13, color: "var(--orange)", fontWeight: 600 }}>
                      {c.poste}
                    </span>
                  )}
                </div>

                {/* Adresse + date */}
                <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                  {c.adresse && (
                    <span style={{ fontSize: 12, color: "var(--gray-text)", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {c.adresse}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "var(--gray-text)", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {formatShort(c.created_at)}
                  </span>
                </div>

                {/* Tags */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {c.match_score !== null && (
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, padding: "3px 10px", background: "var(--turquoise)", color: "#fff", border: "1.5px solid var(--black)" }}>
                      Match {c.match_score}
                    </span>
                  )}
                  {c.ats_score !== null && (
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, padding: "3px 10px", background: scoreColor(c.ats_score), color: "#fff", border: "1.5px solid var(--black)" }}>
                      ATS {c.ats_score}
                    </span>
                  )}
                  {c.lettre_docx && (
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 10px", border: "1.5px solid var(--black)", color: "var(--black)" }}>
                      Lettre DOCX
                    </span>
                  )}
                  {c.cv_optimise_md && (
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", padding: "3px 10px", border: "1.5px solid var(--black)", color: "var(--black)" }}>
                      CV optimise
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <button
                  onClick={e => remove(c.id, e)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", fontSize: 18, lineHeight: 1 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#c0392b")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--gray-text)")}
                >x</button>
                <span style={{ fontSize: 20, color: "var(--gray-text)" }}>›</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── VUE DETAIL ────────────────────────────────────────────────────────────
  return (
    <div>

      {/* Bouton retour */}
      <button
        onClick={() => { setView("list"); setSelected(null) }}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "none", border: "2px solid var(--black)",
          boxShadow: "3px 3px 0 var(--black)",
          cursor: "pointer", padding: "8px 16px",
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 13, fontWeight: 600, marginBottom: 28,
          transition: "all 0.1s",
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.transform = "translate(-1px,-1px)"
          el.style.boxShadow = "4px 4px 0 var(--black)"
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.transform = "translate(0,0)"
          el.style.boxShadow = "3px 3px 0 var(--black)"
        }}
      >
        &lt; Retour a l'historique
      </button>

      {loadingDetail && (
        <div style={{ padding: "80px", textAlign: "center", border: "2px solid var(--black)" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--gray-text)" }}>Chargement du rapport...</span>
        </div>
      )}

      {selected && !loadingDetail && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ══ RECAP OFFRE ══ */}
          <div style={{ background: "#0D2137", border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)" }}>

            {/* Header */}
            <div style={{ padding: "28px 32px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32 }}>

                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "var(--orange)", textTransform: "uppercase", letterSpacing: "0.15em" }}>
                    Candidature — {formatDate(selected.created_at)}
                  </span>
                  <div style={{ fontSize: 30, fontWeight: 700, color: "#fff", marginTop: 8, lineHeight: 1.2 }}>
                    {selected.entreprise || selected.cv_nom}
                  </div>
                  {selected.poste && (
                    <div style={{ fontSize: 16, color: "var(--orange)", fontWeight: 600, marginTop: 6 }}>
                      {selected.poste}
                    </div>
                  )}
                  {selected.adresse && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 8 }}>
                      {selected.adresse}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 6 }}>
                    CV utilise : {selected.cv_nom}
                    {selected.preferences && ` — Preferences : ${selected.preferences}`}
                  </div>
                </div>

                {/* Jauges */}
                <div style={{ display: "flex", gap: 28, flexShrink: 0 }}>
                  {selected.match_score !== null && <Gauge score={selected.match_score} label="Match" />}
                  {selected.ats_score   !== null && <Gauge score={selected.ats_score}   label="ATS"   />}
                </div>
              </div>
            </div>

            {/* Offre resumee */}
            {selected.offre_texte && (
              <div style={{ padding: "20px 32px" }}>
                <div style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                  Ce que recherche l'employeur
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.8, fontFamily: "'IBM Plex Mono', monospace" }}>
                  {selected.offre_texte.slice(0, 600)}
                  {selected.offre_texte.length > 600 && "..."}
                </div>
              </div>
            )}
          </div>

          {/* ══ CV OPTIMISE ══ */}
          {selected.cv_optimise_md && (
            <Block
              title="CV Optimise"
              tag="MARKDOWN — ATS"
              tagColor="var(--turquoise)"
              action={
                <PushButton
                  variant="primary"
                  size="sm"
                  onClick={() => downloadFile(selected.cv_optimise_md!, `cv_${selected.entreprise || "optimise"}.md`)}
                >
                  Telecharger le CV (.md)
                </PushButton>
              }
            >
              <pre style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12, lineHeight: 1.8,
                color: "var(--black)",
                whiteSpace: "pre-wrap",
                padding: "24px 28px",
                margin: 0,
              }}>
                {selected.cv_optimise_md}
              </pre>
            </Block>
          )}

          {/* ══ LETTRE ══ */}
          {selected.lettre_md && (
            <Block
              title="Lettre de Motivation"
              tag="DOCX DISPONIBLE"
              tagColor="var(--orange)"
              action={
                selected.lettre_docx ? (
                  <PushButton variant="primary" size="sm" onClick={downloadLettre}>
                    Telecharger la lettre (.docx)
                  </PushButton>
                ) : undefined
              }
            >
              {/* Barre ATS */}
              {selected.ats_score !== null && (
                <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--gray)", background: "#FAFAF8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--gray-text)" }}>
                      Score ATS de la lettre
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor(selected.ats_score) }}>
                      {selected.ats_score}/100
                    </span>
                  </div>
                  <ScoreBar score={selected.ats_score} />
                </div>
              )}

              {/* Corps lettre */}
              <div style={{ padding: "28px", fontSize: 14, lineHeight: 2, color: "var(--black)", whiteSpace: "pre-wrap" }}>
                {selected.lettre_md}
              </div>
            </Block>
          )}

          {/* ══ OFFRE COMPLETE ══ */}
          {selected.offre_texte && (
            <Block title="Offre d'emploi complete" tag="TEXTE BRUT" tagColor="#555">
              <pre style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12, lineHeight: 1.7,
                color: "var(--black)",
                whiteSpace: "pre-wrap",
                padding: "24px 28px",
                margin: 0,
              }}>
                {selected.offre_texte}
              </pre>
            </Block>
          )}

        </div>
      )}
    </div>
  )
}
"use client"

import { useEffect, useState } from "react"
import {
  getHistory,
  getHistoryDetail,
  deleteHistory,
  type Candidature,
  type CandidatureDetail,
} from "@/lib/api"
import Card from "@/components/Card"
import ScoreBar from "@/components/ScoreBar"
import KeywordBadge from "@/components/KeywordBadge"
import MarkdownView from "@/components/MarkdownView"
import PushButton from "@/components/PushButton"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (!score) return "var(--gray-400)"
  if (score >= 70) return "var(--turquoise)"
  if (score >= 50) return "var(--orange)"
  return "#c0392b"
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function downloadMd(content: string, filename = "cv_optimise.md") {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

interface TabDef { key: string; label: string; show: boolean }

// ─── Composant ────────────────────────────────────────────────────────────────

export default function History() {
  const [list,     setList]     = useState<Candidature[]>([])
  const [selected, setSelected] = useState<CandidatureDetail | null>(null)
  const [loading,  setLoading]  = useState<boolean>(true)
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)
  const [tab,      setTab]      = useState<string>("ats")

  useEffect(() => {
    getHistory().then(data => setList(data.candidatures ?? data)).finally(() => setLoading(false))
  }, [])

  const open = async (id: number): Promise<void> => {
    setLoadingDetail(true)
    const detail = await getHistoryDetail(id)
    setSelected(detail)
    setTab("ats")
    setLoadingDetail(false)
  }

  const remove = async (id: number, e: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
    e.stopPropagation()
    await deleteHistory(id)
    setList((prev: Candidature[]) => prev.filter((c: Candidature) => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const detailTabs: TabDef[] = selected ? [
    { key: "ats",    label: "Rapport ATS",  show: true                          },
    { key: "lettre", label: "Lettre",       show: !!selected.lettre_md          },
    { key: "cv",     label: "CV optimisé",  show: !!selected.cv_optimise_md     },
    { key: "offre",  label: "Offre",        show: !!selected.offre_texte        },
  ].filter((t: TabDef) => t.show) : []

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "40vh" }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--gray-400)", fontSize: "0.85rem" }}>
        Chargement...
      </span>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize:   "0.72rem",
            background: "#0D2137",
            color:      "var(--white)",
            padding:    "0.15rem 0.5rem",
            border:     "1.5px solid var(--black)",
          }}>HISTORIQUE</span>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize:   "0.72rem",
            color:      "var(--gray-400)",
          }}>
            {list.length} candidature{list.length !== 1 ? "s" : ""}
          </span>
        </div>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.3rem" }}>Historique</h1>
        <p style={{ color: "var(--gray-600)", fontSize: "0.88rem" }}>
          Clique sur une candidature pour voir le rapport ATS, la lettre et le CV optimisé.
        </p>
      </div>

      {list.length === 0 ? (
        <div style={{
          padding:    "4rem",
          border:     "2px dashed var(--gray-200)",
          textAlign:  "center",
        }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize:   "1rem",
            color:      "var(--gray-400)",
            marginBottom: "0.5rem",
          }}>
            Aucune candidature
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize:   "0.75rem",
            color:      "var(--gray-400)",
          }}>
            Lance ton premier pipeline sur la page Générer.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1.5rem", alignItems: "start" }}>

          {/* ── Colonne gauche : liste ────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {list.map((c: Candidature) => (
              <div
                key={c.id}
                onClick={() => open(c.id)}
                style={{
                  border:     selected?.id === c.id ? "2px solid var(--orange)" : "2px solid var(--black)",
                  boxShadow:  selected?.id === c.id ? "4px 4px 0px var(--orange)" : "4px 4px 0px var(--black)",
                  background: selected?.id === c.id ? "#FFF8F3" : "var(--white)",
                  padding:    "1rem",
                  cursor:     "pointer",
                  transition: "all 0.1s ease",
                }}
                onMouseEnter={e => {
                  if (selected?.id !== c.id) {
                    (e.currentTarget as HTMLElement).style.transform = "translate(-1px, -1px)"
                    ;(e.currentTarget as HTMLElement).style.boxShadow = "5px 5px 0px var(--black)"
                  }
                }}
                onMouseLeave={e => {
                  if (selected?.id !== c.id) {
                    (e.currentTarget as HTMLElement).style.transform = "translate(0, 0)"
                    ;(e.currentTarget as HTMLElement).style.boxShadow = "4px 4px 0px var(--black)"
                  }
                }}
              >
                {/* Nom CV + date */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize:   "0.85rem",
                    color:      "var(--black)",
                  }}>
                    {c.cv_nom}
                  </div>
                  <button
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => remove(c.id, e)}
                    style={{
                      fontFamily:  "'IBM Plex Mono', monospace",
                      fontSize:    "0.65rem",
                      color:       "var(--gray-400)",
                      background:  "transparent",
                      border:      "none",
                      cursor:      "pointer",
                      padding:     "0 0.2rem",
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#c0392b"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--gray-400)"}
                  >
                    ✗
                  </button>
                </div>

                {/* Scores */}
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
                  {c.match_score !== null && (
                    <span style={{
                      fontFamily:  "'IBM Plex Mono', monospace",
                      fontSize:    "0.7rem",
                      padding:     "0.15rem 0.5rem",
                      border:      "1.5px solid var(--black)",
                      background:  "var(--turquoise)",
                      color:       "var(--white)",
                      fontWeight:  600,
                    }}>
                      Match {c.match_score}
                    </span>
                  )}
                  {c.ats_score !== null && (
                    <span style={{
                      fontFamily:  "'IBM Plex Mono', monospace",
                      fontSize:    "0.7rem",
                      padding:     "0.15rem 0.5rem",
                      border:      "1.5px solid var(--black)",
                      background:  scoreColor(c.ats_score),
                      color:       "var(--white)",
                      fontWeight:  600,
                    }}>
                      ATS {c.ats_score}
                    </span>
                  )}
                </div>

                {/* Date */}
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize:   "0.65rem",
                  color:      "var(--gray-400)",
                }}>
                  {formatDate(c.created_at)}
                </div>
              </div>
            ))}
          </div>

          {/* ── Colonne droite : détail ───────────────────────────────────── */}
          <div>
            {!selected && !loadingDetail && (
              <div style={{
                border:     "2px dashed var(--gray-200)",
                padding:    "4rem 2rem",
                textAlign:  "center",
              }}>
                <div style={{
                  fontFamily:   "'Space Grotesk', sans-serif",
                  fontWeight:   700,
                  fontSize:     "1rem",
                  color:        "var(--gray-400)",
                  marginBottom: "0.5rem",
                }}>
                  ← Sélectionne une candidature
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize:   "0.72rem",
                  color:      "var(--gray-400)",
                }}>
                  Le rapport complet s'affichera ici
                </div>
              </div>
            )}

            {loadingDetail && (
              <div style={{
                border:     "2px solid var(--black)",
                padding:    "4rem 2rem",
                textAlign:  "center",
              }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--gray-400)", fontSize: "0.85rem" }}>
                  Chargement...
                </span>
              </div>
            )}

            {selected && !loadingDetail && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                {/* Header du détail */}
                <div style={{
                  display:     "flex",
                  alignItems:  "center",
                  justifyContent: "space-between",
                  padding:     "0.75rem 1rem",
                  background:  "#0D2137",
                  border:      "2px solid var(--black)",
                  boxShadow:   "4px 4px 0px var(--black)",
                }}>
                  <div>
                    <div style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize:   "0.9rem",
                      color:      "var(--white)",
                    }}>
                      {selected.cv_nom}
                    </div>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize:   "0.65rem",
                      color:      "rgba(255,255,255,0.4)",
                      marginTop:  "0.15rem",
                    }}>
                      {formatDate(selected.created_at)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {selected.match_score !== null && (
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize:   "0.72rem",
                        background: "var(--turquoise)",
                        color:      "var(--white)",
                        padding:    "0.2rem 0.6rem",
                        border:     "1.5px solid rgba(255,255,255,0.2)",
                        fontWeight: 600,
                      }}>
                        Match {selected.match_score}
                      </span>
                    )}
                    {selected.ats_score !== null && (
                      <span style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize:   "0.72rem",
                        background: scoreColor(selected.ats_score),
                        color:      "var(--white)",
                        padding:    "0.2rem 0.6rem",
                        border:     "1.5px solid rgba(255,255,255,0.2)",
                        fontWeight: 600,
                      }}>
                        ATS {selected.ats_score}
                      </span>
                    )}
                  </div>
                </div>

                {/* Onglets */}
                <div className="tab-bar">
                  {detailTabs.map((t: TabDef) => (
                    <button
                      key={t.key}
                      className={`tab ${tab === t.key ? "active" : ""}`}
                      onClick={() => setTab(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Contenu onglets */}
                <div className="animate-in">

                  {/* ATS */}
                  {tab === "ats" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

                      {selected.ats_score !== null && (
                        <Card title="Score ATS" tag={`${selected.ats_score}/100`} tagColor={selected.ats_score >= 70 ? "turquoise" : "orange"}>
                          <ScoreBar score={selected.ats_score} />
                        </Card>
                      )}

                      {selected.cv_optimise_md && (
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <PushButton variant="primary" size="sm" onClick={() => downloadMd(selected.cv_optimise_md!, `cv_optimise_${selected.cv_nom}.md`)}>
                            ↓ Télécharger le CV optimisé (.md)
                          </PushButton>
                        </div>
                      )}

                      {/* Recap offre */}
                      {selected.offre_texte && (
                        <Card title="Offre analysée" tag="TEXTE" tagColor="orange">
                          <pre style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize:   "0.75rem",
                            color:      "var(--gray-600)",
                            whiteSpace: "pre-wrap",
                            lineHeight: 1.6,
                            maxHeight:  "150px",
                            overflowY:  "auto",
                          }}>
                            {selected.offre_texte}
                          </pre>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Lettre */}
                  {tab === "lettre" && selected.lettre_md && (
                    <MarkdownView content={selected.lettre_md} label="Lettre de motivation" maxHeight="520px" />
                  )}

                  {/* CV optimisé */}
                  {tab === "cv" && selected.cv_optimise_md && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <PushButton variant="primary" size="sm" onClick={() => downloadMd(selected.cv_optimise_md!, `cv_optimise_${selected.cv_nom}.md`)}>
                          ↓ Télécharger (.md)
                        </PushButton>
                      </div>
                      <MarkdownView content={selected.cv_optimise_md} label="CV optimisé" maxHeight="520px" />
                    </div>
                  )}

                  {/* Offre complète */}
                  {tab === "offre" && (
                    <MarkdownView content={selected.offre_texte} label="Offre d'emploi" maxHeight="520px" />
                  )}

                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  )
}
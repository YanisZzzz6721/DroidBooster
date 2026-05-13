"use client"

import { useState } from "react"
import { optimizeCV, type AtsResult, type MatchResult } from "@/lib/api"
import PushButton from "@/components/PushButton"
import Card from "@/components/Card"
import ScoreBar from "@/components/ScoreBar"
import KeywordBadge from "@/components/KeywordBadge"
import MarkdownView from "@/components/MarkdownView"

const ATS_TIPS = [
  { icon: "◈", title: "Mots-clés exacts",   body: "Les ATS cherchent des termes identiques à l'offre. Un synonyme ne suffit pas — utilise les mots précis de l'annonce." },
  { icon: "◎", title: "Pas de tableaux",     body: "Les colonnes et tableaux perturbent les scanners ATS. Privilégie un format texte linéaire et structuré." },
  { icon: "⚡", title: "Score cible",        body: "Un score ATS supérieur à 70/100 augmente significativement tes chances d'être vu par un recruteur humain." },
  { icon: "✦", title: "Sections claires",   body: "Nomme tes sections explicitement : Expériences, Compétences, Formation. Les ATS reconnaissent ces titres standards." },
]

export default function Optimize() {
  const [offerText,   setOfferText]   = useState("")
  const [preferences, setPreferences] = useState("")
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [match,       setMatch]       = useState<MatchResult | null>(null)
  const [ats,         setAts]         = useState<AtsResult | null>(null)
  const [cvMd,        setCvMd]        = useState("")
  const [activeTab,   setActiveTab]   = useState("score")

  const handleSubmit = async () => {
    if (!offerText.trim()) { setError("Colle le texte de l'offre."); return }
    setError("")
    setLoading(true)
    setMatch(null); setAts(null); setCvMd("")
    try {
      const data = await optimizeCV(offerText, preferences)
      setMatch(data.match)
      setAts(data.ats)
      setCvMd(data.cv_optimise_md)
      setActiveTab("score")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize:   "0.72rem",
            background: "var(--turquoise)",
            color:      "var(--white)",
            padding:    "0.15rem 0.5rem",
            border:     "1.5px solid var(--black)",
          }}>ATS</span>
        </div>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.3rem" }}>Optimiser un CV</h1>
        <p style={{ color: "var(--gray-600)", fontSize: "0.88rem" }}>
          Analyse la compatibilité de ton CV face à une offre et génère une version optimisée.
        </p>
      </div>

      {/* ── Layout 2 colonnes ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>

        {/* ── Colonne gauche : formulaire ─────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          <Card title="Offre d'emploi" tag="ANALYSE" tagColor="turquoise">
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              <div>
                <label className="label">Texte de l'offre</label>
                <textarea
                  className="input"
                  value={offerText}
                  onChange={e => setOfferText(e.target.value)}
                  placeholder="Colle ici le texte complet de l'offre d'emploi..."
                  rows={8}
                />
              </div>

              <div>
                <label className="label">
                  Préférences{" "}
                  <span style={{ color: "var(--gray-400)", textTransform: "none", letterSpacing: 0 }}>
                    (optionnel)
                  </span>
                </label>
                <textarea
                  className="input"
                  value={preferences}
                  onChange={e => setPreferences(e.target.value)}
                  placeholder="Ex : insiste sur la rigueur, mets en avant l'anglais..."
                  rows={2}
                />
              </div>

              {error && (
                <div style={{
                  padding:    "0.75rem 1rem",
                  border:     "2px solid #c0392b",
                  background: "#fdf0f0",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize:   "0.8rem",
                  color:      "#c0392b",
                  boxShadow:  "3px 3px 0px #c0392b",
                }}>
                  ✗ {error}
                </div>
              )}

              <PushButton variant="primary" size="lg" fullWidth loading={loading} onClick={handleSubmit}>
                {!loading && "◈ Analyser le CV"}
              </PushButton>

            </div>
          </Card>

          {/* Guide ATS — visible quand pas de résultats */}
          {!ats && (
            <Card title="Comment fonctionne l'ATS ?" tag="GUIDE" tagColor="turquoise">
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {ATS_TIPS.map((tip, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{
                      fontFamily:  "'Space Grotesk', sans-serif",
                      fontSize:    "1rem",
                      color:       "var(--turquoise)",
                      flexShrink:  0,
                      marginTop:   "0.05rem",
                    }}>
                      {tip.icon}
                    </span>
                    <div>
                      <div style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 700,
                        fontSize:   "0.82rem",
                        color:      "var(--black)",
                        marginBottom: "0.2rem",
                      }}>
                        {tip.title}
                      </div>
                      <div style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize:   "0.8rem",
                        color:      "var(--gray-600)",
                        lineHeight: 1.6,
                      }}>
                        {tip.body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Score + keywords — sous le formulaire quand résultats */}
          {ats && (
            <Card title="Score ATS" tag={`${ats.score}/100`} tagColor={ats.score >= 70 ? "turquoise" : "orange"}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <ScoreBar score={ats.score} />
                <p style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize:   "0.78rem",
                  color:      "var(--gray-600)",
                  lineHeight: 1.6,
                }}>
                  {ats.summary}
                </p>
                {match && (
                  <div style={{
                    padding:    "0.75rem",
                    background: "#0D2137",
                    border:     "2px solid var(--black)",
                  }}>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize:   "0.65rem",
                      color:      "var(--turquoise)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      marginBottom: "0.3rem",
                    }}>CV sélectionné</div>
                    <div style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 700,
                      fontSize:   "0.9rem",
                      color:      "var(--white)",
                    }}>
                      {match.cv_name}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

        </div>

        {/* ── Colonne droite : résultats ou stats ─────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Pas de résultats — stats visuelles */}
          {!ats && (
            <>
              <Card title="Barème ATS" tag="INFO" tagColor="orange">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {[
                    { label: "Excellent",     min: 90, color: "var(--turquoise)" },
                    { label: "Bon match",     min: 70, color: "var(--turquoise)" },
                    { label: "Match partiel", min: 50, color: "var(--orange)"    },
                    { label: "Match faible",  min: 0,  color: "#c0392b"          },
                  ].map((row, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{
                        width:      "10px",
                        height:     "10px",
                        background: row.color,
                        border:     "1.5px solid var(--black)",
                        flexShrink: 0,
                      }} />
                      <div style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 600,
                        fontSize:   "0.82rem",
                        color:      "var(--black)",
                        flex:       1,
                      }}>
                        {row.label}
                      </div>
                      <div style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize:   "0.75rem",
                        color:      row.color,
                        fontWeight: 600,
                      }}>
                        {row.min === 90 ? "90-100" : row.min === 70 ? "70-89" : row.min === 50 ? "50-69" : "0-49"}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Checklist avant analyse" tag="TIPS" tagColor="orange">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {[
                    "Colle le texte complet de l'offre",
                    "Inclus le descriptif ET les compétences requises",
                    "Plus l'offre est détaillée, plus l'analyse est précise",
                    "Ajoute des préférences pour personnaliser le résultat",
                  ].map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                      <span style={{ color: "var(--orange)", fontSize: "0.8rem", marginTop: "0.1rem" }}>→</span>
                      <span style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize:   "0.82rem",
                        color:      "var(--gray-600)",
                        lineHeight: 1.5,
                      }}>
                        {item}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Bloc décoratif */}
              <div style={{
                padding:    "1.5rem",
                background: "#0D2137",
                border:     "2px solid var(--black)",
                boxShadow:  "4px 4px 0px var(--black)",
              }}>
                <div style={{
                  fontFamily:    "'Space Grotesk', sans-serif",
                  fontWeight:    700,
                  fontSize:      "1.4rem",
                  color:         "var(--white)",
                  lineHeight:    1.2,
                  marginBottom:  "0.75rem",
                }}>
                  70% des CV sont<br />
                  <span style={{ color: "var(--orange)" }}>rejetés par les ATS</span><br />
                  avant d'être lus.
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize:   "0.72rem",
                  color:      "rgba(255,255,255,0.4)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}>
                  Source : LinkedIn Talent Solutions
                </div>
              </div>
            </>
          )}

          {/* Résultats */}
          {ats && (
            <>
              {/* Onglets */}
              <div className="tab-bar">
                {[
                  { key: "score",   label: "Mots-clés"   },
                  { key: "suggest", label: "Suggestions"  },
                  { key: "cv",      label: "CV optimisé"  },
                ].map(t => (
                  <button
                    key={t.key}
                    className={`tab ${activeTab === t.key ? "active" : ""}`}
                    onClick={() => setActiveTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {activeTab === "score" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <Card title={`Présents (${ats.keywords_found.length})`} tagColor="turquoise">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {ats.keywords_found.map((k: string) => (
                        <KeywordBadge key={k} word={k} variant="found" />
                      ))}
                      {ats.keywords_found.length === 0 && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--gray-400)" }}>
                          Aucun mot-clé détecté
                        </span>
                      )}
                    </div>
                  </Card>
                  <Card title={`Manquants (${ats.keywords_missing.length})`} tagColor="orange">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {ats.keywords_missing.map((k: string) => (
                        <KeywordBadge key={k} word={k} variant="missing" />
                      ))}
                      {ats.keywords_missing.length === 0 && (
                        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--turquoise)" }}>
                          ✓ Tous les mots-clés sont présents
                        </span>
                      )}
                    </div>
                  </Card>
                </div>
              )}

              {activeTab === "suggest" && (
                <Card title="Suggestions d'amélioration">
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {ats.suggestions.map((s: string, i: number) => (
                      <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                        <span style={{
                          fontFamily:  "'IBM Plex Mono', monospace",
                          fontSize:    "0.72rem",
                          background:  "var(--orange)",
                          color:       "var(--white)",
                          padding:     "0.1rem 0.4rem",
                          border:      "1.5px solid var(--black)",
                          flexShrink:  0,
                          marginTop:   "0.1rem",
                        }}>
                          {i + 1}
                        </span>
                        <span style={{
                          fontFamily: "'Inter', sans-serif",
                          fontSize:   "0.84rem",
                          color:      "var(--black)",
                          lineHeight: 1.6,
                        }}>
                          {s}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {activeTab === "cv" && cvMd && (
                <MarkdownView content={cvMd} label="CV optimisé" maxHeight="520px" />
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
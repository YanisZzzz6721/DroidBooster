"use client"

import { useState } from "react"
import PushButton from "@/components/PushButton"
import Card from "@/components/Card"
import ScoreBar from "@/components/ScoreBar"
import KeywordBadge from "@/components/KeywordBadge"
import MarkdownView from "@/components/MarkdownView"

const API = process.env.NEXT_PUBLIC_API_URL

interface AtsResult {
  score:            number
  keywords_found:   string[]
  keywords_missing: string[]
  suggestions:      string[]
  summary:          string
  cv_optimise_md:   string
}

function downloadMd(content: string, filename = "cv_optimise.md") {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function Optimize() {
  const [cvText,      setCvText]      = useState("")
  const [offerText,   setOfferText]   = useState("")
  const [preferences, setPreferences] = useState("")
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [result,      setResult]      = useState<AtsResult | null>(null)
  const [activeTab,   setActiveTab]   = useState("keywords")

  const handleSubmit = async () => {
    if (!offerText.trim()) { setError("Colle le texte de l'offre."); return }
    if (!cvText.trim())    { setError("Colle le contenu de ton CV.");  return }
    setError("")
    setLoading(true)
    setResult(null)

    try {
      const form = new FormData()
      form.append("offre_texte", offerText)
      form.append("cv_content",  cvText)
      form.append("preferences", preferences)

      const res  = await fetch(`${API}/ats-custom`, { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `Erreur ${res.status}`)
      setResult(data)
      setActiveTab("keywords")
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
          Colle ton CV et l'offre d'emploi — obtiens un score ATS et une version optimisée téléchargeable.
        </p>
      </div>

      {/* ── Inputs : 2 colonnes ────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

        {/* CV */}
        <Card title="Ton CV" tag="MARKDOWN" tagColor="turquoise">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <textarea
              className="input"
              value={cvText}
              onChange={e => setCvText(e.target.value)}
              placeholder={"# Prénom NOM\n\n## Expériences\n- ...\n\n## Compétences\n- ..."}
              rows={14}
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.78rem" }}
            />
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize:   "0.65rem",
              color:      "var(--gray-400)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              Format Markdown recommandé — structure # ## ###
            </div>
          </div>
        </Card>

        {/* Offre */}
        <Card title="Offre d'emploi" tag="TEXTE" tagColor="orange">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <textarea
              className="input"
              value={offerText}
              onChange={e => setOfferText(e.target.value)}
              placeholder="Colle ici le texte complet de l'offre d'emploi (description + compétences requises)..."
              rows={11}
            />
            <div>
              <label className="label" style={{ marginBottom: "0.3rem" }}>
                Préférences{" "}
                <span style={{ color: "var(--gray-400)", textTransform: "none", letterSpacing: 0 }}>
                  (optionnel)
                </span>
              </label>
              <input
                className="input"
                type="text"
                value={preferences}
                onChange={e => setPreferences(e.target.value)}
                placeholder="Ex : insiste sur la rigueur, mets en avant l'anglais..."
              />
            </div>
          </div>
        </Card>

      </div>

      {/* ── Erreur ─────────────────────────────────────────────────────────── */}
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

      {/* ── Bouton ─────────────────────────────────────────────────────────── */}
      <PushButton variant="primary" size="lg" fullWidth loading={loading} onClick={handleSubmit}>
        {!loading && "◈ Analyser et optimiser le CV"}
      </PushButton>

      {/* ── Résultats ──────────────────────────────────────────────────────── */}
      {result && (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Score + download */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1.25rem", alignItems: "stretch" }}>

            <Card title="Score ATS" tag={`${result.score}/100`} tagColor={result.score >= 70 ? "turquoise" : "orange"}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <ScoreBar score={result.score} />
                <p style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize:   "0.78rem",
                  color:      "var(--gray-600)",
                  lineHeight: 1.6,
                }}>
                  {result.summary}
                </p>
              </div>
            </Card>

            {/* Download bloc */}
            <div style={{
              border:      "2px solid var(--black)",
              boxShadow:   "4px 4px 0px var(--black)",
              background:  "#0D2137",
              padding:     "1.5rem",
              display:     "flex",
              flexDirection: "column",
              alignItems:  "center",
              justifyContent: "center",
              gap:         "1rem",
              minWidth:    "180px",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily:    "'IBM Plex Mono', monospace",
                  fontSize:      "2rem",
                  color:         "var(--turquoise)",
                  lineHeight:    1,
                  marginBottom:  "0.4rem",
                }}>
                  .md
                </div>
                <div style={{
                  fontFamily:    "'Space Grotesk', sans-serif",
                  fontWeight:    700,
                  fontSize:      "0.8rem",
                  color:         "var(--white)",
                  marginBottom:  "0.2rem",
                }}>
                  CV optimisé
                </div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize:   "0.65rem",
                  color:      "rgba(255,255,255,0.4)",
                }}>
                  prêt à télécharger
                </div>
              </div>

              <PushButton
                variant="secondary"
                size="sm"
                onClick={() => downloadMd(result.cv_optimise_md)}
                style={{
                  background: "var(--orange)",
                  color:      "var(--white)",
                  boxShadow:  "3px 3px 0px rgba(255,255,255,0.2)",
                }}
              >
                ↓ Télécharger
              </PushButton>
            </div>

          </div>

          {/* Onglets résultats */}
          <div className="tab-bar">
            {[
              { key: "keywords", label: `Mots-clés (${result.keywords_found.length + result.keywords_missing.length})` },
              { key: "suggest",  label: `Suggestions (${result.suggestions.length})` },
              { key: "cv",       label: "CV optimisé" },
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

          {/* Mots-clés */}
          {activeTab === "keywords" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Card title={`Présents (${result.keywords_found.length})`} tagColor="turquoise">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {result.keywords_found.map((k: string) => (
                    <KeywordBadge key={k} word={k} variant="found" />
                  ))}
                  {result.keywords_found.length === 0 && (
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--gray-400)" }}>
                      Aucun mot-clé détecté
                    </span>
                  )}
                </div>
              </Card>
              <Card title={`Manquants (${result.keywords_missing.length})`} tagColor="orange">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {result.keywords_missing.map((k: string) => (
                    <KeywordBadge key={k} word={k} variant="missing" />
                  ))}
                  {result.keywords_missing.length === 0 && (
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--turquoise)" }}>
                      ✓ Tous les mots-clés sont présents
                    </span>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Suggestions */}
          {activeTab === "suggest" && (
            <Card title="Suggestions d'amélioration">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {result.suggestions.map((s: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize:   "0.72rem",
                      background: "var(--orange)",
                      color:      "var(--white)",
                      padding:    "0.1rem 0.4rem",
                      border:     "1.5px solid var(--black)",
                      flexShrink: 0,
                      marginTop:  "0.1rem",
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

          {/* CV optimisé */}
          {activeTab === "cv" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <PushButton variant="primary" size="sm" onClick={() => downloadMd(result.cv_optimise_md)}>
                  ↓ Télécharger le CV optimisé (.md)
                </PushButton>
              </div>
              <MarkdownView content={result.cv_optimise_md} label="CV optimisé" maxHeight="600px" />
            </div>
          )}

        </div>
      )}

    </div>
  )
}
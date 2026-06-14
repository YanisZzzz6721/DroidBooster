"use client"

import { useState } from "react"
import PushButton from "@/components/PushButton"
import Card from "@/components/Card"
import ScoreBar from "@/components/ScoreBar"
import KeywordBadge from "@/components/KeywordBadge"
import MarkdownView from "@/components/MarkdownView"
import { generateCv } from "@/lib/api"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface CvResult {
  cv_optimise_md:   string
  score:            number
  keywords_found:   string[]
  keywords_missing: string[]
  suggestions:      string[]
  summary:          string
  metadata:         { entreprise?: string; poste?: string; secteur?: string }
}

function downloadMd(content: string, filename = "cv_optimise.md") {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const a    = document.createElement("a")
  a.href     = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function CvPage() {
  const [offerText,   setOfferText]   = useState("")
  const [cvContent,   setCvContent]   = useState("")
  const [cvName,      setCvName]      = useState("mon_cv")
  const [preferences, setPreferences] = useState("")
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [result,      setResult]      = useState<CvResult | null>(null)
  const [activeTab,   setActiveTab]   = useState<"cv" | "keywords" | "suggest">("cv")

  const handleGenerate = async () => {
    if (!offerText.trim()) { setError("Colle le texte de l'offre."); return }
    if (!cvContent.trim()) { setError("Colle le contenu de ton CV."); return }
    setError(""); setLoading(true); setResult(null)
    try {
      const data = await generateCv(offerText, cvContent, cvName || "mon_cv", preferences)
      setResult(data)
      setActiveTab("cv")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── Header ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem",
            background: "var(--turquoise)", color: "#fff",
            padding: "0.15rem 0.5rem", border: "1.5px solid var(--border-col)",
          }}>CV</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Optimisation ATS · RAG · Export DOCX
          </span>
        </div>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.3rem", color: "var(--fg)" }}>
          Générer un CV optimisé
        </h1>
        <p style={{ color: "var(--fg-muted)", fontSize: "0.88rem" }}>
          Colle ton CV et l'offre — obtiens un CV ATS-optimisé avec score, mots-clés manquants et suggestions, exportable en DOCX.
        </p>
      </div>

      {/* ── Inputs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

        {/* CV */}
        <Card title="Ton CV" tag="MARKDOWN" tagColor="turquoise">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <input
              className="input"
              type="text"
              value={cvName}
              onChange={e => setCvName(e.target.value)}
              placeholder="Nom du CV (ex: cv_jean_dupont)"
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.78rem" }}
            />
            <textarea
              className="input"
              value={cvContent}
              onChange={e => setCvContent(e.target.value)}
              placeholder={"# Prénom NOM\n\n## Expériences\n- Dev Python chez Acme (2022-2024)\n\n## Compétences\n- FastAPI, PostgreSQL"}
              rows={13}
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.78rem" }}
            />
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Format Markdown recommandé — # ## ###
            </div>
          </div>
        </Card>

        {/* Offre + Prefs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Card title="Offre d'emploi" tag="TEXTE" tagColor="orange">
            <textarea
              className="input"
              value={offerText}
              onChange={e => setOfferText(e.target.value)}
              placeholder="Colle ici le texte complet de l'offre d'emploi..."
              rows={11}
            />
          </Card>

          <Card title="Préférences" tag="OPTIONNEL" tagColor="turquoise">
            <input
              className="input"
              type="text"
              value={preferences}
              onChange={e => setPreferences(e.target.value)}
              placeholder="Ex : insiste sur la rigueur, mets en avant l'anglais..."
            />
          </Card>
        </div>
      </div>

      {/* ── Erreur ── */}
      {error && (
        <div className="animate-in" style={{
          padding: "0.75rem 1rem", border: "1.5px solid #e05252",
          background: "rgba(224,82,82,0.08)", fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "0.8rem", color: "#e05252", boxShadow: "3px 3px 0px #e05252",
        }}>
          ✗ {error}
        </div>
      )}

      {/* ── Bouton ── */}
      <PushButton variant="primary" size="lg" fullWidth loading={loading} onClick={handleGenerate}>
        {!loading && "◈ Générer le CV optimisé"}
      </PushButton>

      {/* ── Résultats ── */}
      {result && (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Score + export */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1.25rem", alignItems: "stretch" }}>

            <Card title="Score ATS" tag={`${result.score}/100`} tagColor={result.score >= 70 ? "turquoise" : "orange"}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <ScoreBar score={result.score} />
                <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.78rem", color: "var(--fg-muted)", lineHeight: 1.6 }}>
                  {result.summary}
                </p>
                {result.metadata?.entreprise && (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)", textTransform: "uppercase" }}>
                      Entreprise
                    </span>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--fg)" }}>
                      {result.metadata.entreprise}
                    </span>
                    {result.metadata.secteur && (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", background: "var(--bg-input)", color: "var(--fg-muted)", padding: "0.1rem 0.4rem", border: "1px solid var(--border-col)" }}>
                        {result.metadata.secteur}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Export bloc */}
            <div style={{
              border: "1.5px solid var(--border-col)", boxShadow: "4px 4px 0px var(--shadow-col)",
              background: "var(--bg-raised)", padding: "1.5rem",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: "1rem", minWidth: "180px",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "2rem", color: "var(--turquoise)", lineHeight: 1, marginBottom: "0.4rem" }}>
                  .md
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--fg)", marginBottom: "0.2rem" }}>
                  CV optimisé
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)" }}>
                  prêt à télécharger
                </div>
              </div>
              <PushButton variant="secondary" size="sm"
                onClick={() => downloadMd(result.cv_optimise_md, `cv_optimise_${cvName || "export"}.md`)}
                style={{ background: "var(--orange)", color: "#fff", boxShadow: "3px 3px 0px rgba(255,255,255,0.2)" }}>
                ↓ Télécharger
              </PushButton>
            </div>
          </div>

          {/* Onglets */}
          <div className="tab-bar">
            {[
              { key: "cv",       label: "CV optimisé" },
              { key: "keywords", label: `Mots-clés (${result.keywords_found.length + result.keywords_missing.length})` },
              { key: "suggest",  label: `Suggestions (${result.suggestions.length})` },
            ].map(t => (
              <button key={t.key} className={`tab ${activeTab === t.key ? "active" : ""}`}
                onClick={() => setActiveTab(t.key as "cv" | "keywords" | "suggest")}>
                {t.label}
              </button>
            ))}
          </div>

          {/* CV optimisé */}
          {activeTab === "cv" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <PushButton variant="primary" size="sm"
                  onClick={() => downloadMd(result.cv_optimise_md, `cv_optimise_${cvName || "export"}.md`)}>
                  ↓ Télécharger le CV (.md)
                </PushButton>
              </div>
              <MarkdownView content={result.cv_optimise_md} label="CV optimisé ATS" maxHeight="600px" />
            </div>
          )}

          {/* Mots-clés */}
          {activeTab === "keywords" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Card title={`Présents (${result.keywords_found.length})`} tagColor="turquoise">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {result.keywords_found.map((k, i) => <KeywordBadge key={k} word={k} variant="found" index={i} />)}
                  {result.keywords_found.length === 0 && (
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--fg-dim)" }}>
                      Aucun mot-clé détecté
                    </span>
                  )}
                </div>
              </Card>
              <Card title={`Manquants (${result.keywords_missing.length})`} tagColor="orange">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {result.keywords_missing.map((k, i) => <KeywordBadge key={k} word={k} variant="missing" index={i} />)}
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
                {result.suggestions.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem",
                      background: "var(--orange)", color: "#fff",
                      padding: "0.1rem 0.4rem", border: "1.5px solid var(--border-col)",
                      flexShrink: 0, marginTop: "0.1rem",
                    }}>{i + 1}</span>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.84rem", color: "var(--fg)", lineHeight: 1.6 }}>
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>
      )}
    </div>
  )
}

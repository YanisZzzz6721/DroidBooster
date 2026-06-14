"use client"

import { useState } from "react"
import PushButton from "@/components/PushButton"
import Card from "@/components/Card"
import ScoreBar from "@/components/ScoreBar"
import KeywordBadge from "@/components/KeywordBadge"
import MarkdownView from "@/components/MarkdownView"
import Skeleton, { SkeletonCard, SkeletonBadges } from "@/components/Skeleton"
import { generateCv } from "@/lib/api"

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
  const a = Object.assign(document.createElement("a"), {
    href:     URL.createObjectURL(new Blob([content], { type: "text/markdown" })),
    download: filename,
  })
  a.click(); URL.revokeObjectURL(a.href)
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
      setResult(data); setActiveTab("cv")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = result ? (result.score >= 85 ? "var(--turquoise)" : result.score >= 70 ? "var(--orange)" : "#e05252") : "var(--fg-dim)"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── Header ── */}
      <div className="animate-in">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem",
            background: "var(--turquoise)", color: "#fff",
            padding: "0.15rem 0.6rem", border: "1.5px solid var(--border-col)",
            letterSpacing: "0.08em",
          }}>CV</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Optimisation ATS · RAG · Mots-clés · Export .md
          </span>
        </div>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.4rem", color: "var(--fg)", letterSpacing: "-0.03em" }}>
          Générer un CV optimisé
        </h1>
        <p style={{ color: "var(--fg-muted)", fontSize: "0.9rem", maxWidth: "560px", lineHeight: 1.7 }}>
          Analyse ATS de ton CV face à l'offre, optimisation des mots-clés, suggestions concrètes — exportable en Markdown.
        </p>
      </div>

      {/* ── Métriques info ── */}
      <div className="animate-in stagger-1" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px", background: "var(--border-col)", border: "1.5px solid var(--border-col)" }}>
        {[
          { icon: "◈", label: "Analyse ATS",     desc: "Score de compatibilité"  },
          { icon: "⊕", label: "Mots-clés",       desc: "Présents vs manquants"   },
          { icon: "✎", label: "Suggestions",     desc: "Améliorations concrètes" },
        ].map(item => (
          <div key={item.label} style={{ background: "var(--bg-surface)", padding: "0.875rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "1rem", color: "var(--fg-dim)" }}>{item.icon}</span>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.78rem", color: "var(--fg)" }}>{item.label}</div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Inputs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

        <Card title="Ton CV" tag="MARKDOWN" tagColor="turquoise" animate stagger={2}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <input
                className="input"
                type="text"
                value={cvName}
                onChange={e => setCvName(e.target.value)}
                placeholder="Nom du CV"
                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.78rem", flex: 1 }}
              />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)", whiteSpace: "nowrap" }}>
                {cvContent.split("\n").length} lignes
              </span>
            </div>
            <textarea
              className="input"
              value={cvContent}
              onChange={e => setCvContent(e.target.value)}
              placeholder={"# Prénom NOM\n## Titre du poste\n\n## Expériences\n- Poste chez Entreprise (2022-2024)\n  Accomplissement clé\n\n## Compétences\n- Tech 1, Tech 2, Tech 3\n\n## Formation\n- Diplôme, École (2021)"}
              rows={14}
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.78rem", lineHeight: 1.7 }}
            />
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Format Markdown — # ## ### pour la structure
            </div>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Card title="Offre d'emploi" tag="TEXTE" tagColor="orange" animate stagger={3}>
            <textarea
              className="input"
              value={offerText}
              onChange={e => setOfferText(e.target.value)}
              placeholder="Colle ici le texte complet de l'offre d'emploi..."
              rows={11}
              style={{ lineHeight: 1.7 }}
            />
            <div style={{ marginTop: "0.5rem", display: "flex", justifyContent: "flex-end" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)" }}>
                {offerText.length} caractères
              </span>
            </div>
          </Card>

          <Card title="Préférences" tag="OPTIONNEL" tagColor="turquoise" animate stagger={4}>
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
        <div className="animate-in shakeX" style={{
          padding: "0.875rem 1rem", border: "1.5px solid #e05252",
          background: "rgba(224,82,82,0.08)", fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "0.8rem", color: "#e05252", boxShadow: "3px 3px 0px rgba(224,82,82,0.3)",
          display: "flex", alignItems: "center", gap: "0.75rem",
        }}>
          <span>✗</span> {error}
        </div>
      )}

      {/* ── Bouton ── */}
      <PushButton variant="primary" size="lg" fullWidth loading={loading} onClick={handleGenerate}>
        {!loading && "◈ Générer le CV optimisé"}
      </PushButton>

      {/* ── Skeleton ── */}
      {loading && (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem" }}>
            <SkeletonCard />
            <div style={{ width: 180, border: "1.5px solid var(--border-col)", background: "var(--bg-raised)", padding: "1rem" }}>
              <Skeleton variant="text" /><Skeleton variant="score" /><Skeleton variant="text" />
            </div>
          </div>
          <SkeletonBadges />
        </div>
      )}

      {/* ── Résultats ── */}
      {result && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Score + export */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1.25rem", alignItems: "stretch" }}>

            <div className="animate-pop stagger-1" style={{
              border: "1.5px solid var(--border-col)", background: "var(--bg-surface)",
              boxShadow: "4px 4px 0px var(--shadow-col)", padding: "1.5rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>
                    Score ATS
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "2.5rem", color: scoreColor, lineHeight: 1 }}>
                    {result.score}<span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--fg-dim)" }}>/100</span>
                  </div>
                </div>
                {result.metadata?.entreprise && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "var(--fg)" }}>
                      {result.metadata.entreprise}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "var(--fg-muted)" }}>
                      {result.metadata.poste}
                    </div>
                    {result.metadata.secteur && (
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", background: "var(--bg-input)", color: "var(--fg-muted)", padding: "0.1rem 0.4rem", border: "1px solid var(--border-col)", display: "inline-block", marginTop: "0.25rem" }}>
                        {result.metadata.secteur}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <ScoreBar score={result.score} />
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--fg-muted)", lineHeight: 1.6, marginTop: "0.75rem" }}>
                {result.summary}
              </p>
            </div>

            <div className="animate-pop stagger-2" style={{
              border: "1.5px solid var(--border-col)", boxShadow: "4px 4px 0px var(--shadow-col)",
              background: "var(--bg-raised)", padding: "1.5rem",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: "1rem", minWidth: "180px",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "2.5rem", color: "var(--turquoise)", lineHeight: 1 }}>
                .md
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.82rem", color: "var(--fg)" }}>CV optimisé</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)" }}>prêt à télécharger</div>
              </div>
              <PushButton variant="secondary" size="sm"
                onClick={() => downloadMd(result.cv_optimise_md, `cv_optimise_${cvName}.md`)}
                style={{ background: "var(--orange)", color: "#fff", boxShadow: "3px 3px 0px rgba(255,255,255,0.2)", width: "100%", justifyContent: "center" }}>
                ↓ Télécharger
              </PushButton>
            </div>
          </div>

          {/* Onglets */}
          <div className="tab-bar animate-in stagger-3">
            {[
              { key: "cv",       label: `◈ CV optimisé` },
              { key: "keywords", label: `⊕ Mots-clés (${result.keywords_found.length + result.keywords_missing.length})` },
              { key: "suggest",  label: `✎ Suggestions (${result.suggestions.length})` },
            ].map(t => (
              <button key={t.key} className={`tab ${activeTab === t.key ? "active" : ""}`}
                onClick={() => setActiveTab(t.key as "cv" | "keywords" | "suggest")}>
                {t.label}
              </button>
            ))}
          </div>

          {/* CV optimisé */}
          {activeTab === "cv" && (
            <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <PushButton variant="primary" size="sm"
                  onClick={() => downloadMd(result.cv_optimise_md, `cv_optimise_${cvName}.md`)}>
                  ↓ Télécharger le CV (.md)
                </PushButton>
              </div>
              <MarkdownView content={result.cv_optimise_md} label="CV optimisé ATS" maxHeight="600px" />
            </div>
          )}

          {/* Mots-clés */}
          {activeTab === "keywords" && (
            <div className="animate-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Card title={`✓ Présents (${result.keywords_found.length})`} tagColor="turquoise">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {result.keywords_found.map((k, i) => <KeywordBadge key={k} word={k} variant="found" index={i} />)}
                  {result.keywords_found.length === 0 && (
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--fg-dim)" }}>
                      Aucun mot-clé détecté
                    </span>
                  )}
                </div>
              </Card>
              <Card title={`✗ Manquants (${result.keywords_missing.length})`} tagColor="orange">
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
            <Card title="Suggestions d'amélioration" className="animate-in">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {result.suggestions.map((s, i) => (
                  <div key={i} className={`animate-in stagger-${Math.min(i + 1, 8)}`}
                    style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start", padding: "0.75rem", background: "var(--bg-input)", border: "1px solid var(--border-col)" }}>
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem",
                      background: "var(--orange)", color: "#fff",
                      padding: "0.15rem 0.45rem", border: "1.5px solid var(--border-col)",
                      flexShrink: 0, marginTop: "0.1rem", minWidth: "24px", textAlign: "center",
                    }}>{i + 1}</span>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", color: "var(--fg)", lineHeight: 1.7 }}>
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

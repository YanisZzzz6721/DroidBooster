"use client"

import { useState, useRef } from "react"
import PushButton from "@/components/PushButton"
import Card from "@/components/Card"
import ScoreBar from "@/components/ScoreBar"
import KeywordBadge from "@/components/KeywordBadge"
import MarkdownView from "@/components/MarkdownView"
import Skeleton, { SkeletonCard, SkeletonBadges } from "@/components/Skeleton"
import { generateCv, exportDocx } from "@/lib/api"

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
  const a = Object.assign(document.createElement("a"), {
    href:     URL.createObjectURL(new Blob([content], { type: "text/markdown" })),
    download: filename,
  })
  a.click(); URL.revokeObjectURL(a.href)
}

// ── Étape badge ───────────────────────────────────────────────────────────────
function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: done ? "var(--turquoise)" : active ? "var(--orange)" : "var(--bg-raised)",
        border: `2px solid ${done ? "var(--turquoise)" : active ? "var(--orange)" : "var(--border-col)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", fontWeight: 700,
        color: done || active ? "#fff" : "var(--fg-dim)",
        transition: "all 0.3s var(--ease-spring)",
        flexShrink: 0,
      }}>
        {done ? "✓" : n}
      </div>
      <span style={{
        fontFamily: "'Space Grotesk', sans-serif", fontWeight: active || done ? 700 : 500,
        fontSize: "0.82rem",
        color: active ? "var(--orange)" : done ? "var(--turquoise)" : "var(--fg-muted)",
        transition: "color 0.3s ease",
      }}>{label}</span>
    </div>
  )
}

export default function CvPage() {
  // ── État pipeline ──
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // ── Étape 1 ──
  const [offerText,   setOfferText]   = useState("")
  const [cvContent,   setCvContent]   = useState("")
  const [cvName,      setCvName]      = useState("mon_cv")
  const [preferences, setPreferences] = useState("")
  const [generating,  setGenerating]  = useState(false)
  const [genError,    setGenError]    = useState("")
  const [result,      setResult]      = useState<CvResult | null>(null)
  const [activeTab,   setActiveTab]   = useState<"cv" | "keywords" | "suggest">("cv")

  // ── Étape 3 ──
  const [template,    setTemplate]    = useState<File | null>(null)
  const [exporting,   setExporting]   = useState(false)
  const [exportError, setExportError] = useState("")
  const [exported,    setExported]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Génération CV ──
  const handleGenerate = async () => {
    if (!offerText.trim()) { setGenError("Colle le texte de l'offre."); return }
    if (!cvContent.trim()) { setGenError("Colle ton CV de base."); return }
    setGenError(""); setGenerating(true); setResult(null); setExported(false)
    try {
      const data = await generateCv(offerText, cvContent, cvName || "mon_cv", preferences)
      setResult(data)
      setActiveTab("cv")
      setStep(2)
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : "Erreur inconnue")
    } finally {
      setGenerating(false)
    }
  }

  // ── Export DOCX ──
  const handleExport = async () => {
    if (!result?.cv_optimise_md) { setExportError("Génère d'abord le CV optimisé."); return }
    if (!template)                { setExportError("Sélectionne un template DOCX."); return }
    setExportError(""); setExporting(true)
    try {
      const { blob, filename } = await exportDocx(result.cv_optimise_md, template)
      const a = Object.assign(document.createElement("a"), {
        href:     URL.createObjectURL(blob),
        download: filename,
      })
      a.click(); URL.revokeObjectURL(a.href)
      setExported(true)
    } catch (e: unknown) {
      setExportError(e instanceof Error ? e.message : "Erreur export")
    } finally {
      setExporting(false)
    }
  }

  const scoreColor = result
    ? result.score >= 85 ? "var(--turquoise)" : result.score >= 70 ? "var(--orange)" : "#e05252"
    : "var(--fg-dim)"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── Header ── */}
      <div className="animate-in">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem",
            background: "var(--turquoise)", color: "#fff",
            padding: "0.15rem 0.6rem", border: "1.5px solid var(--border-col)",
          }}>CV</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Pipeline complet · ATS · Optimisation · Export DOCX
          </span>
        </div>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.4rem", color: "var(--fg)", letterSpacing: "-0.03em" }}>
          Générer & exporter un CV
        </h1>
        <p style={{ color: "var(--fg-muted)", fontSize: "0.9rem", maxWidth: "580px", lineHeight: 1.7 }}>
          Pipeline complète : optimisation ATS de ton CV selon l'offre, puis export en DOCX via ton propre template.
        </p>
      </div>

      {/* ── Indicateur étapes ── */}
      <div className="animate-in stagger-1" style={{
        display: "flex", alignItems: "center", gap: "1rem",
        padding: "1rem 1.25rem",
        background: "var(--bg-surface)",
        border: "1.5px solid var(--border-col)",
        boxShadow: "var(--shadow-sm)",
      }}>
        <StepBadge n={1} label="Générer le CV optimisé" active={step === 1} done={step > 1} />
        <div style={{ flex: 1, height: 1, background: step > 1 ? "var(--turquoise)" : "var(--border-col)", transition: "background 0.4s ease" }} />
        <StepBadge n={2} label="Vérifier le résultat"   active={step === 2} done={step > 2} />
        <div style={{ flex: 1, height: 1, background: step > 2 ? "var(--turquoise)" : "var(--border-col)", transition: "background 0.4s ease" }} />
        <StepBadge n={3} label="Exporter en DOCX"       active={step === 3} done={exported} />
      </div>

      {/* ═══════════════════════════════════════════════
          ÉTAPE 1 — Inputs
      ═══════════════════════════════════════════════ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

        <Card title="Ton CV de base" tag="MARKDOWN" tagColor="turquoise" animate stagger={2}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <input
                className="input"
                type="text"
                value={cvName}
                onChange={e => setCvName(e.target.value)}
                placeholder="Nom du fichier (ex: cv_jean_dupont)"
                style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.78rem", flex: 1 }}
              />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", whiteSpace: "nowrap" }}>
                {cvContent.split("\n").length} lignes
              </span>
            </div>
            <textarea
              className="input"
              value={cvContent}
              onChange={e => setCvContent(e.target.value)}
              placeholder={"# Prénom NOM\n## Développeur Python Senior\n\n## Expériences\n- Dev Python chez Acme (2022-2024)\n  Accomplissement concret\n\n## Compétences\n- FastAPI, PostgreSQL, Docker\n\n## Formation\n- Master Info, Université Paris (2021)"}
              rows={14}
              style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.78rem", lineHeight: 1.7 }}
            />
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Format Markdown — # Titre  ## Section  - Élément
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
            <div style={{ marginTop: "0.4rem", display: "flex", justifyContent: "flex-end" }}>
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

      {/* Erreur génération */}
      {genError && (
        <div className="animate-in" style={{
          padding: "0.875rem 1rem", border: "1.5px solid #e05252",
          background: "rgba(224,82,82,0.06)", fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "0.8rem", color: "#e05252", boxShadow: "3px 3px 0px rgba(224,82,82,0.2)",
          display: "flex", gap: "0.75rem",
        }}>
          <span>✗</span> {genError}
        </div>
      )}

      {/* Bouton générer */}
      <PushButton variant="primary" size="lg" fullWidth loading={generating} onClick={handleGenerate}>
        {!generating && "◈ Étape 1 — Générer le CV optimisé ATS"}
      </PushButton>

      {/* Skeleton */}
      {generating && (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem" }}>
            <SkeletonCard />
            <div style={{ width: 180, border: "1.5px solid var(--border-col)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Skeleton variant="score" /><Skeleton variant="text" /><Skeleton variant="text" />
            </div>
          </div>
          <SkeletonBadges />
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          ÉTAPE 2 — Résultat CV optimisé
      ═══════════════════════════════════════════════ */}
      {result && !generating && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Séparateur étape 2 */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ flex: 1, height: "1.5px", background: "var(--border-col)" }} />
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem",
              color: "var(--turquoise)", textTransform: "uppercase", letterSpacing: "0.1em",
              padding: "0.2rem 0.75rem", border: "1.5px solid var(--turquoise)",
              background: "rgba(10,191,188,0.06)",
            }}>
              ✓ Étape 2 — Résultat
            </div>
            <div style={{ flex: 1, height: "1.5px", background: "var(--border-col)" }} />
          </div>

          {/* Score + export MD */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1.25rem", alignItems: "stretch" }}>

            <div className="animate-pop stagger-1" style={{
              border: "1.5px solid var(--border-col)", background: "var(--bg-surface)",
              boxShadow: "var(--shadow)", padding: "1.5rem",
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
                  </div>
                )}
              </div>
              <ScoreBar score={result.score} />
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--fg-muted)", lineHeight: 1.6, marginTop: "0.75rem" }}>
                {result.summary}
              </p>
            </div>

            <div className="animate-pop stagger-2" style={{
              border: "1.5px solid var(--border-col)", boxShadow: "var(--shadow)",
              background: "var(--bg-raised)", padding: "1.5rem",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: "1rem", minWidth: "175px",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "2.2rem", color: "var(--turquoise)", lineHeight: 1 }}>.md</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "var(--fg)" }}>CV optimisé</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)" }}>Markdown brut</div>
              </div>
              <PushButton variant="secondary" size="sm"
                onClick={() => downloadMd(result.cv_optimise_md, `cv_optimise_${cvName}.md`)}
                style={{ width: "100%", justifyContent: "center" }}>
                ↓ Télécharger .md
              </PushButton>
            </div>
          </div>

          {/* Onglets */}
          <div className="tab-bar">
            {[
              { key: "cv",       label: `◈ CV optimisé` },
              { key: "keywords", label: `Mots-clés (${result.keywords_found.length + result.keywords_missing.length})` },
              { key: "suggest",  label: `Suggestions (${result.suggestions.length})` },
            ].map(t => (
              <button key={t.key} className={`tab ${activeTab === t.key ? "active" : ""}`}
                onClick={() => setActiveTab(t.key as "cv" | "keywords" | "suggest")}>
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "cv" && (
            <div className="animate-in">
              <MarkdownView content={result.cv_optimise_md} label="CV optimisé ATS" maxHeight="500px" />
            </div>
          )}

          {activeTab === "keywords" && (
            <div className="animate-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Card title={`✓ Présents (${result.keywords_found.length})`} tagColor="turquoise">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {result.keywords_found.map((k, i) => <KeywordBadge key={k} word={k} variant="found" index={i} />)}
                  {result.keywords_found.length === 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--fg-dim)" }}>Aucun détecté</span>}
                </div>
              </Card>
              <Card title={`✗ Manquants (${result.keywords_missing.length})`} tagColor="orange">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {result.keywords_missing.map((k, i) => <KeywordBadge key={k} word={k} variant="missing" index={i} />)}
                  {result.keywords_missing.length === 0 && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--turquoise)" }}>✓ Tous présents</span>}
                </div>
              </Card>
            </div>
          )}

          {activeTab === "suggest" && (
            <Card title="Suggestions d'amélioration" className="animate-in">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {result.suggestions.map((s, i) => (
                  <div key={i} className={`animate-in stagger-${Math.min(i + 1, 8)}`}
                    style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start", padding: "0.75rem", background: "var(--bg-raised)", border: "1px solid var(--border-col)" }}>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", background: "var(--orange)", color: "#fff", padding: "0.1rem 0.45rem", flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", color: "var(--fg)", lineHeight: 1.7 }}>{s}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Bouton passer à l'étape 3 */}
          <PushButton variant="secondary" size="lg" fullWidth onClick={() => setStep(3)}>
            → Étape 3 — Exporter en DOCX avec mon template
          </PushButton>

          {/* ═══════════════════════════════════════════════
              ÉTAPE 3 — Export DOCX
          ═══════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Séparateur étape 3 */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ flex: 1, height: "1.5px", background: "var(--border-col)" }} />
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem",
                  color: "var(--orange)", textTransform: "uppercase", letterSpacing: "0.1em",
                  padding: "0.2rem 0.75rem", border: "1.5px solid var(--orange)",
                  background: "rgba(232,99,10,0.06)",
                }}>
                  Étape 3 — Export DOCX
                </div>
                <div style={{ flex: 1, height: "1.5px", background: "var(--border-col)" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1.25rem", alignItems: "stretch" }}>

                {/* Upload template */}
                <Card title="Template DOCX" tag="TON MODÈLE" tagColor="orange">
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--fg-muted)", lineHeight: 1.6 }}>
                      Ton template doit contenir des placeholders : <br />
                      <code style={{ color: "var(--orange)" }}>{"{{nom}}"}</code>{" "}
                      <code style={{ color: "var(--orange)" }}>{"{{titre}}"}</code>{" "}
                      <code style={{ color: "var(--orange)" }}>{"{{experiences}}"}</code>{" "}
                      <code style={{ color: "var(--orange)" }}>{"{{competences}}"}</code>
                    </p>

                    <input
                      ref={fileRef}
                      type="file"
                      accept=".docx"
                      style={{ display: "none" }}
                      onChange={e => setTemplate(e.target.files?.[0] ?? null)}
                    />

                    <div
                      onClick={() => fileRef.current?.click()}
                      style={{
                        border: `2px dashed ${template ? "var(--turquoise)" : "var(--border-col)"}`,
                        padding: "2rem",
                        textAlign: "center",
                        cursor: "pointer",
                        background: template ? "rgba(10,191,188,0.04)" : "var(--bg-raised)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {template ? (
                        <div>
                          <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>✓</div>
                          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "var(--turquoise)" }}>
                            {template.name}
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)", marginTop: "0.2rem" }}>
                            {(template.size / 1024).toFixed(1)} Ko — Cliquer pour changer
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem", color: "var(--fg-dim)" }}>↑</div>
                          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "0.85rem", color: "var(--fg-muted)" }}>
                            Cliquer pour sélectionner
                          </div>
                          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)", marginTop: "0.2rem" }}>
                            Fichier .docx uniquement
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Résumé export */}
                <div style={{
                  border: "1.5px solid var(--border-col)", boxShadow: "var(--shadow)",
                  background: exported ? "rgba(10,191,188,0.04)" : "var(--bg-raised)",
                  padding: "1.5rem",
                  display: "flex", flexDirection: "column", alignItems: "center",
                  justifyContent: "center", gap: "1rem", minWidth: "175px",
                  transition: "background 0.3s ease",
                }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "2.2rem", color: exported ? "var(--turquoise)" : "var(--orange)", lineHeight: 1, transition: "color 0.3s ease" }}>
                    {exported ? "✓" : ".docx"}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.82rem", color: "var(--fg)" }}>
                      {exported ? "Exporté !" : "Prêt à exporter"}
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", marginTop: "0.2rem" }}>
                      {cvName || "mon_cv"}.docx
                    </div>
                  </div>
                  <PushButton
                    variant="primary" size="sm" loading={exporting} onClick={handleExport}
                    style={{ width: "100%", justifyContent: "center", background: exported ? "var(--turquoise)" : "var(--orange)" }}
                  >
                    {!exporting && (exported ? "↓ Re-télécharger" : "↓ Exporter DOCX")}
                  </PushButton>
                </div>
              </div>

              {/* Erreur export */}
              {exportError && (
                <div style={{
                  padding: "0.75rem 1rem", border: "1.5px solid #e05252",
                  background: "rgba(224,82,82,0.06)", fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "0.8rem", color: "#e05252", display: "flex", gap: "0.75rem",
                }}>
                  <span>✗</span> {exportError}
                </div>
              )}

              {/* Succès */}
              {exported && (
                <div className="animate-pop" style={{
                  padding: "1rem 1.25rem", border: "1.5px solid var(--turquoise)",
                  background: "rgba(10,191,188,0.06)",
                  display: "flex", alignItems: "center", gap: "0.75rem",
                }}>
                  <span style={{ fontSize: "1.2rem" }}>✓</span>
                  <div>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "var(--turquoise)" }}>
                      CV exporté avec succès
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "var(--fg-muted)", marginTop: "0.2rem" }}>
                      Le fichier DOCX a été téléchargé dans ton dossier de téléchargements.
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  )
}

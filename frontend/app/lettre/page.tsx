"use client"

import { useState, useEffect } from "react"
import PushButton from "@/components/PushButton"
import Card from "@/components/Card"
import MarkdownView from "@/components/MarkdownView"
import ScoreBar from "@/components/ScoreBar"
import Skeleton, { SkeletonCard } from "@/components/Skeleton"
import { generateLetter, getCvs, getDownloadLettreUrl } from "@/lib/api"

interface CvItem  { name: string; preview: string }
interface Analyse {
  ton_entreprise:        string
  valeurs_cles:          string[]
  profil_exact:          string
  points_differenciants: string
  mots_a_eviter:         string[]
}
interface LetterResult {
  lettre_md:     string
  docx_filename: string
  score_qualite: number
  rag_exemples:  number
  analyse_offre: Analyse
  metadata:      { entreprise?: string; poste?: string }
}

const PIPELINE_STEPS = [
  { icon: "⬡", label: "Faits CV",   desc: "Anti-hallucination" },
  { icon: "◎", label: "Analyse",    desc: "Ton entreprise"     },
  { icon: "⚡", label: "RAG",        desc: "Exemples passés"   },
  { icon: "✉", label: "Génération", desc: "JSON structuré"     },
]

export default function LettrePage() {
  const [offerText,   setOfferText]   = useState("")
  const [preferences, setPreferences] = useState("")
  const [cvs,         setCvs]         = useState<CvItem[]>([])
  const [selectedCv,  setSelectedCv]  = useState("")
  const [loading,     setLoading]     = useState(false)
  const [loadingCvs,  setLoadingCvs]  = useState(true)
  const [activeStep,  setActiveStep]  = useState(-1)
  const [error,       setError]       = useState("")
  const [result,      setResult]      = useState<LetterResult | null>(null)
  const [activeTab,   setActiveTab]   = useState<"lettre" | "analyse">("lettre")

  useEffect(() => {
    getCvs()
      .then(d => { setCvs(d.cvs || []); if (d.cvs?.length) setSelectedCv(d.cvs[0].name) })
      .catch(() => setError("Impossible de charger la liste des CVs."))
      .finally(() => setLoadingCvs(false))
  }, [])

  // Animation des étapes pendant le chargement
  useEffect(() => {
    if (!loading) { setActiveStep(-1); return }
    let step = 0
    setActiveStep(0)
    const iv = setInterval(() => {
      step = (step + 1) % PIPELINE_STEPS.length
      setActiveStep(step)
    }, 1800)
    return () => clearInterval(iv)
  }, [loading])

  const handleGenerate = async () => {
    if (!offerText.trim())  { setError("Colle le texte de l'offre."); return }
    if (!selectedCv)        { setError("Sélectionne un CV."); return }
    setError(""); setLoading(true); setResult(null)
    try {
      const data = await generateLetter(offerText, selectedCv, preferences)
      setResult(data)
      setActiveTab("lettre")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  const downloadDocx = () => result?.docx_filename && window.open(getDownloadLettreUrl(result.docx_filename), "_blank")
  const downloadMd   = () => {
    if (!result?.lettre_md) return
    const a = Object.assign(document.createElement("a"), {
      href:     URL.createObjectURL(new Blob([result.lettre_md], { type: "text/markdown" })),
      download: result.docx_filename?.replace(".docx", ".md") || "lettre.md",
    })
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── Header ── */}
      <div className="animate-in">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem",
            background: "var(--orange)", color: "#fff",
            padding: "0.15rem 0.6rem", border: "1.5px solid var(--border-col)",
            letterSpacing: "0.08em",
          }}>LM</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Pipeline 4 étapes · RAG · Anti-hallucination · Score qualité
          </span>
        </div>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.4rem", color: "var(--fg)", letterSpacing: "-0.03em" }}>
          Lettre de motivation
        </h1>
        <p style={{ color: "var(--fg-muted)", fontSize: "0.9rem", maxWidth: "560px", lineHeight: 1.7 }}>
          Génère une lettre ultra-ciblée — le ton s'adapte à l'entreprise, le RAG s'améliore à chaque génération, la structure est garantie.
        </p>
      </div>

      {/* ── Pipeline steps (indicateur visuel) ── */}
      <div className="animate-in stagger-1" style={{
        display: "flex", alignItems: "center", gap: 0,
        border: "1.5px solid var(--border-col)",
        background: "var(--bg-surface)",
        overflow: "hidden",
      }}>
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step.label} style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div style={{
              flex: 1, padding: "0.75rem 1rem",
              background: loading && activeStep === i ? "rgba(10,191,188,0.08)" : "transparent",
              borderRight: i < PIPELINE_STEPS.length - 1 ? "1px solid var(--border-col)" : "none",
              transition: "background 0.3s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.9rem",
                  color: loading && activeStep === i ? "var(--turquoise)" : "var(--fg-dim)",
                  transition: "color 0.3s ease",
                }}>{step.icon}</span>
                <div>
                  <div style={{
                    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.72rem",
                    color: loading && activeStep === i ? "var(--fg)" : "var(--fg-muted)",
                    transition: "color 0.3s ease",
                  }}>{step.label}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {step.desc}
                  </div>
                </div>
                {loading && activeStep === i && (
                  <span className="spinner" style={{ marginLeft: "auto", width: 14, height: 14, borderWidth: 2 }} />
                )}
                {!loading && result && (
                  <span style={{ marginLeft: "auto", color: "var(--turquoise)", fontSize: "0.75rem" }}>✓</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Inputs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

        <Card title="Offre d'emploi" tag="REQUIS" tagColor="orange" animate stagger={2}>
          <textarea
            className="input"
            value={offerText}
            onChange={e => setOfferText(e.target.value)}
            placeholder={"Entreprise : PayFlow\nPoste : Développeur Python Senior\n\nNous recherchons..."}
            rows={14}
            style={{ lineHeight: 1.7 }}
          />
          <div style={{ marginTop: "0.5rem", display: "flex", justifyContent: "flex-end" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)" }}>
              {offerText.length} caractères
            </span>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Card title="CV à utiliser" tag="SÉLECTION" tagColor="turquoise" animate stagger={3}>
            {loadingCvs ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <Skeleton variant="text" />
                <Skeleton variant="block" />
              </div>
            ) : cvs.length === 0 ? (
              <div style={{ padding: "1rem", border: "1px dashed var(--border-col)", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>◈</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "#e05252" }}>
                  Aucun CV dans /cvs
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <select
                  className="input"
                  value={selectedCv}
                  onChange={e => setSelectedCv(e.target.value)}
                  style={{ cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.8rem" }}
                >
                  {cvs.map(cv => <option key={cv.name} value={cv.name}>{cv.name}</option>)}
                </select>
                {selectedCv && (
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.68rem",
                    color: "var(--fg-dim)", lineHeight: 1.6,
                    padding: "0.6rem 0.75rem",
                    background: "var(--bg-input)", border: "1px solid var(--border-col)",
                    maxHeight: "72px", overflow: "hidden", position: "relative",
                  }}>
                    {cvs.find(c => c.name === selectedCv)?.preview}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "24px", background: "linear-gradient(transparent, var(--bg-input))" }} />
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="Préférences" tag="OPTIONNEL" tagColor="turquoise" animate stagger={4}>
            <textarea
              className="input"
              value={preferences}
              onChange={e => setPreferences(e.target.value)}
              placeholder={"Ex : insiste sur la rigueur\nMets en avant l'anglais\nTon startup, direct et concis"}
              rows={5}
              style={{ lineHeight: 1.7 }}
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
          <span style={{ fontSize: "1rem" }}>✗</span> {error}
        </div>
      )}

      {/* ── Bouton ── */}
      <PushButton variant="primary" size="lg" fullWidth loading={loading} onClick={handleGenerate}>
        {!loading && "✉ Générer la lettre de motivation"}
      </PushButton>

      {/* ── Skeleton loading ── */}
      {loading && (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1rem" }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
            <div style={{ width: 160, border: "1.5px solid var(--border-col)", background: "var(--bg-raised)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Skeleton variant="score" /><Skeleton variant="text" /><Skeleton variant="text" />
            </div>
          </div>
          <div style={{ border: "1.5px solid var(--border-col)", background: "var(--bg-surface)", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Skeleton variant="title" width="40%" />
            {[...Array(6)].map((_, i) => <Skeleton key={i} variant="text" />)}
          </div>
        </div>
      )}

      {/* ── Résultats ── */}
      {result && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Bande de stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1rem", alignItems: "stretch" }}>

            {/* Score qualité */}
            <div className="animate-pop stagger-1" style={{
              border: "1.5px solid var(--border-col)", background: "var(--bg-surface)",
              boxShadow: "4px 4px 0px var(--shadow-col)", padding: "1.25rem",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
                Score qualité
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <ScoreBar score={result.score_qualite} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.7rem", color: result.score_qualite >= 75 ? "var(--turquoise)" : "var(--orange)" }}>
                  {result.score_qualite >= 75 ? "✓" : "—"}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-muted)" }}>
                  {result.score_qualite >= 75 ? "Sauvegardée dans le RAG" : "Score insuffisant pour RAG"}
                </span>
              </div>
            </div>

            {/* Entreprise */}
            <div className="animate-pop stagger-2" style={{
              border: "1.5px solid var(--border-col)", background: "var(--bg-surface)",
              boxShadow: "4px 4px 0px var(--shadow-col)", padding: "1.25rem",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                Entreprise détectée
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "var(--fg)", marginBottom: "0.3rem" }}>
                {result.metadata?.entreprise || "—"}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "var(--fg-muted)", marginBottom: "0.5rem" }}>
                {result.metadata?.poste || ""}
              </div>
              {result.analyse_offre?.ton_entreprise && (
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--turquoise)",
                  background: "rgba(10,191,188,0.08)", border: "1px solid rgba(10,191,188,0.2)",
                  padding: "0.25rem 0.5rem", display: "inline-block",
                }}>
                  {result.analyse_offre.ton_entreprise}
                </div>
              )}
            </div>

            {/* RAG */}
            <div className="animate-pop stagger-3" style={{
              border: "1.5px solid var(--border-col)", background: "var(--bg-surface)",
              boxShadow: "4px 4px 0px var(--shadow-col)", padding: "1.25rem",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                RAG utilisé
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginBottom: "0.75rem" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "2rem", color: result.rag_exemples > 0 ? "var(--turquoise)" : "var(--fg-dim)", lineHeight: 1 }}>
                  {result.rag_exemples}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "var(--fg-muted)" }}>
                  exemple{result.rag_exemples > 1 ? "s" : ""}
                </span>
              </div>
              {result.analyse_offre?.valeurs_cles?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                  {result.analyse_offre.valeurs_cles.map((v, i) => (
                    <span key={v} className={`animate-pop stagger-${i + 1}`} style={{
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem",
                      background: "rgba(10,191,188,0.1)", color: "var(--turquoise)",
                      border: "1px solid rgba(10,191,188,0.25)", padding: "0.1rem 0.35rem",
                    }}>{v}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Export bloc */}
            <div className="animate-pop stagger-4" style={{
              border: "1.5px solid var(--border-col)", boxShadow: "4px 4px 0px var(--shadow-col)",
              background: "var(--bg-raised)", padding: "1.25rem",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: "0.75rem", minWidth: "150px",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "2rem", color: "var(--orange)", lineHeight: 1 }}>✉</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.78rem", color: "var(--fg)" }}>
                  Lettre prête
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "var(--fg-dim)" }}>
                  .md · .docx
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", width: "100%" }}>
                <PushButton variant="secondary" size="sm" onClick={downloadDocx}
                  style={{ background: "var(--orange)", color: "#fff", boxShadow: "3px 3px 0px rgba(255,255,255,0.15)", width: "100%", justifyContent: "center" }}>
                  ↓ DOCX
                </PushButton>
                <PushButton variant="secondary" size="sm" onClick={downloadMd}
                  style={{ width: "100%", justifyContent: "center" }}>
                  ↓ Markdown
                </PushButton>
              </div>
            </div>
          </div>

          {/* Onglets */}
          <div className="tab-bar animate-in stagger-5">
            {[
              { key: "lettre",  label: "✉ Lettre générée"     },
              { key: "analyse", label: "⬡ Analyse entreprise"  },
            ].map(t => (
              <button key={t.key} className={`tab ${activeTab === t.key ? "active" : ""}`}
                onClick={() => setActiveTab(t.key as "lettre" | "analyse")}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Lettre */}
          {activeTab === "lettre" && (
            <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <PushButton variant="secondary" size="sm" onClick={downloadMd}>↓ .md</PushButton>
                <PushButton variant="primary" size="sm" onClick={downloadDocx}>↓ Télécharger DOCX</PushButton>
              </div>
              <MarkdownView content={result.lettre_md} label="Lettre de motivation" maxHeight="600px" />
            </div>
          )}

          {/* Analyse entreprise */}
          {activeTab === "analyse" && result.analyse_offre && (
            <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Card title="Ton de l'entreprise" tag="HAIKU" tagColor="turquoise">
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", color: "var(--fg)", lineHeight: 1.7 }}>
                    {result.analyse_offre.ton_entreprise}
                  </p>
                </Card>
                <Card title="Profil recherché" tagColor="orange">
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", color: "var(--fg)", lineHeight: 1.7 }}>
                    {result.analyse_offre.profil_exact}
                  </p>
                </Card>
              </div>

              <Card title="Ce qui différencie cette entreprise">
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", color: "var(--fg)", lineHeight: 1.7 }}>
                  {result.analyse_offre.points_differenciants}
                </p>
              </Card>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <Card title="Valeurs clés intégrées" tagColor="turquoise">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {result.analyse_offre.valeurs_cles.map((v, i) => (
                      <span key={v} className={`animate-pop stagger-${i + 1}`} style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem",
                        background: "rgba(10,191,188,0.12)", color: "var(--turquoise)",
                        border: "1.5px solid rgba(10,191,188,0.3)", padding: "0.25rem 0.6rem",
                      }}>✓ {v}</span>
                    ))}
                  </div>
                </Card>
                <Card title="Mots bannis" tagColor="orange">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {result.analyse_offre.mots_a_eviter.map((m, i) => (
                      <span key={m} className={`animate-pop stagger-${i + 1}`} style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem",
                        background: "rgba(224,82,82,0.08)", color: "#e05252",
                        border: "1.5px solid rgba(224,82,82,0.3)", padding: "0.25rem 0.6rem",
                        textDecoration: "line-through", opacity: 0.8,
                      }}>✗ {m}</span>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

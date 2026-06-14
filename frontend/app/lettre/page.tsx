"use client"

import { useState, useEffect } from "react"
import PushButton from "@/components/PushButton"
import Card from "@/components/Card"
import MarkdownView from "@/components/MarkdownView"
import ScoreBar from "@/components/ScoreBar"
import Skeleton, { SkeletonCard } from "@/components/Skeleton"
import { getDownloadLettreUrl } from "@/lib/api"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Analyse {
  ton_entreprise:        string
  valeurs_cles:          string[]
  profil_exact:          string
  points_differenciants: string
  mots_a_eviter:         string[]
}

interface RunResult {
  match:         { cv_name: string; match_score: number; selection_reason: string }
  metadata:      { entreprise?: string; poste?: string; secteur?: string }
  lettre_md:     string
  docx_path:     string
  score_qualite: number
  analyse_offre: Analyse
}

const PIPELINE_STEPS = [
  { icon: "◎", label: "Analyse offre",   desc: "Ton + valeurs + profil"  },
  { icon: "⬡", label: "Sélection CV",    desc: "Meilleur match RAG"      },
  { icon: "⚡", label: "Faits vérifiés",  desc: "Anti-hallucination"      },
  { icon: "✉", label: "Génération",      desc: "JSON structuré + score"  },
]

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
        transition: "all 0.3s var(--ease-spring)", flexShrink: 0,
      }}>
        {done ? "✓" : n}
      </div>
      <span style={{
        fontFamily: "'Space Grotesk', sans-serif", fontWeight: active || done ? 700 : 500,
        fontSize: "0.8rem",
        color: active ? "var(--orange)" : done ? "var(--turquoise)" : "var(--fg-muted)",
        transition: "color 0.3s ease",
      }}>{label}</span>
    </div>
  )
}

export default function LettrePage() {
  const [offerText,   setOfferText]   = useState("")
  const [preferences, setPreferences] = useState("")
  const [loading,     setLoading]     = useState(false)
  const [activeStep,  setActiveStep]  = useState(-1)
  const [error,       setError]       = useState("")
  const [result,      setResult]      = useState<RunResult | null>(null)
  const [activeTab,   setActiveTab]   = useState<"lettre" | "analyse">("lettre")
  const [step,        setStep]        = useState<1|2|3>(1)

  // Animation pipeline pendant génération
  useEffect(() => {
    if (!loading) { setActiveStep(-1); return }
    let s = 0; setActiveStep(0)
    const iv = setInterval(() => { s = (s + 1) % PIPELINE_STEPS.length; setActiveStep(s) }, 1800)
    return () => clearInterval(iv)
  }, [loading])

  const handleGenerate = async () => {
    if (!offerText.trim()) { setError("Colle le texte de l'offre."); return }
    setError(""); setLoading(true); setResult(null); setStep(1)
    try {
      const form = new FormData()
      form.append("offre_texte", offerText)
      form.append("preferences", preferences)
      form.append("mode", "letter_only")

      const res  = await fetch(`${API}/run`, { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `Erreur ${res.status}`)
      setResult(data)
      setActiveTab("lettre")
      setStep(2)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }

  const downloadDocx = () => {
    if (!result?.docx_path) return
    const filename = result.docx_path.split("/").pop() || "lettre.docx"
    window.open(getDownloadLettreUrl(filename), "_blank")
  }

  const downloadMd = () => {
    if (!result?.lettre_md) return
    const a = Object.assign(document.createElement("a"), {
      href:     URL.createObjectURL(new Blob([result.lettre_md], { type: "text/markdown" })),
      download: `lettre_${result.metadata?.entreprise || "candidature"}.md`,
    })
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── Header ── */}
      <div className="animate-in">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", background: "var(--orange)", color: "#fff", padding: "0.15rem 0.6rem", border: "1.5px solid var(--border-col)" }}>LM</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            RAG · Sélection auto · 4 étapes · Score qualité · Export DOCX
          </span>
        </div>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.4rem", color: "var(--fg)", letterSpacing: "-0.03em" }}>
          Générer & exporter une lettre
        </h1>
        <p style={{ color: "var(--fg-muted)", fontSize: "0.9rem", maxWidth: "580px", lineHeight: 1.7 }}>
          Colle l'offre — le système sélectionne automatiquement le meilleur CV de ta base, analyse l'entreprise, génère une lettre ultra-ciblée et tu l'exportes en DOCX directement ici.
        </p>
      </div>

      {/* ── Indicateur étapes globales ── */}
      <div className="animate-in stagger-1" style={{
        display: "flex", alignItems: "center", gap: "1rem",
        padding: "1rem 1.25rem",
        background: "var(--bg-surface)", border: "1.5px solid var(--border-col)", boxShadow: "var(--shadow-sm)",
      }}>
        <StepBadge n={1} label="Coller l'offre"        active={step === 1} done={step > 1} />
        <div style={{ flex: 1, height: 1, background: step > 1 ? "var(--turquoise)" : "var(--border-col)", transition: "background 0.5s ease" }} />
        <StepBadge n={2} label="Lettre générée"         active={step === 2} done={step > 2} />
        <div style={{ flex: 1, height: 1, background: step > 2 ? "var(--turquoise)" : "var(--border-col)", transition: "background 0.5s ease" }} />
        <StepBadge n={3} label="Exporter en DOCX"       active={step === 3} done={false} />
      </div>

      {/* ── Pipeline interne (animé pendant la génération) ── */}
      <div className="animate-in stagger-2" style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        border: "1.5px solid var(--border-col)", background: "var(--bg-surface)", overflow: "hidden",
      }}>
        {PIPELINE_STEPS.map((s, i) => (
          <div key={s.label} style={{
            padding: "0.75rem 1rem",
            background: loading && activeStep === i ? "rgba(10,191,188,0.06)" : "transparent",
            borderRight: i < 3 ? "1px solid var(--border-col)" : "none",
            transition: "background 0.3s ease",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.9rem", color: loading && activeStep === i ? "var(--turquoise)" : "var(--fg-dim)", transition: "color 0.3s ease" }}>
                {s.icon}
              </span>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.72rem", color: loading && activeStep === i ? "var(--fg)" : "var(--fg-muted)", transition: "color 0.3s ease" }}>
                  {s.label}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {s.desc}
                </div>
              </div>
              {loading && activeStep === i && <span className="spinner spinner-dark" style={{ marginLeft: "auto", width: 12, height: 12, borderWidth: 2 }} />}
              {!loading && result && <span style={{ marginLeft: "auto", color: "var(--turquoise)", fontSize: "0.7rem" }}>✓</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Inputs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.25rem" }}>

        <Card title="Offre d'emploi" tag="REQUIS" tagColor="orange" animate stagger={3}>
          <textarea
            className="input"
            value={offerText}
            onChange={e => setOfferText(e.target.value)}
            placeholder={"Entreprise : PayFlow\nPoste : Développeur Python Senior\n\nNous recherchons un développeur backend autonome et orienté impact..."}
            rows={12}
            style={{ lineHeight: 1.7 }}
          />
          <div style={{ marginTop: "0.4rem", display: "flex", justifyContent: "flex-end" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)" }}>
              {offerText.length} caractères
            </span>
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Card title="Préférences" tag="OPTIONNEL" tagColor="turquoise" animate stagger={4}>
            <textarea
              className="input"
              value={preferences}
              onChange={e => setPreferences(e.target.value)}
              placeholder={"Ex : insiste sur la rigueur\nmets en avant l'anglais\nton startup, direct et concis"}
              rows={5}
              style={{ lineHeight: 1.7 }}
            />
          </Card>

          {/* Info pipeline */}
          <div style={{ padding: "1rem", border: "1.5px solid var(--border-col)", background: "var(--bg-raised)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              ✉ Ce que fait le pipeline
            </div>
            {[
              "Analyse le ton de l'entreprise",
              "Sélectionne le CV le plus pertinent",
              "Extrait les faits vérifiables (anti-hallucination)",
              "Génère en JSON structuré p1/p2/p3",
              "Note la qualité → sauvegarde dans le RAG",
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--turquoise)", marginTop: "0.1rem" }}>→</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.68rem", color: "var(--fg-muted)", lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="animate-in" style={{ padding: "0.875rem 1rem", border: "1.5px solid #e05252", background: "rgba(224,82,82,0.06)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.8rem", color: "#e05252", display: "flex", gap: "0.75rem" }}>
          <span>✗</span> {error}
        </div>
      )}

      {/* Bouton */}
      <PushButton variant="primary" size="lg" fullWidth loading={loading} onClick={handleGenerate}>
        {!loading && "✉ Générer la lettre depuis ma base"}
      </PushButton>

      {/* Skeleton */}
      {loading && (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1rem" }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
            <div style={{ width: 150, border: "1.5px solid var(--border-col)", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Skeleton variant="score" /><Skeleton variant="text" /><Skeleton variant="text" />
            </div>
          </div>
          <div style={{ border: "1.5px solid var(--border-col)", background: "var(--bg-surface)", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <Skeleton variant="title" width="40%" />
            {[...Array(5)].map((_, i) => <Skeleton key={i} variant="text" />)}
          </div>
        </div>
      )}

      {/* ── Résultat ── */}
      {result && !loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Séparateur */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ flex: 1, height: "1.5px", background: "var(--border-col)" }} />
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--turquoise)", textTransform: "uppercase", letterSpacing: "0.1em", padding: "0.2rem 0.75rem", border: "1.5px solid var(--turquoise)", background: "rgba(10,191,188,0.06)" }}>
              ✓ CV sélectionné : {result.match?.cv_name}
            </div>
            <div style={{ flex: 1, height: "1.5px", background: "var(--border-col)" }} />
          </div>

          {/* Stats en 4 blocs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1rem", alignItems: "stretch" }}>

            {/* Score qualité */}
            <div className="animate-pop stagger-1" style={{ border: "1.5px solid var(--border-col)", background: "var(--bg-surface)", boxShadow: "var(--shadow)", padding: "1.25rem" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.75rem" }}>
                Score qualité
              </div>
              <ScoreBar score={result.score_qualite ?? 0} />
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.5rem" }}>
                <span style={{ fontSize: "0.7rem", color: (result.score_qualite ?? 0) >= 75 ? "var(--turquoise)" : "var(--orange)" }}>
                  {(result.score_qualite ?? 0) >= 75 ? "✓" : "—"}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-muted)" }}>
                  {(result.score_qualite ?? 0) >= 75 ? "Sauvegardée dans le RAG" : "Score insuffisant RAG"}
                </span>
              </div>
            </div>

            {/* Entreprise */}
            <div className="animate-pop stagger-2" style={{ border: "1.5px solid var(--border-col)", background: "var(--bg-surface)", boxShadow: "var(--shadow)", padding: "1.25rem" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                Entreprise
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "1.05rem", color: "var(--fg)", marginBottom: "0.25rem" }}>
                {result.metadata?.entreprise || "—"}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "var(--fg-muted)", marginBottom: "0.4rem" }}>
                {result.metadata?.poste || ""}
              </div>
              {result.analyse_offre?.ton_entreprise && (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--turquoise)", background: "rgba(10,191,188,0.07)", border: "1px solid rgba(10,191,188,0.2)", padding: "0.2rem 0.5rem", display: "inline-block" }}>
                  {result.analyse_offre.ton_entreprise}
                </div>
              )}
            </div>

            {/* Valeurs */}
            <div className="animate-pop stagger-3" style={{ border: "1.5px solid var(--border-col)", background: "var(--bg-surface)", boxShadow: "var(--shadow)", padding: "1.25rem" }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                Valeurs intégrées
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {(result.analyse_offre?.valeurs_cles ?? []).map((v, i) => (
                  <span key={v} className={`animate-pop stagger-${i+1}`} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", background: "rgba(10,191,188,0.08)", color: "var(--turquoise)", border: "1px solid rgba(10,191,188,0.25)", padding: "0.15rem 0.4rem" }}>
                    {v}
                  </span>
                ))}
                {(result.analyse_offre?.mots_a_eviter ?? []).map((m) => (
                  <span key={m} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", background: "rgba(224,82,82,0.06)", color: "#e05252", border: "1px solid rgba(224,82,82,0.2)", padding: "0.15rem 0.4rem", textDecoration: "line-through", opacity: 0.7 }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* Export */}
            <div className="animate-pop stagger-4" style={{
              border: "1.5px solid var(--border-col)", boxShadow: "var(--shadow)",
              background: "var(--bg-raised)", padding: "1.25rem",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "0.75rem", minWidth: "150px",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "2rem", color: "var(--orange)", lineHeight: 1 }}>✉</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.78rem", color: "var(--fg)" }}>Prête</div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.6rem", color: "var(--fg-dim)" }}>.md · .docx</div>
              </div>
              <PushButton variant="secondary" size="sm" onClick={downloadDocx}
                style={{ background: "var(--orange)", color: "#fff", width: "100%", justifyContent: "center" }}>
                ↓ DOCX
              </PushButton>
              <PushButton variant="secondary" size="sm" onClick={downloadMd}
                style={{ width: "100%", justifyContent: "center" }}>
                ↓ Markdown
              </PushButton>
            </div>
          </div>

          {/* Onglets */}
          <div className="tab-bar">
            {[
              { key: "lettre",  label: "✉ Lettre générée"    },
              { key: "analyse", label: "⬡ Analyse entreprise" },
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

          {/* Analyse */}
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
                <Card title="Valeurs intégrées" tagColor="turquoise">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {result.analyse_offre.valeurs_cles.map((v, i) => (
                      <span key={v} className={`animate-pop stagger-${i+1}`} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", background: "rgba(10,191,188,0.1)", color: "var(--turquoise)", border: "1.5px solid rgba(10,191,188,0.3)", padding: "0.25rem 0.6rem" }}>✓ {v}</span>
                    ))}
                  </div>
                </Card>
                <Card title="Mots bannis" tagColor="orange">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {result.analyse_offre.mots_a_eviter.map((m, i) => (
                      <span key={m} className={`animate-pop stagger-${i+1}`} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", background: "rgba(224,82,82,0.07)", color: "#e05252", border: "1.5px solid rgba(224,82,82,0.25)", padding: "0.25rem 0.6rem", textDecoration: "line-through" }}>✗ {m}</span>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Bouton étape 3 */}
          <div className="animate-in stagger-5" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1.25rem", border: "1.5px solid var(--border-col)", background: "var(--bg-surface)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "var(--fg)", marginBottom: "0.2rem" }}>
                Télécharger la lettre
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "var(--fg-muted)" }}>
                La lettre est générée avec ton template DOCX — prête à envoyer.
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <PushButton variant="secondary" size="sm" onClick={downloadMd}>↓ Markdown</PushButton>
              <PushButton variant="primary" onClick={downloadDocx}>↓ Télécharger DOCX</PushButton>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

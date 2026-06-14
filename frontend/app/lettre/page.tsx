"use client"

import { useState, useEffect } from "react"
import PushButton from "@/components/PushButton"
import Card from "@/components/Card"
import MarkdownView from "@/components/MarkdownView"
import ScoreBar from "@/components/ScoreBar"
import { generateLetter, getCvs, getDownloadLettreUrl } from "@/lib/api"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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

export default function LettrePage() {
  const [offerText,    setOfferText]    = useState("")
  const [preferences,  setPreferences]  = useState("")
  const [cvs,          setCvs]          = useState<CvItem[]>([])
  const [selectedCv,   setSelectedCv]   = useState("")
  const [loading,      setLoading]      = useState(false)
  const [loadingCvs,   setLoadingCvs]   = useState(true)
  const [error,        setError]        = useState("")
  const [result,       setResult]       = useState<LetterResult | null>(null)
  const [activeTab,    setActiveTab]    = useState<"lettre" | "analyse">("lettre")

  useEffect(() => {
    getCvs()
      .then(d => { setCvs(d.cvs || []); if (d.cvs?.length) setSelectedCv(d.cvs[0].name) })
      .catch(() => setError("Impossible de charger la liste des CVs."))
      .finally(() => setLoadingCvs(false))
  }, [])

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

  const downloadDocx = () => {
    if (!result?.docx_filename) return
    window.open(getDownloadLettreUrl(result.docx_filename), "_blank")
  }

  const downloadMd = () => {
    if (!result?.lettre_md) return
    const blob = new Blob([result.lettre_md], { type: "text/markdown;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = result.docx_filename?.replace(".docx", ".md") || "lettre.md"
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── Header ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem",
            background: "var(--orange)", color: "#fff",
            padding: "0.15rem 0.5rem", border: "1.5px solid var(--border-col)",
          }}>LM</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Pipeline 4 étapes · RAG · Anti-hallucination
          </span>
        </div>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.3rem", color: "var(--fg)" }}>
          Lettre de motivation
        </h1>
        <p style={{ color: "var(--fg-muted)", fontSize: "0.88rem" }}>
          Génère une lettre ultra-ciblée basée sur ton CV et l'offre — analyse du ton entreprise, RAG sur les meilleures lettres passées, structure garantie.
        </p>
      </div>

      {/* ── Inputs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

        {/* Offre */}
        <Card title="Offre d'emploi" tag="TEXTE" tagColor="orange">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <textarea
              className="input"
              value={offerText}
              onChange={e => setOfferText(e.target.value)}
              placeholder="Colle ici le texte complet de l'offre d'emploi..."
              rows={14}
            />
          </div>
        </Card>

        {/* CV + Prefs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Card title="CV à utiliser" tag="SÉLECTION" tagColor="turquoise">
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {loadingCvs ? (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--fg-dim)" }}>
                  Chargement des CVs...
                </div>
              ) : cvs.length === 0 ? (
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "#e05252" }}>
                  Aucun CV trouvé dans /cvs
                </div>
              ) : (
                <>
                  <select
                    className="input"
                    value={selectedCv}
                    onChange={e => setSelectedCv(e.target.value)}
                    style={{ cursor: "pointer" }}
                  >
                    {cvs.map(cv => (
                      <option key={cv.name} value={cv.name}>{cv.name}</option>
                    ))}
                  </select>
                  {selectedCv && (
                    <div style={{
                      fontFamily:  "'IBM Plex Mono', monospace",
                      fontSize:    "0.68rem",
                      color:       "var(--fg-dim)",
                      lineHeight:  1.5,
                      padding:     "0.5rem 0.75rem",
                      background:  "var(--bg-input)",
                      border:      "1px solid var(--border-col)",
                      maxHeight:   "80px",
                      overflow:    "hidden",
                    }}>
                      {cvs.find(c => c.name === selectedCv)?.preview || ""}...
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card title="Préférences" tag="OPTIONNEL" tagColor="turquoise">
            <textarea
              className="input"
              value={preferences}
              onChange={e => setPreferences(e.target.value)}
              placeholder="Ex : insiste sur la rigueur, mets en avant l'anglais, ton startup..."
              rows={5}
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
        {!loading && "✉ Générer la lettre de motivation"}
      </PushButton>

      {/* ── Résultats ── */}
      {result && (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Barre de stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1rem", alignItems: "stretch" }}>

            {/* Score qualité */}
            <Card title="Score qualité" tag={`${result.score_qualite}/100`}
              tagColor={result.score_qualite >= 75 ? "turquoise" : "orange"}>
              <ScoreBar score={result.score_qualite} />
              <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "var(--fg-dim)", marginTop: "0.5rem" }}>
                {result.score_qualite >= 75 ? "✓ Sauvegardée dans le RAG" : "✗ Score trop bas pour le RAG"}
              </p>
            </Card>

            {/* Entreprise / Poste */}
            <Card title="Entreprise" tagColor="orange">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "1rem", color: "var(--fg)" }}>
                  {result.metadata?.entreprise || "—"}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "var(--fg-muted)" }}>
                  {result.metadata?.poste || "Poste non détecté"}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)", marginTop: "0.25rem" }}>
                  {result.analyse_offre?.ton_entreprise || ""}
                </div>
              </div>
            </Card>

            {/* RAG */}
            <Card title="RAG" tagColor="turquoise">
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "1.5rem", fontWeight: 700, color: "var(--turquoise)" }}>
                  {result.rag_exemples}
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "var(--fg-muted)" }}>
                  exemple{result.rag_exemples > 1 ? "s" : ""} utilisé{result.rag_exemples > 1 ? "s" : ""}
                </div>
                {result.analyse_offre?.valeurs_cles?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.25rem" }}>
                    {result.analyse_offre.valeurs_cles.map(v => (
                      <span key={v} style={{
                        fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem",
                        background: "rgba(10,191,188,0.12)", color: "var(--turquoise)",
                        border: "1px solid rgba(10,191,188,0.3)", padding: "0.1rem 0.4rem",
                      }}>{v}</span>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Export */}
            <div style={{
              border: "1.5px solid var(--border-col)", boxShadow: "4px 4px 0px var(--shadow-col)",
              background: "var(--bg-raised)", padding: "1.25rem",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: "0.75rem", minWidth: "160px",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "1.8rem", color: "var(--orange)", lineHeight: 1 }}>
                ✉
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.78rem", color: "var(--fg)" }}>
                  Lettre prête
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)" }}>
                  .md + .docx
                </div>
              </div>
              <PushButton variant="secondary" size="sm" onClick={downloadDocx}
                style={{ background: "var(--orange)", color: "#fff", boxShadow: "3px 3px 0px rgba(255,255,255,0.15)", width: "100%" }}>
                ↓ DOCX
              </PushButton>
              <PushButton variant="secondary" size="sm" onClick={downloadMd}
                style={{ width: "100%" }}>
                ↓ Markdown
              </PushButton>
            </div>
          </div>

          {/* Onglets */}
          <div className="tab-bar">
            {[
              { key: "lettre",  label: "✉ Lettre générée" },
              { key: "analyse", label: "🔍 Analyse entreprise" },
            ].map(t => (
              <button key={t.key} className={`tab ${activeTab === t.key ? "active" : ""}`}
                onClick={() => setActiveTab(t.key as "lettre" | "analyse")}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Lettre */}
          {activeTab === "lettre" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                <PushButton variant="secondary" size="sm" onClick={downloadMd}>↓ .md</PushButton>
                <PushButton variant="primary" size="sm" onClick={downloadDocx}>↓ Télécharger DOCX</PushButton>
              </div>
              <MarkdownView content={result.lettre_md} label="Lettre de motivation" maxHeight="600px" />
            </div>
          )}

          {/* Analyse entreprise */}
          {activeTab === "analyse" && result.analyse_offre && (
            <Card title="Analyse de l'offre" tag="HAIKU" tagColor="turquoise">
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <div className="label" style={{ marginBottom: "0.4rem" }}>Ton de l'entreprise</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.84rem", color: "var(--fg)", lineHeight: 1.6 }}>
                      {result.analyse_offre.ton_entreprise}
                    </div>
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: "0.4rem" }}>Profil recherché</div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.84rem", color: "var(--fg)", lineHeight: 1.6 }}>
                      {result.analyse_offre.profil_exact}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="label" style={{ marginBottom: "0.4rem" }}>Ce qui différencie cette entreprise</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.84rem", color: "var(--fg)", lineHeight: 1.6 }}>
                    {result.analyse_offre.points_differenciants}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <div className="label" style={{ marginBottom: "0.4rem" }}>Valeurs clés</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {result.analyse_offre.valeurs_cles.map(v => (
                        <span key={v} style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem",
                          background: "rgba(10,191,188,0.12)", color: "var(--turquoise)",
                          border: "1.5px solid rgba(10,191,188,0.3)", padding: "0.2rem 0.55rem",
                        }}>{v}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: "0.4rem" }}>Mots évités</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {result.analyse_offre.mots_a_eviter.map(m => (
                        <span key={m} style={{
                          fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem",
                          background: "rgba(224,82,82,0.08)", color: "#e05252",
                          border: "1.5px solid rgba(224,82,82,0.3)", padding: "0.2rem 0.55rem",
                          textDecoration: "line-through",
                        }}>{m}</span>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </Card>
          )}

        </div>
      )}
    </div>
  )
}

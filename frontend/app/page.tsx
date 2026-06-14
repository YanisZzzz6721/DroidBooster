"use client"
 
import { useState, useRef } from "react"
import { runPipeline, type RunResult } from "@/lib/api"
import PushButton from "@/components/PushButton"
import Card from "@/components/Card"
import ScoreBar from "@/components/ScoreBar"
import KeywordBadge from "@/components/KeywordBadge"
import MarkdownView from "@/components/MarkdownView"
 
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
 
// ─── Constantes ───────────────────────────────────────────────────────────────
 
const MODES = [
  { value: "full",         label: "Pipeline complet", desc: "Lettre + ATS + CV"     },
  { value: "letter_only",  label: "Lettre seulement", desc: "Génère la lettre seule" },
  { value: "cv_only",      label: "CV optimisé",      desc: "Analyse ATS + CV"       },
]
 
const TABS = [
  { key: "lettre", label: "Lettre"      },
  { key: "ats",    label: "Rapport ATS" },
  { key: "cv",     label: "CV optimisé" },
  { key: "match",  label: "Match"       },
]
 
// ─── Page ─────────────────────────────────────────────────────────────────────
 
export default function Home() {
  const [offerText,   setOfferText]   = useState("")
  const [preferences, setPreferences] = useState("")
  const [mode,        setMode]        = useState("full")
  const [file,        setFile]        = useState<File | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [result,      setResult]      = useState<RunResult | null>(null)
  const [activeTab,   setActiveTab]   = useState("lettre")
  const fileRef = useRef<HTMLInputElement>(null)
 
  const handleSubmit = async () => {
    if (!offerText.trim() && !file) {
      setError("Colle le texte de l'offre ou uploade un fichier.")
      return
    }
    setError("")
    setLoading(true)
    setResult(null)
    try {
      const data = await runPipeline(offerText, preferences, mode, file)
      setResult(data)
      setActiveTab(mode === "cv_only" ? "ats" : "lettre")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }
 
  const visibleTabs = TABS.filter(t => {
    if (t.key === "lettre") return !!result?.lettre_md
    if (t.key === "ats")    return !!result?.ats
    if (t.key === "cv")     return !!result?.cv_optimise_md
    if (t.key === "match")  return !!result?.match
    return false
  })
 
  // Extrait le nom du fichier depuis le chemin retourné par le backend
  const lettreDocxFilename = result?.docx_path
    ? result.docx_path.split("/").pop()
    : null
 
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
 
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
          <span style={{
            fontFamily:  "'IBM Plex Mono', monospace",
            fontSize:    "0.72rem",
            background:  "var(--orange)",
            color:       "var(--white)",
            padding:     "0.15rem 0.5rem",
            border:      "1.5px solid var(--black)",
          }}>
            PIPELINE
          </span>
        </div>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.3rem" }}>Générer</h1>
        <p style={{ color: "var(--gray-600)", fontSize: "0.88rem" }}>
          Dépose une offre d'emploi, configure tes préférences et lance le pipeline.
        </p>
      </div>
 
      {/* ── Formulaire ─────────────────────────────────────────────────────── */}
      <Card title="Offre d'emploi" tag="ÉTAPE 1" tagColor="turquoise">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
 
          {/* Textarea offre */}
          <div>
            <label className="label">Texte de l'offre</label>
            <textarea
              className="input"
              value={offerText}
              onChange={e => setOfferText(e.target.value)}
              placeholder="Colle ici le texte complet de l'offre d'emploi..."
              rows={6}
            />
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ color: "var(--gray-400)", fontSize: "0.8rem" }}>ou</span>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  fontFamily:     "'IBM Plex Mono', monospace",
                  fontSize:       "0.75rem",
                  color:          "var(--turquoise)",
                  background:     "transparent",
                  border:         "none",
                  cursor:         "pointer",
                  textDecoration: "underline",
                  padding:        0,
                }}
              >
                {file ? `📄 ${file.name}` : "Uploader un PDF"}
              </button>
              {file && (
                <button
                  onClick={() => setFile(null)}
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize:   "0.72rem",
                    color:      "#c0392b",
                    background: "transparent",
                    border:     "none",
                    cursor:     "pointer",
                    padding:    0,
                  }}
                >
                  ✗ Retirer
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md"
                style={{ display: "none" }}
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
 
          {/* Préférences */}
          <div>
            <label className="label">
              Préférences IA{" "}
              <span style={{ color: "var(--gray-400)", textTransform: "none", letterSpacing: 0 }}>
                (optionnel)
              </span>
            </label>
            <textarea
              className="input"
              value={preferences}
              onChange={e => setPreferences(e.target.value)}
              placeholder="Ex : insiste sur l'expérience SNCF, lettre courte et directe, ton dynamique..."
              rows={2}
            />
          </div>
 
          {/* Mode */}
          <div>
            <label className="label">Mode</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
              {MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMode(m.value)}
                  style={{
                    padding:    "0.75rem",
                    textAlign:  "left",
                    cursor:     "pointer",
                    border:     mode === m.value ? "2px solid var(--black)" : "2px solid var(--gray-200)",
                    background: mode === m.value ? "var(--black)" : "var(--white)",
                    boxShadow:  mode === m.value ? "3px 3px 0px var(--orange)" : "none",
                    transition: "all 0.1s ease",
                  }}
                >
                  <div style={{
                    fontFamily:   "'Space Grotesk', sans-serif",
                    fontWeight:   700,
                    fontSize:     "0.82rem",
                    color:        mode === m.value ? "var(--white)" : "var(--black)",
                    marginBottom: "0.2rem",
                  }}>
                    {m.label}
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize:   "0.68rem",
                    color:      "var(--gray-400)",
                  }}>
                    {m.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
 
          {/* Erreur */}
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
 
          {/* Submit */}
          <PushButton variant="primary" size="lg" fullWidth loading={loading} onClick={handleSubmit}>
            {!loading && "⚡ Lancer le pipeline"}
          </PushButton>
 
        </div>
      </Card>
 
      {/* ── Résultats ──────────────────────────────────────────────────────── */}
      {result && (
        <div className="animate-in" style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
 
          {/* Score summary */}
          <div style={{
            display: "grid",
            gridTemplateColumns: result.ats ? "1fr 1fr 2fr" : "1fr 3fr",
            gap: "1rem",
          }}>
            <div style={{
              border: "2px solid var(--black)", boxShadow: "4px 4px 0px var(--black)",
              padding: "1rem", background: "var(--white)", textAlign: "center",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>Match</div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "2.2rem", color: "var(--turquoise)", lineHeight: 1 }}>
                {result.match.match_score}
              </div>
            </div>
 
            {result.ats && (
              <div style={{
                border: "2px solid var(--black)", boxShadow: "4px 4px 0px var(--black)",
                padding: "1rem", background: "var(--white)", textAlign: "center",
              }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>ATS</div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "2.2rem", lineHeight: 1,
                  color: result.ats.score >= 70 ? "var(--turquoise)" : result.ats.score >= 50 ? "var(--orange)" : "#c0392b",
                }}>
                  {result.ats.score}
                </div>
              </div>
            )}
 
            <div style={{
              border: "2px solid var(--black)", boxShadow: "4px 4px 0px var(--black)",
              padding: "1rem", background: "var(--black)", display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "var(--white)", marginBottom: "0.3rem" }}>
                {result.match.cv_name}
              </div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "#666", lineHeight: 1.5 }}>
                {result.match.selection_reason}
              </div>
            </div>
          </div>
 
          {/* Onglets */}
          {visibleTabs.length > 0 && (
            <>
              <div className="tab-bar">
                {visibleTabs.map(t => (
                  <button
                    key={t.key}
                    className={`tab ${activeTab === t.key ? "active" : ""}`}
                    onClick={() => setActiveTab(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
 
              <div className="animate-in">
 
                {/* ── LETTRE ── */}
                {activeTab === "lettre" && result.lettre_md && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {lettreDocxFilename && (
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
                        <button
                          onClick={() => fetch(`${API}/open-in-libreoffice/${lettreDocxFilename}`)}
                          className="btn-sm"
                          style={{
                            fontFamily:  "'IBM Plex Mono', monospace",
                            fontSize:    "0.75rem",
                            background:  "var(--white)",
                            border:      "2px solid var(--black)",
                            boxShadow:   "2px 2px 0px var(--black)",
                            padding:     "0.35rem 0.85rem",
                            cursor:      "pointer",
                            color:       "var(--black)",
                          }}
                        >
                          ✎ Ouvrir dans LibreOffice
                        </button>
                        <a
                          href={`${API}/download-lettre/${lettreDocxFilename}?t=${Date.now()}`}
                          className="btn-primary btn-sm"
                          style={{ textDecoration: "none" }}
                          download
                        >
                          ↓ Télécharger (.docx)
                        </a>
                      </div>
                    )}
                    <MarkdownView content={result.lettre_md} label="Lettre de motivation" />
                  </div>
                )}
 
                {/* ── ATS ── */}
                {activeTab === "ats" && result.ats && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <Card title="Score ATS" tag={`${result.ats.score}/100`} tagColor={result.ats.score >= 70 ? "turquoise" : "orange"}>
                      <ScoreBar score={result.ats.score} />
                      <p style={{ marginTop: "1rem", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.78rem", color: "var(--gray-600)", lineHeight: 1.6 }}>
                        {result.ats.summary}
                      </p>
                    </Card>
 
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <Card title={`Mots-clés présents (${result.ats.keywords_found.length})`} tagColor="turquoise">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {result.ats.keywords_found.map((k: string) => <KeywordBadge key={k} word={k} variant="found" />)}
                        </div>
                      </Card>
                      <Card title={`Mots-clés manquants (${result.ats.keywords_missing.length})`} tagColor="orange">
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                          {result.ats.keywords_missing.map((k: string) => <KeywordBadge key={k} word={k} variant="missing" />)}
                        </div>
                      </Card>
                    </div>
 
                    <Card title="Suggestions d'amélioration">
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {result.ats.suggestions.map((s: string, i: number) => (
                          <div key={i} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", background: "var(--orange)", color: "var(--white)", padding: "0.1rem 0.4rem", border: "1.5px solid var(--black)", flexShrink: 0, marginTop: "0.1rem" }}>
                              {i + 1}
                            </span>
                            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", color: "var(--black)", lineHeight: 1.6 }}>
                              {s}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                )}
 
                {/* ── CV ── */}
                {activeTab === "cv" && result.cv_optimise_md && (
                  <MarkdownView content={result.cv_optimise_md} label="CV optimisé" />
                )}
 
                {/* ── MATCH ── */}
                {activeTab === "match" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <Card title="Mots-clés de l'offre">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {result.match.job_keywords.map((k: string) => <KeywordBadge key={k} word={k} variant="neutral" />)}
                      </div>
                    </Card>
                    <Card title="Points forts du CV">
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {result.match.cv_keywords.map((k: string) => <KeywordBadge key={k} word={k} variant="found" />)}
                      </div>
                    </Card>
                  </div>
                )}
 
              </div>
            </>
          )}
 
        </div>
      )}
 
    </div>
  )
}
 
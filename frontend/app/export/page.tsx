"use client"

import { useState, useRef } from "react"
import PushButton from "@/components/PushButton"
import Card from "@/components/Card"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Experience {
  poste:      string
  entreprise: string
  date:       string
  bullets:    string[]
}

interface Competence {
  label:       string
  description: string
  bullets:     string[]
}

interface Formation {
  diplome:     string
  institution: string
  date:        string
  description: string
}

interface Section {
  type:   string
  titre:  string
  texte?: string
  items?: any[]
}

interface CvData {
  nom:      string
  titre:    string
  contact:  Record<string, string>
  sections: Section[]
}

interface ExportEntry {
  id:         number
  created_at: string
  cv_nom:     string
  cv_titre:   string
  template:   string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(s: string) {
  return new Date(s).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  })
}

function InputField({ label, value, onChange, mono = false, style = {} }: {
  label: string; value: string; onChange: (v: string) => void
  mono?: boolean; style?: React.CSSProperties
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, color: "var(--gray-text)" }}>
        {label}
      </label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", padding: "8px 12px",
          border: "2px solid var(--black)",
          fontFamily: mono ? "'IBM Plex Mono', monospace" : "'Space Grotesk', sans-serif",
          fontSize: 13, background: "var(--white)", outline: "none",
          boxSizing: "border-box", ...style
        }}
      />
    </div>
  )
}

function TextareaField({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, color: "var(--gray-text)" }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        style={{
          width: "100%", padding: "8px 12px",
          border: "2px solid var(--black)",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12, background: "var(--white)", outline: "none",
          resize: "vertical", boxSizing: "border-box"
        }}
      />
    </div>
  )
}

// ─── Composant section expérience éditaable ────────────────────────────────────

function ExpEditor({ exp, idx, onChange }: {
  exp: Experience; idx: number
  onChange: (idx: number, field: string, value: any) => void
}) {
  return (
    <div style={{ border: "1px solid var(--gray)", padding: 16, marginBottom: 12, background: "#FAFAF8" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Expérience {idx + 1}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <InputField label="Poste" value={exp.poste} onChange={v => onChange(idx, "poste", v)} />
        <InputField label="Entreprise / Ville" value={exp.entreprise} onChange={v => onChange(idx, "entreprise", v)} />
      </div>
      <InputField label="Dates" value={exp.date} onChange={v => onChange(idx, "date", v)} mono />
      {exp.bullets.map((b, bi) => (
        <InputField
          key={bi}
          label={`Point ${bi + 1}`}
          value={b}
          onChange={v => {
            const newBullets = [...exp.bullets]
            newBullets[bi] = v
            onChange(idx, "bullets", newBullets)
          }}
          mono
        />
      ))}
    </div>
  )
}

// ─── Composant section compétence éditable ────────────────────────────────────

function CompEditor({ comp, idx, onChange }: {
  comp: Competence; idx: number
  onChange: (idx: number, field: string, value: string) => void
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 10, alignItems: "start" }}>
      <InputField label={`Label ${idx + 1}`} value={comp.label} onChange={v => onChange(idx, "label", v)} />
      <InputField label="Description" value={comp.description} onChange={v => onChange(idx, "description", v)} mono />
    </div>
  )
}

// ─── Page principale ───────────────────────────────────────────────────────────

export default function ExportPage() {
  const [step,          setStep]          = useState<"input" | "edit">("input")
  const [cvMarkdown,    setCvMarkdown]    = useState("")
  const [cvData,        setCvData]        = useState<CvData | null>(null)
  const [templateFile,  setTemplateFile]  = useState<File | null>(null)
  const [templateName,  setTemplateName]  = useState("")
  const [lieu,          setLieu]          = useState("")
  const [parsing,       setParsing]       = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState("")
  const [downloadUrl,   setDownloadUrl]   = useState("")
  const [downloadName,  setDownloadName]  = useState("")
  const [history,       setHistory]       = useState<ExportEntry[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  const mdInputRef  = useRef<HTMLInputElement>(null)
  const tplInputRef = useRef<HTMLInputElement>(null)

  // ── Import fichier .md
  function handleMdFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setCvMarkdown(ev.target?.result as string)
    reader.readAsText(file)
  }

  function handleTemplateFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setTemplateFile(file)
    setTemplateName(file.name)
  }

  // ── Parse le markdown via le backend
  async function handleParse() {
    if (!cvMarkdown.trim()) { setError("Le CV Markdown est vide."); return }
    setError("")
    setParsing(true)
    try {
      const res  = await fetch(`${API}/parse-cv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv_markdown: cvMarkdown }),
      })
      if (!res.ok) throw new Error("Erreur lors du parsing.")
      const data: CvData = await res.json()
      setCvData(data)
      setStep("edit")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }

  // ── Modifie une expérience
  function updateExp(idx: number, field: string, value: any) {
    if (!cvData) return
    const sections = cvData.sections.map(s => {
      if (s.type !== "experiences") return s
      const items = [...(s.items || [])]
      items[idx] = { ...items[idx], [field]: value }
      return { ...s, items }
    })
    setCvData({ ...cvData, sections })
  }

  // ── Modifie une compétence
  function updateComp(idx: number, field: string, value: string) {
    if (!cvData) return
    const sections = cvData.sections.map(s => {
      if (s.type !== "competences") return s
      const items = [...(s.items || [])]
      items[idx] = { ...items[idx], [field]: value }
      return { ...s, items }
    })
    setCvData({ ...cvData, sections })
  }

  // ── Modifie le profil
  function updateProfil(texte: string) {
    if (!cvData) return
    const sections = cvData.sections.map(s =>
      s.type === "profil" ? { ...s, texte } : s
    )
    setCvData({ ...cvData, sections })
  }

  // ── Reconstruit le Markdown depuis cvData édité
  function rebuildMarkdown(): string {
    if (!cvData) return cvMarkdown
    const lines: string[] = []

    lines.push(`# ${cvData.nom}`)
    lines.push(`**${cvData.titre}**`)
    lines.push("")

    for (const section of cvData.sections) {
      lines.push(`## ${section.titre}`)
      lines.push("")

      if (section.type === "profil") {
        lines.push(section.texte || "")
        lines.push("")
      }

      if (section.type === "competences") {
        for (const c of (section.items || [])) {
          lines.push(`**${c.label}** : ${c.description}`)
        }
        lines.push("")
      }

      if (section.type === "experiences") {
        for (const exp of (section.items || [])) {
          lines.push(`### ${exp.poste} — ${exp.entreprise}`)
          lines.push(exp.date)
          for (const b of exp.bullets) {
            lines.push(`- ${b}`)
          }
          lines.push("")
        }
      }

      if (section.type === "formation") {
        for (const f of (section.items || [])) {
          const inst = f.institution ? ` — ${f.institution}` : ""
          const date = f.date ? ` (${f.date})` : ""
          lines.push(`- **${f.diplome}**${inst}${date}`)
        }
        lines.push("")
      }

      if (section.type === "generic") {
        lines.push(section.texte || "")
        lines.push("")
      }
    }

    return lines.join("\n")
  }

  function buildFilename(): string {
    const titre    = cvData?.titre || cvMarkdown.match(/^\*\*(.+?)\*\*/m)?.[1] || "cv"
    const titreSafe = titre.replace(/[^a-z0-9]/gi, "_").toLowerCase()
    const lieuSafe  = lieu.trim().replace(/[^a-z0-9]/gi, "_").toLowerCase()
    return lieuSafe ? `cv_${titreSafe}_${lieuSafe}.docx` : `cv_${titreSafe}.docx`
  }

  // ── Export DOCX
  async function handleExport() {
    setError("")
    setDownloadUrl("")
    if (!templateFile) { setError("Uploade un template .docx."); return }

    const finalMarkdown = rebuildMarkdown()

    setLoading(true)
    try {
      const form = new FormData()
      form.append("cv_markdown", finalMarkdown)
      form.append("template",    templateFile)
      form.append("lieu",        lieu.trim())

      const res = await fetch(`${API}/export-docx`, { method: "POST", body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }))
        throw new Error(err.detail || `Erreur ${res.status}`)
      }

      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const filename = buildFilename()

      const a = document.createElement("a")
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click(); document.body.removeChild(a)

      setDownloadUrl(url)
      setDownloadName(filename)
      if (historyLoaded) loadHistory()

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadHistory() {
    try {
      const res  = await fetch(`${API}/export-history`)
      const data = await res.json()
      setHistory(data)
      setHistoryLoaded(true)
    } catch { setHistory([]) }
  }

  async function handleDelete(id: number) {
    await fetch(`${API}/export-history/${id}`, { method: "DELETE" })
    setHistory(h => h.filter(e => e.id !== id))
  }

  // ── Sections parsées
  const profilSection  = cvData?.sections.find(s => s.type === "competences")
  const expSection     = cvData?.sections.find(s => s.type === "experiences")
  const compSection    = cvData?.sections.find(s => s.type === "competences")
  const profilSec      = cvData?.sections.find(s => s.type === "profil")

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <span style={{ display: "inline-block", background: "var(--orange)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", letterSpacing: 1 }}>EXPORT</span>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>
          CV <span style={{ color: "var(--turquoise)" }}>→</span> DOCX
        </h1>
        <p style={{ color: "var(--gray-text)", marginTop: 6, fontSize: 14 }}>
          Colle ton CV en Markdown, edite les champs, génère le DOCX.
        </p>
      </div>

      {/* ══ ÉTAPE 1 — INPUT MARKDOWN ══ */}
      <div style={{ border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)", marginBottom: 24 }}>
        <div style={{ padding: "12px 20px", borderBottom: "2px solid var(--black)", background: "var(--black)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Etape 1 — Ton CV Markdown
          </span>
          {step === "edit" && (
            <button
              onClick={() => setStep("input")}
              style={{ background: "none", border: "1px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: "3px 10px", fontSize: 11 }}
            >
              Modifier le markdown
            </button>
          )}
        </div>

        {step === "input" && (
          <div style={{ padding: 20 }}>
            <textarea
              value={cvMarkdown}
              onChange={e => setCvMarkdown(e.target.value)}
              rows={14}
              style={{
                width: "100%", padding: 16, border: "none", outline: "none",
                resize: "vertical", fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12, background: "var(--white)", boxSizing: "border-box",
              }}
              placeholder={"# Prénom NOM\n**Titre du poste**\n\n## Profil\n...\n\n## Competences\n**Label** : description\n\n## Experiences\n### Poste — Entreprise\nDate\n- bullet\n\n## Formation\n..."}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <label className="btn-secondary btn-sm" style={{ cursor: "pointer" }}>
                Importer un .md
                <input ref={mdInputRef} type="file" accept=".md,.txt" style={{ display: "none" }} onChange={handleMdFile} />
              </label>
              {cvMarkdown && (
                <span style={{ fontSize: 12, color: "var(--turquoise)", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {cvMarkdown.split("\n").length} lignes
                </span>
              )}
              <div style={{ flex: 1 }} />
              <PushButton variant="primary" size="md" loading={parsing} onClick={handleParse}>
                Analyser le CV
              </PushButton>
            </div>
          </div>
        )}

        {step === "edit" && cvData && (
          <div style={{ padding: "12px 20px", background: "#edfafa", fontSize: 13, color: "var(--turquoise)", fontFamily: "'IBM Plex Mono', monospace" }}>
            CV parsé : <strong>{cvData.nom}</strong> — {cvData.titre}
          </div>
        )}
      </div>

      {/* ══ ÉTAPE 2 — ÉDITEUR ══ */}
      {step === "edit" && cvData && (
        <div style={{ border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)", marginBottom: 24 }}>
          <div style={{ padding: "12px 20px", borderBottom: "2px solid var(--black)", background: "var(--black)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Etape 2 — Edite ton CV
            </span>
          </div>

          <div style={{ padding: 24 }}>

            {/* Nom + Titre */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid var(--gray)" }}>
              <InputField label="Nom complet" value={cvData.nom} onChange={v => setCvData({ ...cvData, nom: v })} />
              <InputField label="Titre du poste" value={cvData.titre} onChange={v => setCvData({ ...cvData, titre: v })} />
            </div>

            {/* Profil */}
            {profilSec && (
              <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid var(--gray)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--turquoise)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Profil
                </div>
                <TextareaField
                  label="Texte du profil"
                  value={profilSec.texte || ""}
                  onChange={updateProfil}
                  rows={4}
                />
              </div>
            )}

            {/* Compétences */}
            {compSection && compSection.items && compSection.items.length > 0 && (
              <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid var(--gray)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--turquoise)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Competences ({compSection.items.length})
                </div>
                {compSection.items.map((c: Competence, i: number) => (
                  <CompEditor key={i} comp={c} idx={i} onChange={updateComp} />
                ))}
              </div>
            )}

            {/* Expériences */}
            {expSection && expSection.items && expSection.items.length > 0 && (
              <div style={{ marginBottom: 24, paddingBottom: 24, borderBottom: "1px solid var(--gray)" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--turquoise)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Experiences ({expSection.items.length})
                </div>
                {expSection.items.map((exp: Experience, i: number) => (
                  <ExpEditor key={i} exp={exp} idx={i} onChange={updateExp} />
                ))}
              </div>
            )}

            {/* Formation */}
            {cvData.sections.filter(s => s.type === "formation").map((s, si) => (
              <div key={si} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--turquoise)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
                  Formation
                </div>
                {(s.items || []).map((f: Formation, fi: number) => (
                  <div key={fi} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 10, marginBottom: 8 }}>
                    <InputField label="Diplôme" value={f.diplome} onChange={v => {
                      const sections = cvData.sections.map(sec => {
                        if (sec.type !== "formation") return sec
                        const items = [...(sec.items || [])]
                        items[fi] = { ...items[fi], diplome: v }
                        return { ...sec, items }
                      })
                      setCvData({ ...cvData, sections })
                    }} />
                    <InputField label="Institution" value={f.institution} onChange={v => {
                      const sections = cvData.sections.map(sec => {
                        if (sec.type !== "formation") return sec
                        const items = [...(sec.items || [])]
                        items[fi] = { ...items[fi], institution: v }
                        return { ...sec, items }
                      })
                      setCvData({ ...cvData, sections })
                    }} />
                    <InputField label="Date" value={f.date} onChange={v => {
                      const sections = cvData.sections.map(sec => {
                        if (sec.type !== "formation") return sec
                        const items = [...(sec.items || [])]
                        items[fi] = { ...items[fi], date: v }
                        return { ...sec, items }
                      })
                      setCvData({ ...cvData, sections })
                    }} mono />
                  </div>
                ))}
              </div>
            ))}

          </div>
        </div>
      )}

      {/* ══ ÉTAPE 3 — TEMPLATE + EXPORT ══ */}
      {step === "edit" && (
        <div style={{ border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)", marginBottom: 24 }}>
          <div style={{ padding: "12px 20px", borderBottom: "2px solid var(--black)", background: "var(--black)" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Etape 3 — Template et telechargement
            </span>
          </div>
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Upload template */}
            <label style={{
              display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
              border: "2px dashed var(--gray)", cursor: "pointer",
              background: templateFile ? "#edfafa" : "var(--white)",
            }}>
              <span style={{ fontSize: 24 }}>📎</span>
              <span style={{ fontSize: 14, color: templateFile ? "var(--turquoise)" : "var(--gray-text)" }}>
                {templateFile ? `${templateName} — Prêt` : "Clique pour choisir ton template .docx"}
              </span>
              <input ref={tplInputRef} type="file" accept=".docx" style={{ display: "none" }} onChange={handleTemplateFile} />
            </label>

            {/* Lieu */}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6, color: "var(--gray-text)" }}>
                Entreprise / Lieu (optionnel — pour nommer le fichier)
              </label>
              <input
                value={lieu}
                onChange={e => setLieu(e.target.value)}
                placeholder="Ex : McDonald's Wolfisheim, Tonton Gateau..."
                style={{
                  width: "100%", padding: "10px 14px",
                  border: "2px solid var(--black)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 13, background: "var(--white)", outline: "none",
                }}
              />
            </div>

            {error && (
              <div style={{ background: "#fff0f0", border: "2px solid #e00", color: "#c00", padding: "12px 16px", fontSize: 13 }}>
                {error}
              </div>
            )}

            <PushButton variant="primary" size="lg" loading={loading} onClick={handleExport} style={{ width: "100%" }}>
              Generer et telecharger le DOCX
            </PushButton>

            {downloadUrl && (
              <div style={{ border: "2px solid var(--turquoise)", boxShadow: "4px 4px 0 var(--turquoise)", background: "#edfafa", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 22, color: "var(--turquoise)", fontWeight: 700 }}>✓</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{downloadName}</div>
                  <div style={{ fontSize: 12, color: "var(--gray-text)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                    Généré le {new Date().toLocaleString("fr-FR")}
                  </div>
                </div>
                <a href={downloadUrl} download={downloadName} className="btn-secondary btn-sm" style={{ textDecoration: "none" }}>
                  Retelecharger
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ HISTORIQUE ══ */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Historique <span style={{ color: "var(--turquoise)" }}>exports</span></h2>
          <PushButton variant="secondary" size="sm" onClick={loadHistory}>
            {historyLoaded ? "Rafraichir" : "Charger"}
          </PushButton>
        </div>
        {historyLoaded && (
          history.length === 0 ? (
            <div style={{ padding: "24px", border: "2px dashed var(--gray)", color: "var(--gray-text)", textAlign: "center", fontSize: 13 }}>
              Aucun export.
            </div>
          ) : (
            <div style={{ border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)" }}>
              {history.map((entry, i) => (
                <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderBottom: i < history.length - 1 ? "1px solid var(--gray)" : "none" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{entry.cv_nom}</div>
                    <div style={{ fontSize: 12, color: "var(--gray-text)", marginTop: 2 }}>{entry.cv_titre}</div>
                    <div style={{ fontSize: 11, color: "var(--gray-text)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                      {formatDate(entry.created_at)} · {entry.template}
                    </div>
                  </div>
                  <a href={`${API}/export-history/${entry.id}/download`} className="btn-secondary btn-sm" style={{ textDecoration: "none" }}>↓</a>
                  <button onClick={() => handleDelete(entry.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", fontSize: 15, padding: "2px 4px" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "red")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--gray-text)")}>
                    x
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>

    </div>
  )
}
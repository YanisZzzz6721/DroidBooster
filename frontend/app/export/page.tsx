"use client"
 
import { useState, useRef } from "react"
import PushButton from "@/components/PushButton"
import Card from "@/components/Card"
 
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
 
interface ExportEntry {
  id:         number
  created_at: string
  cv_nom:     string
  cv_titre:   string
  template:   string
}
 
export default function ExportPage() {
  const [cvMarkdown,    setCvMarkdown]    = useState("")
  const [templateFile,  setTemplateFile]  = useState<File | null>(null)
  const [templateName,  setTemplateName]  = useState("")
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState("")
  const [downloadUrl,   setDownloadUrl]   = useState("")
  const [downloadName,  setDownloadName]  = useState("")
  const [history,       setHistory]       = useState<ExportEntry[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [lieu,          setLieu]          = useState("")
 
  const mdInputRef  = useRef<HTMLInputElement>(null)
  const tplInputRef = useRef<HTMLInputElement>(null)
 
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

  function buildFilename(): string {
    const titre = cvMarkdown.match(/^\*\*(.+?)\*\*/m)?.[1] || "cv"
    const titreSafe = titre.replace(/[^a-z0-9]/gi, "_").toLowerCase()
    const lieuSafe  = lieu.trim().replace(/[^a-z0-9]/gi, "_").toLowerCase()
    return lieuSafe ? `cv_${titreSafe}_${lieuSafe}.docx` : `cv_${titreSafe}.docx`
  }
 
  async function handleExport() {
    setError("")
    setDownloadUrl("")
 
    if (!cvMarkdown.trim()) { setError("Le CV Markdown est vide."); return }
    if (!templateFile)       { setError("Uploade un template .docx."); return }
 
    setLoading(true)
    try {
      const form = new FormData()
      form.append("cv_markdown", cvMarkdown)
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
 
      // Téléchargement automatique immédiat
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

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
    } catch {
      setHistory([])
    }
  }
 
  async function handleDelete(id: number) {
    await fetch(`${API}/export-history/${id}`, { method: "DELETE" })
    setHistory(h => h.filter(e => e.id !== id))
  }
 
  function formatDate(s: string) {
    return new Date(s).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    })
  }
 
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
 
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <span style={{
          display: "inline-block", background: "var(--orange)", color: "#fff",
          fontSize: 11, fontWeight: 700, padding: "3px 10px", letterSpacing: 1,
        }}>EXPORT</span>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>
          CV <span style={{ color: "var(--turquoise)" }}>→</span> DOCX
        </h1>
        <p style={{ color: "var(--gray-text)", marginTop: 6, fontSize: 15 }}>
          Colle ton CV optimisé en Markdown, uploade ton template, génère le DOCX.
        </p>
      </div>
 
      {/* Grid 2 colonnes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
 
        {/* CV Markdown */}
        <Card header={{ title: "TON CV", tag: { label: "MARKDOWN", color: "turquoise" } }}>
          <textarea
            value={cvMarkdown}
            onChange={e => setCvMarkdown(e.target.value)}
            className="textarea-mono"
            style={{ minHeight: 320, width: "100%", padding: 16, border: "none", outline: "none", resize: "vertical", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, background: "var(--white)" }}
            placeholder={"# Prénom NOM\n**Titre du poste**\n\n## Profil\n...\n\n## Expériences\n..."}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--gray)" }}>
            <label className="btn-secondary btn-sm" style={{ cursor: "pointer" }}>
              ↑ Importer un .md
              <input ref={mdInputRef} type="file" accept=".md,.txt" style={{ display: "none" }} onChange={handleMdFile} />
            </label>
            {cvMarkdown && (
              <span style={{ fontSize: 12, color: "var(--turquoise)", fontFamily: "'IBM Plex Mono', monospace" }}>
                ✓ {cvMarkdown.split("\n").length} lignes
              </span>
            )}
          </div>
        </Card>
 
        {/* Template */}
        <Card header={{ title: "TON TEMPLATE", tag: { label: "DOCX", color: "orange" } }}>
          <label style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", gap: 12, padding: "48px 24px", cursor: "pointer",
            background: templateFile ? "#edfafa" : "var(--white)", minHeight: 200,
            transition: "background 0.15s",
          }}>
            <span style={{ fontSize: 36 }}>📎</span>
            {templateFile ? (
              <span style={{ fontSize: 14, color: "var(--turquoise)", fontWeight: 600, textAlign: "center" }}>
                📄 {templateName}<br />
                <small style={{ fontWeight: 400, color: "var(--gray-text)" }}>Prêt à l'emploi</small>
              </span>
            ) : (
              <span style={{ fontSize: 14, color: "var(--gray-text)", textAlign: "center", lineHeight: 1.6 }}>
                Clique pour choisir ton template<br />
                <small>Fichier .docx avec tes styles</small>
              </span>
            )}
            <input ref={tplInputRef} type="file" accept=".docx" style={{ display: "none" }} onChange={handleTemplateFile} />
          </label>
          <div style={{ padding: "14px 18px", borderTop: "1px solid var(--gray)", fontSize: 12, color: "var(--gray-text)", lineHeight: 1.6 }}>
            <strong>Balises détectées :</strong> {"{"}Profil{"}"}, {"{{"}Intitulé_poste{"}}"}, {"{"}compétence1{"}"}, expériences...
          </div>
        </Card>
 
      </div>
 
      {/* Champ lieu */}
      <div style={{ marginBottom: 16 }}>
        <label style={{
          display: "block", fontSize: 11, fontWeight: 700,
          letterSpacing: 1, marginBottom: 8, textTransform: "uppercase"
        }}>
          Entreprise / Lieu ciblé <span style={{ color: "var(--gray-text)", fontWeight: 400, textTransform: "none" }}>(optionnel — pour nommer le fichier)</span>
        </label>
        <input
          type="text"
          value={lieu}
          onChange={e => setLieu(e.target.value)}
          placeholder="Ex : McDonald's Wolfisheim, La Couronne, BioBurger..."
          style={{
            width: "100%",
            padding: "12px 16px",
            border: "2px solid var(--black)",
            boxShadow: "3px 3px 0 var(--black)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13,
            background: "var(--white)",
            outline: "none",
          }}
        />
        {lieu && (
          <div style={{ marginTop: 6, fontSize: 12, color: "var(--gray-text)", fontFamily: "'IBM Plex Mono', monospace" }}>
            → Fichier : <span style={{ color: "var(--turquoise)" }}>cv_serveur_{lieu.trim().replace(/\s+/g, "_").toLowerCase()}.docx</span>
          </div>
        )}
      </div>
 
      {/* Erreur */}
      {error && (
        <div style={{ background: "#fff0f0", border: "2px solid #e00", color: "#c00", padding: "12px 16px", fontSize: 14, marginBottom: 12 }}>
          ⚠ {error}
        </div>
      )}
 
      {/* Bouton */}
      <PushButton
        variant="primary"
        size="lg"
        loading={loading}
        onClick={handleExport}
        style={{ width: "100%" }}
      >
        ↓ Générer le DOCX
      </PushButton>
 
      {/* Résultat */}
      {downloadUrl && (
        <div style={{
          marginTop: 20, border: "2px solid var(--turquoise)",
          boxShadow: "4px 4px 0 var(--turquoise)", background: "#edfafa", padding: "20px 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 28, color: "var(--turquoise)", fontWeight: 700 }}>✓</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{downloadName}</div>
              <div style={{ fontSize: 12, color: "var(--gray-text)", marginTop: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
                Généré le {new Date().toLocaleString("fr-FR")}
              </div>
            </div>
            <a
              href={downloadUrl}
              download={downloadName}
              className="btn-primary btn-sm"
              style={{ textDecoration: "none" }}
            >
              ↓ Télécharger
            </a>
          </div>
        </div>
      )}
 
      {/* Historique */}
      <div style={{ marginTop: 48 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>
            Historique <span style={{ color: "var(--turquoise)" }}>exports</span>
          </h2>
          <PushButton variant="secondary" size="sm" onClick={loadHistory}>
            {historyLoaded ? "↺ Rafraîchir" : "◎ Charger"}
          </PushButton>
        </div>
 
        {historyLoaded && (
          history.length === 0 ? (
            <div style={{ padding: "32px 24px", border: "2px solid var(--gray)", color: "var(--gray-text)", textAlign: "center", fontSize: 14 }}>
              Aucun export pour l'instant.
            </div>
          ) : (
            <div style={{ border: "2px solid var(--black)", boxShadow: "4px 4px 0 var(--black)" }}>
              {history.map((entry, i) => (
                <div key={entry.id} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "14px 18px",
                  borderBottom: i < history.length - 1 ? "1px solid var(--gray)" : "none",
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{entry.cv_nom}</div>
                    <div style={{ fontSize: 12, color: "var(--gray-text)", marginTop: 2 }}>{entry.cv_titre}</div>
                    <div style={{ fontSize: 11, color: "var(--gray-text)", fontFamily: "'IBM Plex Mono', monospace", marginTop: 2 }}>
                      {formatDate(entry.created_at)} · {entry.template}
                    </div>
                  </div>
                  <a
                    href={`${API}/export-history/${entry.id}/download`}
                    className="btn-secondary btn-sm"
                    style={{ textDecoration: "none" }}
                  >
                    ↓
                  </a>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-text)", fontSize: 16, padding: "2px 4px" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "red")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--gray-text)")}
                  >
                    ✕
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
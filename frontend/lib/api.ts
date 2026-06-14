const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
 
// ─── PIPELINE ────────────────────────────────────────────────────────────────────
 
export async function runPipeline(
  offerText:   string,
  preferences: string,
  mode:        string,
  file?:       File,
) {
  const form = new FormData()
  form.append("offre_texte", offerText)
  form.append("preferences", preferences)
  form.append("mode",        mode)
  if (file) form.append("file", file)
 
  const res = await fetch(`${API}/run`, { method: "POST", body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }))
    throw new Error(err.detail || `Erreur ${res.status}`)
  }
  return res.json()
}
 
// ─── OPTIMISER ───────────────────────────────────────────────────────────────────
 
export async function optimizeCV(offerText: string, cvContent: string, preferences: string) {
  const form = new FormData()
  form.append("offre_texte", offerText)
  form.append("cv_content",  cvContent)
  form.append("preferences", preferences)
 
  const res = await fetch(`${API}/ats-custom`, { method: "POST", body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }))
    throw new Error(err.detail || `Erreur ${res.status}`)
  }
  return res.json()
}
 
// ─── EXPORT CV → DOCX ────────────────────────────────────────────────────────────
 
export async function exportDocx(cvMarkdown: string, templateFile: File): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData()
  form.append("cv_markdown", cvMarkdown)
  form.append("template",    templateFile)
 
  const res = await fetch(`${API}/export-docx`, { method: "POST", body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }))
    throw new Error(err.detail || `Erreur ${res.status}`)
  }
 
  const blob     = await res.blob()
  const cd       = res.headers.get("content-disposition") || ""
  const match    = cd.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] || "cv_export.docx"
 
  return { blob, filename }
}
 
export async function getExportHistory(limit = 20) {
  const res = await fetch(`${API}/export-history?limit=${limit}`)
  if (!res.ok) throw new Error("Erreur chargement historique exports")
  return res.json()
}
 
export async function deleteExport(id: number) {
  const res = await fetch(`${API}/export-history/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Erreur suppression export")
  return res.json()
}
 
// ─── HISTORIQUE CANDIDATURES ─────────────────────────────────────────────────────
 
export async function getHistory(limit = 20) {
  const res = await fetch(`${API}/history?limit=${limit}`)
  if (!res.ok) throw new Error("Erreur chargement historique")
  return res.json()
}
 
export async function getHistoryDetail(id: number) {
  const res = await fetch(`${API}/history/${id}`)
  if (!res.ok) throw new Error("Candidature introuvable")
  return res.json()
}
 
export async function deleteHistory(id: number) {
  const res = await fetch(`${API}/history/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Erreur suppression")
  return res.json()
}
 
// ─── CVS ─────────────────────────────────────────────────────────────────────────

export async function getCvs() {
  const res = await fetch(`${API}/cvs`)
  if (!res.ok) throw new Error("Erreur chargement CVs")
  return res.json()
}

// ─── LETTRE DE MOTIVATION ────────────────────────────────────────────────────────

export async function generateLetter(offerText: string, cvName: string, preferences: string) {
  const res = await fetch(`${API}/generate-letter`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ offre_texte: offerText, cv_name: cvName, preferences }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }))
    throw new Error(err.detail || `Erreur ${res.status}`)
  }
  return res.json()
}

export function getDownloadLettreUrl(filename: string) {
  return `${API}/download-lettre/${filename}`
}

// ─── GÉNÉRATION CV ───────────────────────────────────────────────────────────────

export async function generateCv(offerText: string, cvContent: string, cvName: string, preferences: string) {
  const res = await fetch(`${API}/generate-cv`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ offre_texte: offerText, cv_content: cvContent, cv_name: cvName, preferences }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }))
    throw new Error(err.detail || `Erreur ${res.status}`)
  }
  return res.json()
}

// ─── RAG STATS ───────────────────────────────────────────────────────────────────

export async function getRagStats() {
  const res = await fetch(`${API}/rag/stats`)
  if (!res.ok) throw new Error("Erreur chargement stats RAG")
  return res.json()
}
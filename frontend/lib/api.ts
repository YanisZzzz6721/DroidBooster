const API = process.env.NEXT_PUBLIC_API_URL

export interface MatchResult {
  cv_name:          string
  cv_content:       string
  match_score:      number
  job_keywords:     string[]
  cv_keywords:      string[]
  selection_reason: string
}

export interface AtsResult {
  score:            number
  keywords_found:   string[]
  keywords_missing: string[]
  suggestions:      string[]
  summary:          string
}

export interface RunResult {
  match:           MatchResult
  lettre_md?:      string
  ats?:            AtsResult
  cv_optimise_md?: string
}

export interface Candidature {
  id:          number
  created_at:  string
  offre_titre: string | null
  cv_nom:      string
  match_score: number | null
  ats_score:   number | null
}

export interface CandidatureDetail extends Candidature {
  offre_texte:    string
  lettre_md:      string | null
  cv_optimise_md: string | null
  preferences:    string | null
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Erreur inconnue" }))
    throw new Error(err.detail || `Erreur ${res.status}`)
  }
  return res.json()
}

export async function runPipeline(
  offerText: string,
  preferences: string,
  mode: string,
  file?: File | null,
): Promise<RunResult> {
  const form = new FormData()
  if (file) {
    form.append("file", file)
  } else {
    form.append("offre_texte", offerText)
  }
  form.append("preferences", preferences)
  form.append("mode", mode)
  const res = await fetch(`${API}/run`, { method: "POST", body: form })
  return handleResponse<RunResult>(res)
}

export async function optimizeCV(
  offerText: string,
  preferences: string,
): Promise<{ match: MatchResult; ats: AtsResult; cv_optimise_md: string }> {
  const form = new FormData()
  form.append("offre_texte", offerText)
  form.append("preferences", preferences)
  form.append("mode", "cv_only")
  const res = await fetch(`${API}/run`, { method: "POST", body: form })
  return handleResponse(res)
}

export async function getHistory(limit = 20): Promise<Candidature[]> {
  const res  = await fetch(`${API}/history?limit=${limit}`)
  const data = await handleResponse<{ candidatures: Candidature[] }>(res)
  return data.candidatures
}

export async function getHistoryDetail(id: number): Promise<CandidatureDetail> {
  const res = await fetch(`${API}/history/${id}`)
  return handleResponse<CandidatureDetail>(res)
}

export async function deleteHistory(id: number): Promise<void> {
  await fetch(`${API}/history/${id}`, { method: "DELETE" })
}
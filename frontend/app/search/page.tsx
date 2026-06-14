"use client"

import { useState } from "react"
import PushButton from "@/components/PushButton"
import { runPipeline } from "@/lib/api"
import { useRouter } from "next/navigation"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

const CATEGORIES = [
  { label: "Tout", value: "" },
  { label: "Restauration", value: "serveur cuisinier restauration barman" },
  { label: "Accueil", value: "hote accueil receptionniste" },
  { label: "Distribution", value: "employe polyvalent grande distribution caissier" },
  { label: "Logistique", value: "preparateur commandes logistique entrepot" },
  { label: "Animation", value: "animateur BAFA centre loisirs" },
]

interface Job {
  source:      string
  id:          string
  titre:       string
  entreprise:  string
  ville:       string
  contrat:     string
  salaire:     string
  description: string
  date:        string
  url:         string
}

export default function SearchPage() {
  const router = useRouter()
  const [poste,       setPoste]       = useState("")
  const [ville,       setVille]       = useState("Strasbourg")
  const [categorie,   setCategorie]   = useState("")
  const [jobs,        setJobs]        = useState<Job[]>([])
  const [loading,     setLoading]     = useState(false)
  const [launching,   setLaunching]   = useState<string | null>(null)
  const [error,       setError]       = useState("")
  const [searched,    setSearched]    = useState(false)

  async function handleSearch() {
    const query = poste.trim() || categorie
    if (!query) { setError("Saisis un poste ou choisis une catégorie."); return }
    setError("")
    setLoading(true)
    setJobs([])
    setSearched(false)

    try {
      const res  = await fetch(`${API}/search-jobs?poste=${encodeURIComponent(query)}&ville=${encodeURIComponent(ville)}&limit=20`)
      const data = await res.json()
      setJobs(data.jobs || [])
      setSearched(true)
    } catch {
      setError("Erreur lors de la recherche.")
    } finally {
      setLoading(false)
    }
  }

  async function handlePipeline(job: Job) {
    setLaunching(job.id)
    try {
      const form = new FormData()
      form.append("offre_texte", job.description || `${job.titre} chez ${job.entreprise} à ${job.ville}`)
      form.append("preferences", "")
      form.append("mode", "full")
      await fetch(`${API}/run`, { method: "POST", body: form })
      router.push("/history")
    } catch {
      setError("Erreur lors du lancement du pipeline.")
    } finally {
      setLaunching(null)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Header */}
      <div>
        <span style={{ display: "inline-block", background: "var(--orange)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 10px", letterSpacing: 1, marginBottom: 8 }}>
          RECHERCHE
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>
          Offres d'emploi <span style={{ color: "var(--turquoise)" }}>en direct</span>
        </h1>
        <p style={{ color: "var(--fg-muted)", marginTop: 6, fontSize: 14 }}>
          France Travail + Indeed — Lance le pipeline en un clic sur n'importe quelle offre.
        </p>
      </div>

      {/* Formulaire recherche */}
      <div style={{ border: "1.5px solid var(--border-col)", boxShadow: "4px 4px 0 var(--shadow-col)" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1.5px solid var(--border-col)", background: "var(--bg-raised)" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Criteres de recherche
          </span>
        </div>

        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Champs poste + ville */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Poste recherche
              </label>
              <input
                type="text"
                value={poste}
                onChange={e => setPoste(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Ex : Serveur, Barman, Equpier..."
                style={{
                  width: "100%", padding: "12px 14px",
                  border: "1.5px solid var(--border-col)",
                  boxShadow: "3px 3px 0 var(--shadow-col)",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 14, background: "var(--bg-surface)",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Ville
              </label>
              <input
                type="text"
                value={ville}
                onChange={e => setVille(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Ex : Strasbourg, Paris..."
                style={{
                  width: "100%", padding: "12px 14px",
                  border: "1.5px solid var(--border-col)",
                  boxShadow: "3px 3px 0 var(--shadow-col)",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 14, background: "var(--bg-surface)",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Catégories */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
              Categorie
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => setCategorie(cat.value)}
                  style={{
                    padding: "8px 16px",
                    border: "1.5px solid var(--border-col)",
                    boxShadow: categorie === cat.value ? "3px 3px 0 var(--orange)" : "3px 3px 0 var(--shadow-col)",
                    background: categorie === cat.value ? "var(--turquoise)" : "var(--bg-raised)",
                    color: categorie === cat.value ? "#fff" : "var(--fg)",
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 13, fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.1s",
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", border: "1.5px solid #e05252", background: "rgba(224,82,82,0.08)", color: "#e05252", fontSize: 13 }}>
              {error}
            </div>
          )}

          <PushButton variant="primary" size="lg" loading={loading} onClick={handleSearch} style={{ alignSelf: "flex-start" }}>
            Rechercher les offres
          </PushButton>
        </div>
      </div>

      {/* Résultats */}
      {searched && (
        <div>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "var(--fg-muted)" }}>
              {jobs.length} offre{jobs.length !== 1 ? "s" : ""} trouvee{jobs.length !== 1 ? "s" : ""}
            </span>
          </div>

          {jobs.length === 0 ? (
            <div style={{ padding: "60px 32px", border: "1.5px dashed var(--border-col)", textAlign: "center", color: "var(--fg-muted)" }}>
              Aucune offre trouvee. Essaie d'autres mots-cles ou une autre ville.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {jobs.map(job => (
                <div
                  key={job.id}
                  style={{
                    border: "1.5px solid var(--border-col)",
                    boxShadow: "4px 4px 0 var(--shadow-col)",
                    background: "var(--bg-surface)",
                    overflow: "hidden",
                  }}
                >
                  {/* Header offre */}
                  <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-col)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>
                          {job.titre}
                        </span>
                        <span style={{
                          fontSize: 10, fontFamily: "'IBM Plex Mono', monospace",
                          padding: "2px 8px",
                          background: job.source === "France Travail" ? "var(--turquoise)" : "var(--orange)",
                          color: "#fff",
                        }}>
                          {job.source}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--orange)", marginBottom: 4 }}>
                        {job.entreprise}
                      </div>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {job.ville && (
                          <span style={{ fontSize: 12, color: "var(--fg-muted)", fontFamily: "'IBM Plex Mono', monospace" }}>
                            {job.ville}
                          </span>
                        )}
                        {job.contrat && (
                          <span style={{ fontSize: 12, color: "var(--fg-muted)", fontFamily: "'IBM Plex Mono', monospace" }}>
                            {job.contrat}
                          </span>
                        )}
                        {job.salaire && (
                          <span style={{ fontSize: 12, color: "var(--turquoise)", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>
                            {job.salaire}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                      {job.url && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary btn-sm"
                          style={{ textDecoration: "none", fontSize: 12 }}
                        >
                          Voir l'offre
                        </a>
                      )}
                      <PushButton
                        variant="primary"
                        size="sm"
                        loading={launching === job.id}
                        onClick={() => handlePipeline(job)}
                      >
                        Lancer le pipeline
                      </PushButton>
                    </div>
                  </div>

                  {/* Description */}
                  {job.description && (
                    <div style={{ padding: "14px 24px" }}>
                      <p style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.7, margin: 0, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {job.description.slice(0, 300)}{job.description.length > 300 ? "..." : ""}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
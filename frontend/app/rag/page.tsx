"use client"

import { useEffect, useState } from "react"
import Card from "@/components/Card"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface SecteurStat {
  secteur:      string
  total:        number
  score_moyen:  number
}

const SECTEUR_COLORS: Record<string, string> = {
  restauration: "var(--orange)",
  accueil:      "var(--turquoise)",
  logistique:   "#8b5cf6",
  distribution: "#059669",
  animation:    "#db2777",
  informatique: "#2563eb",
  autre:        "var(--gray-400)",
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? "var(--turquoise)" : score >= 70 ? "var(--orange)" : "#c0392b"
  return (
    <span style={{
      fontFamily:  "'IBM Plex Mono', monospace",
      fontSize:    "0.75rem",
      fontWeight:  700,
      color,
      background:  "var(--white)",
      border:      `2px solid ${color}`,
      padding:     "0.1rem 0.45rem",
    }}>
      {score}/100
    </span>
  )
}

function MiniBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ height: 6, background: "var(--gray-200)", width: "100%", border: "1px solid var(--gray-300)" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: "var(--orange)", transition: "width 0.4s ease" }} />
    </div>
  )
}

export default function RagPage() {
  const [stats,   setStats]   = useState<SecteurStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")

  useEffect(() => {
    fetch(`${API}/rag/stats`)
      .then(r => {
        if (!r.ok) throw new Error(`Erreur ${r.status}`)
        return r.json()
      })
      .then(data => setStats(data.stats))
      .catch(e  => setError(e.message))
      .finally(()=> setLoading(false))
  }, [])

  const totalCvs   = stats.reduce((s, r) => s + r.total, 0)
  const maxTotal   = Math.max(...stats.map(r => r.total), 1)
  const scoreMoyen = stats.length
    ? Math.round(stats.reduce((s, r) => s + r.score_moyen * r.total, 0) / Math.max(totalCvs, 1))
    : 0

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize:   "0.72rem",
            background: "var(--black)",
            color:      "var(--white)",
            padding:    "0.15rem 0.5rem",
            border:     "1.5px solid var(--black)",
          }}>
            RAG
          </span>
        </div>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.3rem" }}>Base d'apprentissage</h1>
        <p style={{ color: "var(--gray-600)", fontSize: "0.88rem" }}>
          CVs optimisés stockés par secteur — utilisés comme exemples pour améliorer les prochaines générations.
        </p>
      </div>

      {/* Résumé global */}
      {!loading && !error && stats.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          {[
            { label: "CVs générés",   value: totalCvs,                   color: "var(--turquoise)" },
            { label: "Secteurs",      value: stats.length,               color: "var(--orange)"    },
            { label: "Score moyen",   value: `${scoreMoyen}/100`,        color: scoreMoyen >= 85 ? "var(--turquoise)" : "var(--orange)" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              border:     "2px solid var(--black)",
              boxShadow:  "4px 4px 0px var(--black)",
              padding:    "1rem",
              background: "var(--white)",
              textAlign:  "center",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.3rem" }}>
                {label}
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: "2rem", color, lineHeight: 1 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* États */}
      {loading && (
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.8rem", color: "var(--gray-400)" }}>
          Chargement…
        </div>
      )}
      {error && (
        <div style={{ padding: "0.75rem 1rem", border: "2px solid #c0392b", background: "#fdf0f0", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.8rem", color: "#c0392b" }}>
          ✗ {error}
        </div>
      )}
      {!loading && !error && stats.length === 0 && (
        <Card title="Base vide" tag="RAG" tagColor="orange">
          <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.8rem", color: "var(--gray-600)", lineHeight: 1.7 }}>
            Aucun CV optimisé en base pour l'instant.<br />
            Lance un pipeline complet ou un CV optimisé pour alimenter le RAG.
          </p>
        </Card>
      )}

      {/* Tableau par secteur */}
      {!loading && !error && stats.length > 0 && (
        <Card title="CVs par secteur" tag="BASE RAG" tagColor="turquoise">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {stats.map(row => (
              <div key={row.secteur} style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{
                      display:    "inline-block",
                      width:       10,
                      height:      10,
                      background: SECTEUR_COLORS[row.secteur] || "var(--gray-400)",
                      border:     "1.5px solid var(--black)",
                      flexShrink: 0,
                    }} />
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "0.88rem", textTransform: "capitalize" }}>
                      {row.secteur}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "var(--gray-400)" }}>
                      {row.total} CV{row.total > 1 ? "s" : ""}
                    </span>
                  </div>
                  <ScoreBadge score={row.score_moyen} />
                </div>
                <MiniBar value={row.total} max={maxTotal} />
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  )
}

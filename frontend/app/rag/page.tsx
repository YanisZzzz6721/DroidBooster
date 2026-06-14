"use client"

import { useState, useEffect } from "react"
import Card from "@/components/Card"
import { SkeletonStatRow } from "@/components/Skeleton"
import { getRagStats } from "@/lib/api"

interface SecteurStat { secteur: string; total: number; score_moyen: number }
interface RagStats {
  cvs:     { total: number; score_moyen: number; par_secteur: SecteurStat[] }
  lettres: { total: number; score_moyen: number; par_secteur: SecteurStat[] }
}

function ScoreDot({ score }: { score: number }) {
  const color = score >= 85 ? "var(--turquoise)" : score >= 70 ? "var(--orange)" : "#e05252"
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: "0.4rem", flexShrink: 0 }} />
}

function MiniBar({ value, max = 100, color = "var(--turquoise)" }: { value: number; max?: number; color?: string }) {
  return (
    <div style={{ height: 4, background: "var(--bg-input)", border: "1px solid var(--border-col)", flex: 1, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, width: `${Math.min(100, (value / max) * 100)}%`, background: color, transition: "width 0.6s ease" }} />
    </div>
  )
}

function SecteurTable({ rows, emptyLabel, accentColor }: { rows: SecteurStat[]; emptyLabel: string; accentColor: string }) {
  if (rows.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⬡</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: "0.9rem", color: "var(--fg-muted)" }}>
          {emptyLabel}
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem", color: "var(--fg-dim)", marginTop: "0.4rem" }}>
          Lance une génération pour alimenter la base
        </div>
      </div>
    )
  }
  const maxTotal = Math.max(...rows.map(r => r.total), 1)
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {rows.map((row, i) => (
        <div key={row.secteur} className={`animate-in stagger-${Math.min(i + 1, 8)}`} style={{
          display: "grid", gridTemplateColumns: "120px 1fr 60px 70px",
          alignItems: "center", gap: "1rem",
          padding: "0.6rem 0.75rem",
          background: "var(--bg-input)", border: "1px solid var(--border-col)",
        }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--fg)", textTransform: "capitalize" }}>
            {row.secteur}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <MiniBar value={row.total} max={maxTotal} color={accentColor} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.7rem", color: "var(--fg-muted)", minWidth: "24px" }}>
              {row.total}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <ScoreDot score={row.score_moyen || 0} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.75rem", color: "var(--fg)" }}>
              {row.score_moyen ?? "—"}
            </span>
          </div>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem",
            background: (row.score_moyen || 0) >= 80 ? "rgba(10,191,188,0.12)" : "rgba(232,99,10,0.12)",
            color: (row.score_moyen || 0) >= 80 ? "var(--turquoise)" : "var(--orange)",
            border: `1px solid ${(row.score_moyen || 0) >= 80 ? "rgba(10,191,188,0.3)" : "rgba(232,99,10,0.3)"}`,
            padding: "0.15rem 0.4rem", textAlign: "center",
          }}>
            {(row.score_moyen || 0) >= 80 ? "FORT" : "BON"}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function RagPage() {
  const [stats,     setStats]     = useState<RagStats | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState("")
  const [activeTab, setActiveTab] = useState<"cvs" | "lettres">("cvs")

  useEffect(() => {
    getRagStats()
      .then(setStats)
      .catch(() => setError("Impossible de charger les stats RAG."))
      .finally(() => setLoading(false))
  }, [])

  const current = stats ? (activeTab === "cvs" ? stats.cvs : stats.lettres) : null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* ── Header ── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.72rem",
            background: "var(--bg-raised)", color: "var(--turquoise)",
            padding: "0.15rem 0.5rem", border: "1.5px solid var(--turquoise)",
          }}>RAG</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Base d'apprentissage · CVs + Lettres
          </span>
        </div>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.3rem", color: "var(--fg)" }}>Base RAG</h1>
        <p style={{ color: "var(--fg-muted)", fontSize: "0.88rem" }}>
          Chaque CV et lettre de qualité ≥ 75/100 est sauvegardé ici. Les générations futures s'appuient sur cette base pour s'améliorer automatiquement.
        </p>
      </div>

      {/* ── Compteurs globaux ── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem" }}>
          {[...Array(4)].map((_, i) => <SkeletonStatRow key={i} />)}
        </div>
      ) : error ? (
        <div style={{ padding: "0.75rem 1rem", border: "1.5px solid #e05252", background: "rgba(224,82,82,0.08)", color: "#e05252", fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.8rem" }}>
          ✗ {error}
        </div>
      ) : stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem" }}>
          {[
            { label: "CVs générés",      value: stats.cvs.total,                          color: "var(--turquoise)", icon: "◈" },
            { label: "Score moyen CVs",  value: `${stats.cvs.score_moyen ?? "—"}/100`,    color: "var(--turquoise)", icon: "◎" },
            { label: "Lettres générées", value: stats.lettres.total,                       color: "var(--orange)",    icon: "✉" },
            { label: "Score moyen LM",   value: `${stats.lettres.score_moyen ?? "—"}/100`, color: "var(--orange)",   icon: "◎" },
          ].map((stat, i) => (
            <div key={stat.label} className={`animate-pop stagger-${i + 1}`} style={{
              border: "1.5px solid var(--border-col)", background: "var(--bg-surface)",
              boxShadow: "4px 4px 0px var(--shadow-col)", padding: "1.25rem",
            }}>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.65rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                {stat.icon} {stat.label}
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "1.8rem", color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Onglets CVs / Lettres ── */}
      <div className="tab-bar">
        {[
          { key: "cvs",     label: `◈ CVs (${stats?.cvs.total ?? 0})` },
          { key: "lettres", label: `✉ Lettres (${stats?.lettres.total ?? 0})` },
        ].map(t => (
          <button key={t.key} className={`tab ${activeTab === t.key ? "active" : ""}`}
            onClick={() => setActiveTab(t.key as "cvs" | "lettres")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Table par secteur ── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {[...Array(4)].map((_, i) => <SkeletonStatRow key={i} />)}
        </div>
      ) : current && (
        <Card
          title={activeTab === "cvs" ? "CVs par secteur" : "Lettres par secteur"}
          tag={`${current.par_secteur.length} secteur${current.par_secteur.length > 1 ? "s" : ""}`}
          tagColor={activeTab === "cvs" ? "turquoise" : "orange"}
        >
          {current.par_secteur.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 60px 70px", gap: "1rem", padding: "0.3rem 0.75rem", marginBottom: "0.25rem", borderBottom: "1px solid var(--border-col)" }}>
              {["Secteur", "Volume", "Score", "Niveau"].map(h => (
                <div key={h} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "0.62rem", color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {h}
                </div>
              ))}
            </div>
          )}
          <SecteurTable
            rows={current.par_secteur}
            emptyLabel={activeTab === "cvs" ? "Aucun CV dans la base" : "Aucune lettre dans la base"}
            accentColor={activeTab === "cvs" ? "var(--turquoise)" : "var(--orange)"}
          />
        </Card>
      )}

    </div>
  )
}

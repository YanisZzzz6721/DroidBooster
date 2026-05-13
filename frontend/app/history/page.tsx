"use client"

import { useEffect, useState } from "react"
import {
  getHistory,
  getHistoryDetail,
  deleteHistory,
  type Candidature,
  type CandidatureDetail,
} from "@/lib/api"
import MarkdownView from "@/components/MarkdownView"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (!score) return "text-neutral-400"
  if (score >= 70) return "text-green-600"
  if (score >= 50) return "text-yellow-600"
  return "text-red-600"
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  })
}

interface TabDef {
  key:   string
  label: string
  show:  boolean
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function History() {
  const [list,     setList]     = useState<Candidature[]>([])
  const [selected, setSelected] = useState<CandidatureDetail | null>(null)
  const [loading,  setLoading]  = useState<boolean>(true)
  const [tab,      setTab]      = useState<string>("lettre")

  useEffect(() => {
    getHistory().then(setList).finally(() => setLoading(false))
  }, [])

  const open = async (id: number): Promise<void> => {
    const detail = await getHistoryDetail(id)
    setSelected(detail)
    setTab(detail.lettre_md ? "lettre" : "cv")
  }

  const remove = async (
    id: number,
    e: React.MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    e.stopPropagation()
    await deleteHistory(id)
    setList((prev: Candidature[]) => prev.filter((c: Candidature) => c.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-neutral-400">
        Chargement...
      </div>
    )
  }

  const detailTabs: TabDef[] = selected
    ? [
        { key: "lettre", label: "Lettre",      show: !!selected.lettre_md      },
        { key: "cv",     label: "CV optimisé", show: !!selected.cv_optimise_md },
        { key: "offre",  label: "Offre",       show: !!selected.offre_texte    },
      ].filter((t: TabDef) => t.show)
    : []

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Historique</h1>
        <p className="text-sm text-neutral-500 mt-1">
          {list.length} candidature{list.length !== 1 ? "s" : ""} enregistrée{list.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 text-sm text-neutral-400">
          Aucune candidature pour l'instant. Lance ton premier pipeline sur la page Générer.
        </div>
      ) : (
        <div className="space-y-6">

          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-neutral-500">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-neutral-500">CV</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-neutral-500">Match</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium text-neutral-500">ATS</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {list.map((c: Candidature) => (
                  <tr
                    key={c.id}
                    onClick={() => open(c.id)}
                    className={`border-b border-neutral-100 last:border-0 cursor-pointer hover:bg-neutral-50 transition-colors ${
                      selected?.id === c.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-neutral-500 text-xs">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-neutral-700">{c.cv_nom}</td>
                    <td className={`px-4 py-3 text-center font-semibold ${scoreColor(c.match_score)}`}>
                      {c.match_score ?? "—"}
                    </td>
                    <td className={`px-4 py-3 text-center font-semibold ${scoreColor(c.ats_score)}`}>
                      {c.ats_score ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => remove(c.id, e)}
                        className="text-xs text-neutral-300 hover:text-red-500 transition-colors"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected && (
            <div className="space-y-4">

              <div className="flex items-center justify-between">
                <h2 className="font-medium text-neutral-700">
                  Détail — {selected.cv_nom}
                </h2>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs text-neutral-400 hover:text-neutral-700"
                >
                  Fermer
                </button>
              </div>

              <div className="flex gap-1 border-b border-neutral-200">
                {detailTabs.map((t: TabDef) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
                      tab === t.key
                        ? "border-blue-600 text-blue-600 font-medium"
                        : "border-transparent text-neutral-500 hover:text-neutral-900"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {tab === "lettre" && selected.lettre_md && (
                <MarkdownView content={selected.lettre_md} label="Lettre de motivation" />
              )}
              {tab === "cv" && selected.cv_optimise_md && (
                <MarkdownView content={selected.cv_optimise_md} label="CV optimisé" />
              )}
              {tab === "offre" && (
                <MarkdownView content={selected.offre_texte} label="Offre d'emploi" />
              )}

            </div>
          )}

        </div>
      )}

    </div>
  )
}
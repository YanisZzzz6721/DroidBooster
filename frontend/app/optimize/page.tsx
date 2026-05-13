"use client"

import { useState } from "react"
import { optimizeCV, type AtsResult, type MatchResult } from "@/lib/api"
import MarkdownView from "@/components/MarkdownView"

export default function Optimize() {
  const [offerText,   setOfferText]   = useState("")
  const [preferences, setPreferences] = useState("")
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState("")
  const [match,       setMatch]       = useState<MatchResult | null>(null)
  const [ats,         setAts]         = useState<AtsResult | null>(null)
  const [cvMd,        setCvMd]        = useState("")
  const [activeTab,   setActiveTab]   = useState<"ats" | "cv">("ats")

  const handleSubmit = async () => {
    if (!offerText.trim()) {
      setError("Colle le texte de l'offre.")
      return
    }
    setError("")
    setLoading(true)
    setMatch(null)
    setAts(null)
    setCvMd("")
    try {
      const data = await optimizeCV(offerText, preferences)
      setMatch(data.match)
      setAts(data.ats)
      setCvMd(data.cv_optimise_md)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Optimiser un CV</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Analyse ATS de ton CV face à une offre et génère une version optimisée.
        </p>
      </div>

      <div className="space-y-4">

        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700">Offre d'emploi</label>
          <textarea
            value={offerText}
            onChange={e => setOfferText(e.target.value)}
            placeholder="Colle le texte de l'offre ici..."
            rows={6}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700">
            Préférences <span className="text-neutral-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            value={preferences}
            onChange={e => setPreferences(e.target.value)}
            placeholder="Ex : insiste sur la rigueur, mets en avant l'anglais..."
            rows={2}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 text-white font-medium text-sm py-2.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Analyse en cours..." : "Analyser"}
        </button>

      </div>

      {ats && match && (
        <div className="space-y-4">

          <div className="flex items-center gap-4 p-4 rounded-lg bg-white border border-neutral-200">
            <div className="text-center">
              <div className={`text-3xl font-bold ${ats.score >= 70 ? "text-green-600" : ats.score >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                {ats.score}
              </div>
              <div className="text-xs text-neutral-400">Score ATS</div>
            </div>
            <div className="h-10 w-px bg-neutral-200" />
            <div className="flex-1">
              <div className="text-sm font-medium">{match.cv_name}</div>
              <div className="text-xs text-neutral-400 mt-0.5">{ats.summary}</div>
            </div>
          </div>

          <div className="flex gap-1 border-b border-neutral-200">
            {[
              { key: "ats" as const, label: "Rapport ATS" },
              { key: "cv" as const,  label: "CV optimisé"  },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                aria-pressed={activeTab === t.key}
                className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
                  activeTab === t.key
                    ? "border-blue-600 text-blue-600 font-medium"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "ats" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-400 mb-2">✅ Présents ({ats.keywords_found.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {ats.keywords_found.map((k: string) => (
                      <span key={k} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">{k}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-400 mb-2">❌ Manquants ({ats.keywords_missing.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {ats.keywords_missing.map((k: string) => (
                      <span key={k} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full border border-red-200">{k}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-2">
                <div className="text-xs text-neutral-400">💡 Suggestions</div>
                {ats.suggestions.map((s: string, i: number) => (
                  <div key={i} className="flex gap-2 text-sm text-neutral-700">
                    <span className="text-neutral-300 shrink-0">{i + 1}.</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "cv" && cvMd && (
            <MarkdownView content={cvMd} label="CV optimisé" />
          )}

        </div>
      )}

    </div>
  )
}
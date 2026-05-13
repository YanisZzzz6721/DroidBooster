"use client"

import { useState, useRef } from "react"
import { runPipeline, type RunResult } from "@/lib/api"
import MarkdownView from "@/components/MarkdownView"

const MODES = [
  { value: "full",        label: "Pipeline complet", desc: "Lettre + ATS + CV optimisé" },
  { value: "letter_only", label: "Lettre seulement", desc: "Génère uniquement la lettre" },
  { value: "cv_only",     label: "CV optimisé",      desc: "Analyse ATS + CV réécrit"   },
]

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
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { key: "lettre", label: "Lettre",      show: !!result?.lettre_md      },
    { key: "ats",    label: "Rapport ATS", show: !!result?.ats            },
    { key: "cv",     label: "CV optimisé", show: !!result?.cv_optimise_md },
    { key: "match",  label: "Match",       show: !!result?.match          },
  ].filter(t => t.show)

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Générer</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Dépose une offre, choisis ton mode et lance le pipeline.
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400">ou</span>
            <button
              onClick={() => fileRef.current?.click()}
              className="text-xs text-blue-600 hover:underline"
            >
              {file ? `📄 ${file.name}` : "Uploader un PDF"}
            </button>
            {file && (
              <button onClick={() => setFile(null)} className="text-xs text-neutral-400 hover:text-red-500">
                Retirer
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700">
            Préférences <span className="text-neutral-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            value={preferences}
            onChange={e => setPreferences(e.target.value)}
            placeholder="Ex : insiste sur l'expérience SNCF, lettre courte et directe..."
            rows={2}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-neutral-700">Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {MODES.map(m => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                aria-pressed={mode === m.value}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  mode === m.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
                }`}
              >
                <div className="text-sm font-medium">{m.label}</div>
                <div className="text-xs text-neutral-400 mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>
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
          {loading ? "Génération en cours..." : "Lancer"}
        </button>

      </div>

      {result && (
        <div className="space-y-4">

          <div className="flex items-center gap-4 p-4 rounded-lg bg-white border border-neutral-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{result.match.match_score}</div>
              <div className="text-xs text-neutral-400">Match</div>
            </div>
            {result.ats && (
              <>
                <div className="h-8 w-px bg-neutral-200" />
                <div className="text-center">
                  <div className={`text-2xl font-bold ${result.ats.score >= 70 ? "text-green-600" : result.ats.score >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                    {result.ats.score}
                  </div>
                  <div className="text-xs text-neutral-400">ATS</div>
                </div>
              </>
            )}
            <div className="flex-1 ml-2">
              <div className="text-sm font-medium text-neutral-700">{result.match.cv_name}</div>
              <div className="text-xs text-neutral-400 mt-0.5">{result.match.selection_reason}</div>
            </div>
          </div>

          {tabs.length > 0 && (
            <div className="flex gap-1 border-b border-neutral-200">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
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
          )}

          {activeTab === "lettre" && result.lettre_md && (
            <MarkdownView content={result.lettre_md} label="Lettre de motivation" />
          )}

          {activeTab === "ats" && result.ats && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-400 mb-2">✅ Présents ({result.ats.keywords_found.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {result.ats.keywords_found.map((k: string) => (
                      <span key={k} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">{k}</span>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="text-xs text-neutral-400 mb-2">❌ Manquants ({result.ats.keywords_missing.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {result.ats.keywords_missing.map((k: string) => (
                      <span key={k} className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full border border-red-200">{k}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-2">
                <div className="text-xs text-neutral-400">💡 Suggestions</div>
                {result.ats.suggestions.map((s: string, i: number) => (
                  <div key={i} className="flex gap-2 text-sm text-neutral-700">
                    <span className="text-neutral-300 shrink-0">{i + 1}.</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "cv" && result.cv_optimise_md && (
            <MarkdownView content={result.cv_optimise_md} label="CV optimisé" />
          )}

          {activeTab === "match" && (
            <div className="rounded-lg border border-neutral-200 bg-white p-4 space-y-3">
              <div>
                <div className="text-xs text-neutral-400 mb-1">Mots-clés de l'offre</div>
                <div className="flex flex-wrap gap-1">
                  {result.match.job_keywords.map((k: string) => (
                    <span key={k} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">{k}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-neutral-400 mb-1">Points forts du CV</div>
                <div className="flex flex-wrap gap-1">
                  {result.match.cv_keywords.map((k: string) => (
                    <span key={k} className="px-2 py-0.5 bg-neutral-100 text-neutral-700 text-xs rounded-full border border-neutral-200">{k}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  )
}
"use client"

import { useState } from "react"

interface Props {
  content: string
  label?:  string
}

export default function MarkdownView({ content, label = "Contenu" }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-100 bg-neutral-50">
        <span className="text-xs font-medium text-neutral-500">{label}</span>
        <button
          onClick={copy}
          className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors px-2 py-1 rounded hover:bg-neutral-100"
        >
          {copied ? "✓ Copié" : "Copier"}
        </button>
      </div>
      <pre className="p-4 text-sm text-neutral-800 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-96">
        {content}
      </pre>
    </div>
  )
}
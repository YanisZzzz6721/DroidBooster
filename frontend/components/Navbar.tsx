"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const links = [
  { href: "/",         label: "Générer"    },
  { href: "/optimize", label: "Optimiser"  },
  { href: "/history",  label: "Historique" },
]

export default function Navbar() {
  const path = usePathname()

  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="font-semibold text-sm tracking-tight">
          AI<span className="text-blue-600">Recruit</span>
        </span>
        <div className="flex items-center gap-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                path === l.href
                  ? "bg-neutral-100 text-neutral-900 font-medium"
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
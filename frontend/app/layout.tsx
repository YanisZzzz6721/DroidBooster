import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "@/components/Sidebar"

export const metadata: Metadata = {
  title: "DroidBooster",
  description: "Automatisation de candidatures par IA",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div style={{ display: "flex", minHeight: "100vh" }}>

          {/* Sidebar fixe */}
          <Sidebar />

          {/* Contenu principal */}
          <main style={{
            flex: 1,
            marginLeft: "220px",
            padding: "2.5rem",
            maxWidth: "900px",
          }}>
            {children}
          </main>

        </div>
      </body>
    </html>
  )
}
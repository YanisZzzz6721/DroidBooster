import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "@/components/Sidebar"
import Toasts from "@/components/Toast"
import { ToastProvider } from "@/lib/toast"

export const metadata: Metadata = {
  title: "DroidBooster",
  description: "Générateur de lettres de motivation et CVs optimisés ATS",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ToastProvider>
          <Sidebar />
          <main style={{ marginLeft: "220px", padding: "2rem", minHeight: "100vh" }}>
            {children}
          </main>
          <Toasts />
        </ToastProvider>
      </body>
    </html>
  )
}
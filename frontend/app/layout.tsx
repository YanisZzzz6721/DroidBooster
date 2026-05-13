import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Navbar from "@/components/Navbar"
 
const inter = Inter({ subsets: ["latin"] })
 
export const metadata: Metadata = {
  title: "AIRecruit",
  description: "Générateur de lettres de motivation et optimiseur de CV",
}
 
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.className} bg-neutral-50 text-neutral-900 min-h-screen`}>
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-10">
          {children}
        </main>
      </body>
    </html>
  )
}
 
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MENTOR — Prof de Closing IA',
  description: 'Ton professeur de closing personnel — VDI², AVIR, vocal, mémoire des erreurs',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}

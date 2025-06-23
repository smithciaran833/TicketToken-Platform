import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TicketToken Venue Dashboard',
  description: 'Venue staff dashboard for ticket scanning and gate management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

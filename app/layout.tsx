import './globals.css'
import { VT323 } from 'next/font/google'

const pixelFont = VT323({ 
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel' 
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${pixelFont.variable} font-pixel`}>{children}</body>
    </html>
  )
}
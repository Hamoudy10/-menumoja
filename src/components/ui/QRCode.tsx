'use client'

import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Download } from 'lucide-react'
import { motion } from 'framer-motion'

interface QRCodeProps {
  value: string
  size?: number
  includeMargin?: boolean
  showDownload?: boolean
  downloadFileName?: string
  className?: string
}

export function QRCode({
  value,
  size = 200,
  includeMargin = true,
  showDownload = true,
  downloadFileName = 'menu-moja-qr.png',
  className = '',
}: QRCodeProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [downloaded, setDownloaded] = useState(false)

  const handleDownload = () => {
    const canvas = canvasRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = downloadFileName
    link.href = url
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <motion.div
        ref={canvasRef}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl bg-white p-4 shadow-soft"
      >
        <QRCodeCanvas
          value={value || 'https://menu-moja.app'}
          size={size}
          includeMargin={includeMargin}
          level="M"
        />
      </motion.div>
      {showDownload && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 font-accent text-sm font-semibold text-white transition-colors hover:bg-secondary-dark"
        >
          <Download className="h-4 w-4" />
          {downloaded ? 'Downloaded!' : 'Download QR'}
        </motion.button>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
  QrCode, Download, Printer, Share2, CheckCircle2,
  ArrowLeft, ArrowRight, PartyPopper, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useStore } from '@/store/useStore'

const qrStyles = [
  {
    id: 0,
    name: 'Classic',
    description: 'Clean rounded corners',
    bgColor: '#FFFFFF',
    fgColor: '#0A1628',
  },
  {
    id: 1,
    name: 'Branded',
    description: 'Matches your brand color',
    bgColor: '#FFFFFF',
    fgColor: '#FF6B35',
  },
  {
    id: 2,
    name: 'Dark Mode',
    description: 'Dark background, light dots',
    bgColor: '#0A1628',
    fgColor: '#FFFFFF',
  },
]

function Confetti() {
  const colors = ['#FF6B35', '#FFD700', '#2ECC71', '#3498DB', '#E74C3C', '#9B59B6', '#1ABC9C']
  const [pieces] = useState(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      delay: Math.random() * 2,
      duration: Math.random() * 2 + 2,
    }))
  )

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          className="absolute"
          style={{ left: `${piece.x}%`, top: -20 }}
          animate={{
            y: [0, window.innerHeight + 20],
            x: [0, (Math.random() - 0.5) * 200],
            rotate: [0, piece.rotation * 3],
            opacity: [1, 0.8, 0],
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            repeat: Infinity,
            ease: 'easeIn',
          }}
        >
          <div
            className="rounded-sm"
            style={{
              width: piece.size,
              height: piece.size * 0.6,
              backgroundColor: piece.color,
              transform: `rotate(${piece.rotation}deg)`,
            }}
          />
        </motion.div>
      ))}
    </div>
  )
}

interface Props {
  onNext: () => void
  onPrev: () => void
}

export default function Step6QRGeneration({ onNext, onPrev }: Props) {
  const { onboarding, updateOnboarding } = useStore()
  const [showConfetti, setShowConfetti] = useState(true)
  const [qrMode, setQrMode] = useState<'single' | 'table'>('single')
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 6000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const base = window.location.origin
    if (qrMode === 'single') {
      setQrUrl(`${base}/menu/${onboarding.restaurantName?.toLowerCase().replace(/\s+/g, '-') || 'restaurant'}`)
    } else {
      setQrUrl(`${base}/menu/${onboarding.restaurantName?.toLowerCase().replace(/\s+/g, '-') || 'restaurant'}?table=`)
    }
  }, [qrMode, onboarding.restaurantName])

  const handleDownload = () => {
    const svg = document.getElementById('menu-moja-qr')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      canvas.width = 500
      canvas.height = 650
      ctx!.fillStyle = qrStyles[onboarding.qrStyle || 0].bgColor
      ctx!.fillRect(0, 0, canvas.width, canvas.height)
      ctx!.drawImage(img, 50, 80, 400, 400)
      ctx!.fillStyle = qrStyles[onboarding.qrStyle || 0].fgColor
      ctx!.font = 'bold 24px Inter, sans-serif'
      ctx!.textAlign = 'center'
      ctx!.fillText(onboarding.restaurantName || 'MenuMoja', 250, 540)
      ctx!.font = '14px Inter, sans-serif'
      ctx!.fillStyle = '#6B7280'
      ctx!.fillText('Scan to view menu', 250, 570)
      ctx!.fillStyle = '#FF6B35'
      ctx!.font = '12px Inter, sans-serif'
      ctx!.fillText('menu.moja', 250, 600)
      const link = document.createElement('a')
      link.download = `${onboarding.restaurantName || 'menu'}-qr.png`
      link.href = canvas.toDataURL()
      link.click()
    }
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const style = qrStyles[onboarding.qrStyle || 0]
    const qrHtml = document.getElementById('menu-moja-qr')?.outerHTML || ''
    const escapedName = (onboarding.restaurantName || 'MenuMoja').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
    const printContent = `
      <html>
        <head>
          <title>Menu QR Code</title>
          <style>
            body { display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; font-family: Inter, sans-serif; background: ${style.bgColor}; }
            .container { text-align: center; padding: 40px; }
            h1 { color: ${style.fgColor}; font-size: 28px; margin-bottom: 8px; }
            p { color: #6B7280; font-size: 14px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${escapedName}</h1>
            <p>Scan to view menu</p>
            <div id="qr">${qrHtml}</div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `
    const iframe = printWindow.document.createElement('iframe')
    iframe.style.display = 'none'
    printWindow.document.body.appendChild(iframe)
    iframe.srcdoc = printContent
    setTimeout(() => { if (printWindow) printWindow.print() }, 500)
  }

  const handleShare = async () => {
    const url = qrMode === 'single' ? qrUrl : `${qrUrl}${onboarding.tables || 10}`
    if (navigator.share) {
      try {
        await navigator.share({ title: `${onboarding.restaurantName || 'Menu'} - MenuMoja`, url })
      } catch { /* user cancelled share */ }
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {showConfetti && <Confetti />}

      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-success to-emerald-400 mb-4 shadow-lg"
        >
          <PartyPopper className="w-10 h-10 text-white" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-heading font-bold text-primary"
        >
          Your Menu is LIVE! 🎉
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-text-secondary mt-2"
        >
          Your digital menu is ready. Generate QR codes for your customers to scan.
        </motion.p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => setQrMode('single')}
          className={`p-4 rounded-xl border-2 text-center transition-all ${
            qrMode === 'single'
              ? 'border-secondary bg-secondary/5 shadow-warm'
              : 'border-gray-200 hover:border-secondary/50'
          }`}
        >
          <QrCode className="w-6 h-6 mx-auto mb-1" style={{ color: qrMode === 'single' ? '#FF6B35' : '#9CA3AF' }} />
          <span className="text-sm font-semibold">One QR for all</span>
          <p className="text-xs text-text-secondary mt-0.5">Single menu link</p>
        </button>
        <button
          onClick={() => setQrMode('table')}
          className={`p-4 rounded-xl border-2 text-center transition-all ${
            qrMode === 'table'
              ? 'border-secondary bg-secondary/5 shadow-warm'
              : 'border-gray-200 hover:border-secondary/50'
          }`}
        >
          <QrCode className="w-6 h-6 mx-auto mb-1" style={{ color: qrMode === 'table' ? '#FF6B35' : '#9CA3AF' }} />
          <span className="text-sm font-semibold">Per Table</span>
          <p className="text-xs text-text-secondary mt-0.5">Separate QR per table</p>
        </button>
      </div>

      {qrMode === 'table' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-6"
        >
          <label className="block text-xs font-accent font-semibold text-text-secondary mb-2">Number of Tables</label>
          <input
            type="number"
            value={onboarding.tables || 10}
            onChange={(e) => updateOnboarding({ tables: Math.max(1, parseInt(e.target.value) || 1) })}
            min={1}
            max={100}
            className="w-full px-4 py-2.5 rounded-xl border-2 border-gray-200 focus:border-secondary outline-none text-sm transition-all"
          />
        </motion.div>
      )}

      <div className="flex gap-6 items-start mb-6">
        <div className="flex-1 space-y-3">
          <label className="block text-xs font-accent font-semibold text-text-secondary">QR Style</label>
          {qrStyles.map((style) => (
            <button
              key={style.id}
              onClick={() => updateOnboarding({ qrStyle: style.id })}
              className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                (onboarding.qrStyle || 0) === style.id
                  ? 'border-secondary bg-secondary/5'
                  : 'border-gray-200 hover:border-secondary/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: style.bgColor }}
                >
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: style.fgColor }}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary">{style.name}</p>
                  <p className="text-xs text-text-secondary">{style.description}</p>
                </div>
                {(onboarding.qrStyle || 0) === style.id && (
                  <CheckCircle2 className="w-5 h-5 text-secondary ml-auto" />
                )}
              </div>
            </button>
          ))}
        </div>

        <Card variant="elevated" padding="lg" className="text-center shrink-0">
          <div className="bg-white rounded-xl p-4 inline-block">
            <QRCodeSVG
              id="menu-moja-qr"
              value={qrMode === 'single' ? qrUrl : `${qrUrl}1`}
              size={180}
              bgColor={qrStyles[onboarding.qrStyle || 0].bgColor}
              fgColor={qrStyles[onboarding.qrStyle || 0].fgColor}
              level="L"
              includeMargin
            />
          </div>
          <p className="text-xs text-text-secondary mt-3 font-medium">
            {onboarding.restaurantName || 'Your Restaurant'}
          </p>
          <div className="flex gap-2 mt-3 justify-center">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-light transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-white rounded-xl text-xs font-semibold hover:bg-secondary-dark transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 border-2 border-gray-200 rounded-xl text-xs font-semibold text-text-secondary hover:border-secondary/50 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          </div>
        </Card>
      </div>

      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-sm text-text-secondary">
          <Share2 className="w-4 h-4" />
          <span className="font-mono text-xs">
            {qrUrl}
          </span>
          <button
            onClick={() => navigator.clipboard.writeText(qrUrl)}
            className="text-secondary hover:text-secondary-dark transition-colors text-xs font-semibold"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onPrev} icon={<ArrowLeft className="w-4 h-4" />}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={onNext}
          fullWidth
          icon={<ArrowRight className="w-4 h-4" />}
          iconPosition="right"
        >
          Continue
        </Button>
      </div>
    </div>
  )
}

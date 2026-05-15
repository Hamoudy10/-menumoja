import { useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Palette, Type, Layout as LayoutIcon, Image as ImageIcon,
  ArrowLeft, ArrowRight, Upload, Smartphone, Grid, List,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useStore } from '@/store/useStore'

const fonts = [
  { id: 'modern', name: 'Modern', font: "'Space Grotesk', monospace", preview: 'Aa', style: 'font-accent' },
  { id: 'elegant', name: 'Elegant', font: "'Playfair Display', Georgia, serif", preview: 'Aa', style: 'font-heading' },
  { id: 'classic', name: 'Classic', font: "'Inter', system-ui, sans-serif", preview: 'Aa', style: 'font-body' },
] as const

interface Props {
  onNext: () => void
  onPrev: () => void
}

export default function Step4Appearance({ onNext, onPrev }: Props) {
  const { onboarding, updateOnboarding } = useStore()
  const logoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => updateOnboarding({ logo: ev.target?.result as string })
      reader.readAsDataURL(file)
    }
  }

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => updateOnboarding({ coverPhoto: ev.target?.result as string })
      reader.readAsDataURL(file)
    }
  }

  const PhoneMockup = () => (
    <div className="w-[280px] shrink-0">
      <div className="bg-gray-900 rounded-[40px] p-3 shadow-2xl">
        <div className="bg-white rounded-[32px] overflow-hidden">
          <div className="h-6 bg-gray-900 flex items-center justify-center">
            <div className="w-20 h-1.5 bg-gray-700 rounded-full" />
          </div>
          <div className="px-4 pt-2 pb-4">
            {onboarding.coverPhoto && (
              <img src={onboarding.coverPhoto} alt="Cover" className="w-full h-24 object-cover rounded-xl mb-3" />
            )}
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shrink-0"
                style={{ backgroundColor: onboarding.brandColor }}
              >
                {onboarding.logo ? (
                  <img src={onboarding.logo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  (onboarding.restaurantName?.[0] || 'M')
                )}
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-bold truncate"
                  style={{
                    fontFamily: fonts.find((f) => f.id === onboarding.fontStyle)?.font || fonts[0].font,
                    color: onboarding.brandColor,
                  }}
                >
                  {onboarding.restaurantName || 'Your Restaurant'}
                </p>
                <p className="text-[10px] text-gray-500 truncate">{onboarding.cuisine || 'Cuisine'}</p>
              </div>
            </div>

            {onboarding.welcomeMessage && (
              <div
                className="text-xs text-gray-600 mb-3 p-2 rounded-lg"
                style={{ backgroundColor: `${onboarding.brandColor}10` }}
              >
                {onboarding.welcomeMessage}
              </div>
            )}

            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-gray-400">Menu</span>
              <div className="flex-1 h-px bg-gray-100" />
              <button
                className="text-[10px] flex items-center gap-1"
                style={{ color: onboarding.brandColor }}
              >
                {onboarding.layout === 'grid' ? (
                  <Grid className="w-3 h-3" />
                ) : (
                  <List className="w-3 h-3" />
                )}
              </button>
            </div>

            <div className={onboarding.layout === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-lg bg-gray-50"
                  style={onboarding.layout === 'grid' ? { flexDirection: 'column', textAlign: 'center' } : {}}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: `${onboarding.brandColor}15` }}
                  >
                    {['🍕', '🍔', '🥗'][i - 1]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold truncate" style={{ fontFamily: fonts.find((f) => f.id === onboarding.fontStyle)?.font }}>
                      {['Margerita Pizza', 'Beef Burger', 'Chef Salad'][i - 1]}
                    </p>
                    <p className="text-[9px]" style={{ color: onboarding.brandColor }}>
                      KES {[850, 650, 450][i - 1].toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-heading font-bold text-primary">Customize Your Look</h2>
        <p className="text-text-secondary text-sm mt-1">Make your menu reflect your brand's personality</p>
      </div>

      <div className="flex gap-8 items-start">
        <div className="flex-1 space-y-6">
          <Card padding="lg">
            <h3 className="font-heading font-bold text-primary mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4 text-secondary" />
              Brand Color
            </h3>
            <div className="flex items-center gap-4">
              <input
                type="color"
                value={onboarding.brandColor}
                onChange={(e) => updateOnboarding({ brandColor: e.target.value })}
                className="w-16 h-16 rounded-xl border-2 border-gray-200 cursor-pointer"
              />
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={onboarding.brandColor}
                  onChange={(e) => updateOnboarding({ brandColor: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 focus:border-secondary outline-none text-sm transition-all font-mono"
                />
                <div className="flex gap-2">
                  {['#FF6B35', '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6', '#1ABC9C'].map((color) => (
                    <button
                      key={color}
                      onClick={() => updateOnboarding({ brandColor: color })}
                      className="w-7 h-7 rounded-lg border-2 border-gray-200 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <h3 className="font-heading font-bold text-primary mb-4 flex items-center gap-2">
              <Type className="w-4 h-4 text-secondary" />
              Font Style
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {fonts.map((font) => (
                <button
                  key={font.id}
                  onClick={() => updateOnboarding({ fontStyle: font.id as 'modern' | 'elegant' | 'classic' })}
                  className={`p-4 rounded-xl border-2 text-center transition-all ${
                    onboarding.fontStyle === font.id
                      ? 'border-secondary bg-secondary/5 shadow-warm'
                      : 'border-gray-200 hover:border-secondary/50'
                  }`}
                >
                  <p className="text-2xl mb-1" style={{ fontFamily: font.font }}>
                    {font.preview}
                  </p>
                  <p className="text-xs font-semibold text-text-secondary">{font.name}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card padding="lg">
            <h3 className="font-heading font-bold text-primary mb-4 flex items-center gap-2">
              <LayoutIcon className="w-4 h-4 text-secondary" />
              Menu Layout
            </h3>
            <div className="flex gap-3">
              <button
                onClick={() => updateOnboarding({ layout: 'grid' })}
                className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                  onboarding.layout === 'grid'
                    ? 'border-secondary bg-secondary/5 shadow-warm'
                    : 'border-gray-200 hover:border-secondary/50'
                }`}
              >
                <Grid className="w-8 h-8 mx-auto mb-2" style={{ color: onboarding.layout === 'grid' ? onboarding.brandColor : '#9CA3AF' }} />
                <span className="text-sm font-medium">Grid View</span>
                <p className="text-xs text-text-secondary mt-1">Card-based layout</p>
              </button>
              <button
                onClick={() => updateOnboarding({ layout: 'list' })}
                className={`flex-1 p-4 rounded-xl border-2 text-center transition-all ${
                  onboarding.layout === 'list'
                    ? 'border-secondary bg-secondary/5 shadow-warm'
                    : 'border-gray-200 hover:border-secondary/50'
                }`}
              >
                <List className="w-8 h-8 mx-auto mb-2" style={{ color: onboarding.layout === 'list' ? onboarding.brandColor : '#9CA3AF' }} />
                <span className="text-sm font-medium">List View</span>
                <p className="text-xs text-text-secondary mt-1">Compact list</p>
              </button>
            </div>
          </Card>

          <Card padding="lg">
            <h3 className="font-heading font-bold text-primary mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-secondary" />
              Photos
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-accent font-semibold text-text-secondary mb-2">Logo</label>
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    onboarding.logo ? 'border-success bg-success/5' : 'border-gray-200 hover:border-secondary/50'
                  }`}
                >
                  {onboarding.logo ? (
                    <div className="space-y-2">
                      <img src={onboarding.logo} alt="Logo" className="w-16 h-16 rounded-xl mx-auto object-cover" />
                      <p className="text-xs text-success font-medium">Uploaded ✓</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-6 h-6 text-gray-400 mx-auto" />
                      <p className="text-xs text-text-secondary">Upload logo</p>
                    </div>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-accent font-semibold text-text-secondary mb-2">Cover Photo</label>
                <div
                  onClick={() => coverInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    onboarding.coverPhoto ? 'border-success bg-success/5' : 'border-gray-200 hover:border-secondary/50'
                  }`}
                >
                  {onboarding.coverPhoto ? (
                    <div className="space-y-2">
                      <img src={onboarding.coverPhoto} alt="Cover" className="w-16 h-16 rounded-xl mx-auto object-cover" />
                      <p className="text-xs text-success font-medium">Uploaded ✓</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <ImageIcon className="w-6 h-6 text-gray-400 mx-auto" />
                      <p className="text-xs text-text-secondary">Upload cover</p>
                    </div>
                  )}
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </div>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <h3 className="font-heading font-bold text-primary mb-4 flex items-center gap-2">
              <Type className="w-4 h-4 text-secondary" />
              Welcome Message
            </h3>
            <textarea
              value={onboarding.welcomeMessage}
              onChange={(e) => updateOnboarding({ welcomeMessage: e.target.value })}
              placeholder="Welcome to our restaurant! Enjoy authentic cuisine 🌟"
              rows={2}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-secondary focus:ring-4 focus:ring-secondary/10 outline-none text-sm resize-none transition-all"
            />
          </Card>
        </div>

        <div className="hidden lg:block sticky top-8">
          <PhoneMockup />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
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

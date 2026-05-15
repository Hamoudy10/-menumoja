import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, Paintbrush } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/store/useStore'
import { useNavigate } from 'react-router-dom'

const layouts = ['grid', 'list'] as const
const fonts = ['modern', 'elegant', 'classic'] as const

export default function OnboardingAppearance() {
  const { onboarding, updateOnboarding, nextStep, prevStep } = useStore()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-heading font-bold text-primary dark:text-white">Appearance</h1>
          <p className="text-text-secondary dark:text-white/50 mt-1">Customize your menu's look and feel</p>
        </div>

        <div className="bg-white dark:bg-primary-light rounded-2xl p-6 border border-gray-100 dark:border-white/5 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            {[1, 2, 3, 4, 5, 6, 7].map((step) => (
              <div key={step} className={`flex-1 h-1.5 rounded-full ${step <= 3 ? 'bg-secondary' : step < 3 ? 'bg-success' : 'bg-gray-200 dark:bg-white/10'}`} />
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary dark:text-white mb-2">Brand Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={onboarding.brandColor}
                onChange={e => updateOnboarding({ brandColor: e.target.value })}
                className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200 dark:border-white/20"
              />
              <span className="text-sm text-text-secondary dark:text-white/60">{onboarding.brandColor}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary dark:text-white mb-2">Font Style</label>
            <div className="grid grid-cols-3 gap-2">
              {fonts.map((font) => (
                <button
                  key={font}
                  onClick={() => updateOnboarding({ fontStyle: font })}
                  className={`px-3 py-2 rounded-xl text-sm border transition-all capitalize ${
                    onboarding.fontStyle === font
                      ? 'border-secondary bg-secondary/10 text-secondary font-semibold'
                      : 'border-gray-200 dark:border-white/20 text-text-secondary dark:text-white/60 hover:border-secondary'
                  }`}
                >
                  {font}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary dark:text-white mb-2">Menu Layout</label>
            <div className="grid grid-cols-2 gap-2">
              {layouts.map((layout) => (
                <button
                  key={layout}
                  onClick={() => updateOnboarding({ layout })}
                  className={`px-3 py-4 rounded-xl text-sm border transition-all capitalize ${
                    onboarding.layout === layout
                      ? 'border-secondary bg-secondary/10 text-secondary font-semibold'
                      : 'border-gray-200 dark:border-white/20 text-text-secondary dark:text-white/60 hover:border-secondary'
                  }`}
                >
                  {layout === 'grid' ? '📱 Grid View' : '📋 List View'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6">
          <Button variant="ghost" icon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => { prevStep(); navigate('/onboarding/menu') }}>
            Back
          </Button>
          <Button variant="primary" icon={<ArrowRight className="w-4 h-4" />} iconPosition="right"
            onClick={() => { nextStep(); navigate('/onboarding/ai-setup') }}>
            Next Step
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

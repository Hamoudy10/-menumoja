import { useEffect } from 'react'
import { useTheme } from '@/components/theme/ThemeProvider'
import * as menuApi from '@/api/menu'

interface ThemePatch {
  brandColor?: string
  gradientStart?: string
  gradientEnd?: string
  useGradient?: boolean
  fontHeading?: string
  fontBody?: string
  fontAccent?: string
}

export function useRestaurantTheme(slug?: string | null) {
  const { applyTheme } = useTheme()

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    menuApi
      .getPublicMenu(slug)
      .then((data) => {
        if (cancelled) return
        const settings = data?.settings
        if (!settings) return
        const patch: ThemePatch = {}
        if (settings.primaryColor) patch.brandColor = settings.primaryColor
        if (settings.gradientStart) patch.gradientStart = settings.gradientStart
        if (settings.gradientEnd) patch.gradientEnd = settings.gradientEnd
        if (typeof settings.useGradient === 'boolean') patch.useGradient = settings.useGradient
        if (settings.headingFont) patch.fontHeading = settings.headingFont
        if (settings.bodyFont) patch.fontBody = settings.bodyFont
        if (settings.accentFont) patch.fontAccent = settings.accentFont
        if (Object.keys(patch).length > 0) applyTheme(patch)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [slug, applyTheme])
}

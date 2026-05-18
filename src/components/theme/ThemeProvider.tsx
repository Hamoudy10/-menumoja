import { useEffect, createContext, useContext, useState, useCallback } from 'react'
import { useStore } from '@/store/useStore'

interface ThemeConfig {
  brandColor: string
  gradientStart: string
  gradientEnd: string
  useGradient: boolean
  darkMode: boolean
  fontHeading: string
  fontBody: string
  fontAccent: string
}

interface ThemeContextType {
  theme: ThemeConfig
  updateTheme: (config: Partial<ThemeConfig>) => void
  generatePalette: (color: string) => Record<string, string>
}

const defaultTheme: ThemeConfig = {
  brandColor: '#FF6B35',
  gradientStart: '#FF6B35',
  gradientEnd: '#FFD700',
  useGradient: false,
  darkMode: false,
  fontHeading: 'Playfair Display',
  fontBody: 'Inter',
  fontAccent: 'Space Grotesk',
}

const ThemeContext = createContext<ThemeContextType>({
  theme: defaultTheme,
  updateTheme: () => {},
  generatePalette: () => ({}),
})

export const useTheme = () => useContext(ThemeContext)

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 255, g: 107, b: 53 }
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((x) => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

function adjustBrightness(hex: string, percent: number) {
  const { r, g, b } = hexToRgb(hex)
  const factor = 1 + percent / 100
  return rgbToHex(r * factor, g * factor, b * factor)
}

function generateColorPalette(baseColor: string): Record<string, string> {
  const { r, g, b } = hexToRgb(baseColor)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  const isLight = lum > 0.5

  return {
    '--color-primary': baseColor,
    '--color-primary-light': adjustBrightness(baseColor, isLight ? -30 : 30),
    '--color-primary-dark': adjustBrightness(baseColor, isLight ? 15 : -15),
    '--color-secondary': isLight ? adjustBrightness(baseColor, -40) : adjustBrightness(baseColor, 40),
    '--color-accent': isLight ? adjustBrightness(baseColor, 30) : adjustBrightness(baseColor, -30),
    '--color-success': '#2ECC71',
    '--color-warning': '#F39C12',
    '--color-danger': '#E74C3C',
    '--color-info': '#3498DB',
    '--color-background-light': isLight ? '#FAFAF7' : '#FFFFFF',
    '--color-background-dark': isLight ? '#060D1A' : '#0A1628',
    '--color-text-primary': isLight ? '#1A1A2E' : '#F5F5F5',
    '--color-text-secondary': isLight ? '#6B7280' : '#A0AEC0',
    '--color-glass': isLight ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.08)',
  }
}

function generateGradientPalette(start: string, end: string): Record<string, string> {
  const base = generateColorPalette(start)
  return {
    ...base,
    '--gradient-primary': `linear-gradient(135deg, ${start}, ${end})`,
    '--gradient-secondary': `linear-gradient(135deg, ${end}, ${start})`,
    '--color-primary': start,
    '--color-accent': end,
  }
}

const googleFonts = [
  { name: 'Inter', family: "'Inter', sans-serif", category: 'sans-serif' },
  { name: 'Playfair Display', family: "'Playfair Display', serif", category: 'serif' },
  { name: 'Space Grotesk', family: "'Space Grotesk', monospace", category: 'monospace' },
  { name: 'Poppins', family: "'Poppins', sans-serif", category: 'sans-serif' },
  { name: 'Roboto', family: "'Roboto', sans-serif", category: 'sans-serif' },
  { name: 'Lora', family: "'Lora', serif", category: 'serif' },
  { name: 'Montserrat', family: "'Montserrat', sans-serif", category: 'sans-serif' },
  { name: 'Open Sans', family: "'Open Sans', sans-serif", category: 'sans-serif' },
  { name: 'Raleway', family: "'Raleway', sans-serif", category: 'sans-serif' },
  { name: 'Merriweather', family: "'Merriweather', serif", category: 'serif' },
  { name: 'DM Sans', family: "'DM Sans', sans-serif", category: 'sans-serif' },
  { name: 'Nunito', family: "'Nunito', sans-serif", category: 'sans-serif' },
  { name: 'Quicksand', family: "'Quicksand', sans-serif", category: 'sans-serif' },
  { name: 'Lato', family: "'Lato', sans-serif", category: 'sans-serif' },
  { name: 'Source Sans Pro', family: "'Source Sans Pro', sans-serif", category: 'sans-serif' },
  { name: 'Caveat', family: "'Caveat', cursive", category: 'handwriting' },
  { name: 'Dancing Script', family: "'Dancing Script', cursive", category: 'handwriting' },
  { name: 'Pacifico', family: "'Pacifico', cursive", category: 'handwriting' },
  { name: 'Bebas Neue', family: "'Bebas Neue', sans-serif", category: 'display' },
  { name: 'Oswald', family: "'Oswald', sans-serif", category: 'display' },
  { name: 'Cinzel', family: "'Cinzel', serif", category: 'display' },
]

const GOOGLE_FONTS_URL = `https://fonts.googleapis.com/css2?family=${googleFonts.map(f => f.name.replace(/ /g, '+')).join(':wght@100;200;300;400;500;600;700;800;900&family=')}&display=swap`

export { googleFonts, GOOGLE_FONTS_URL }

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { restaurant, darkMode } = useStore()
  const [theme, setTheme] = useState<ThemeConfig>(() => {
    const saved = localStorage.getItem('app-theme')
    return saved ? { ...defaultTheme, ...JSON.parse(saved) } : defaultTheme
  })

  useEffect(() => {
    setTheme(prev => ({ ...prev, darkMode }))
  }, [darkMode])

  useEffect(() => {
    const style = document.documentElement.style
    const palette = theme.useGradient
      ? generateGradientPalette(theme.gradientStart, theme.gradientEnd)
      : generateColorPalette(theme.brandColor)

    Object.entries(palette).forEach(([key, value]) => {
      style.setProperty(key, value)
    })

    style.setProperty('--font-heading', theme.fontHeading)
    style.setProperty('--font-body', theme.fontBody)
    style.setProperty('--font-accent', theme.fontAccent)

    if (theme.darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    if (restaurant?.brandColor) {
      setTheme(prev => ({
        ...prev,
        brandColor: restaurant.brandColor || prev.brandColor,
        fontHeading: restaurant.fontStyle === 'elegant' ? 'Playfair Display' : restaurant.fontStyle === 'classic' ? 'Merriweather' : 'Inter',
      }))
    }
  }, [restaurant?.brandColor, restaurant?.fontStyle])

  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = GOOGLE_FONTS_URL
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  const updateTheme = useCallback((config: Partial<ThemeConfig>) => {
    setTheme(prev => {
      const next = { ...prev, ...config }
      localStorage.setItem('app-theme', JSON.stringify(next))
      return next
    })
  }, [])

  const generatePalette = useCallback((color: string) => {
    return generateColorPalette(color)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, generatePalette }}>
      {children}
    </ThemeContext.Provider>
  )
}

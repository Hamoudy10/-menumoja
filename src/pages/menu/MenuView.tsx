import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { ShoppingCart, Plus, Minus, ChefHat, MapPin, Star, Search, Loader2, CheckCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useTheme } from '@/components/theme/ThemeProvider'
import * as menuApi from '@/api/menu'

export default function MenuView() {
  const { restaurantSlug } = useParams()
  const navigate = useNavigate()
  const { categories, cart, addToCart, updateCartQuantity, setLanguage } = useStore()
  const { applyTheme } = useTheme()
  const [activeCategory, setActiveCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [restaurantInfo, setRestaurantInfo] = useState<any>(null)
  const [menuCategories, setMenuCategories] = useState<any[]>([])

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const activeOrder = JSON.parse(sessionStorage.getItem(`activeOrder_${restaurantSlug}`) || 'null')
  const showTrackOrder = activeOrder && (Date.now() - activeOrder.time < 7200000)

  useEffect(() => {
    if (!restaurantSlug) return
    let cancelled = false

    const loadMenu = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await menuApi.getPublicMenu(restaurantSlug)
        if (cancelled) return
        const restaurant = data.restaurant || data
        const cats = (data.categories || []).map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          items: cat.items || [],
        }))

        setRestaurantInfo(restaurant)
        setMenuCategories(cats)
        if (cats.length > 0) setActiveCategory(cats[0]?.id || '')
        if (restaurant?.language) setLanguage(restaurant.language)

        const settings = restaurant?.settings
        if (settings) {
          const patch: any = {}
          if (settings.primaryColor) patch.brandColor = settings.primaryColor
          if (settings.gradientStart) patch.gradientStart = settings.gradientStart
          if (settings.gradientEnd) patch.gradientEnd = settings.gradientEnd
          if (typeof settings.useGradient === 'boolean') patch.useGradient = settings.useGradient
          if (settings.headingFont) patch.fontHeading = settings.headingFont
          if (settings.bodyFont) patch.fontBody = settings.bodyFont
          if (settings.accentFont) patch.fontAccent = settings.accentFont
          if (Object.keys(patch).length) applyTheme(patch)
        }
      } catch (err: any) {
        if (cancelled) return
        setError(err?.response?.data?.message || err?.message || 'Failed to load menu')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadMenu()
    return () => { cancelled = true }
  }, [restaurantSlug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          <p className="font-accent text-xs text-text-secondary">Loading menu...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <ChefHat className="w-12 h-12 mx-auto text-text-secondary/30 mb-4" />
          <h2 className="text-xl font-heading font-bold text-primary mb-2">Menu Unavailable</h2>
          <p className="text-text-secondary text-sm mb-6">{error}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (menuCategories.length === 0) {
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <ChefHat className="w-12 h-12 mx-auto text-text-secondary/30 mb-4" />
          <h2 className="text-xl font-heading font-bold text-primary mb-2">
            {restaurantInfo?.name || 'Restaurant'} Menu
          </h2>
          <p className="text-text-secondary text-sm">Menu items coming soon!</p>
        </div>
      </div>
    )
  }

  const displayCategories = menuCategories.filter(c => !activeCategory || c.id === activeCategory || activeCategory === 'all')

  return (
    <div className="min-h-screen bg-background-light">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-soft">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-primary text-sm">
                  {restaurantInfo?.name || restaurantSlug || 'Restaurant'}
                </h1>
                <p className="text-[10px] text-text-secondary">Digital Menu</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showTrackOrder && (
                <button
                  onClick={() => navigate(`/menu/${restaurantSlug}/order/${activeOrder.id}`)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Track Order</span>
                </button>
              )}
              <button
                onClick={() => navigate(`/menu/${restaurantSlug}/cart${location.search}`)}
                className="relative w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center"
            >
              <ShoppingCart className="w-5 h-5 text-secondary" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-secondary text-[10px] font-bold text-white flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1">
            {menuCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-secondary text-white'
                    : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {displayCategories.map((category) => (
          <div key={category.id}>
            <h2 className="font-heading font-bold text-primary text-lg mb-3">{category.name}</h2>
            <div className="space-y-3">
              {category.items.map((item: any) => {
                const cartItem = cart.find(c => c.item.id === item.id)
                const qty = cartItem?.quantity || 0
                return (
                  <motion.div
                    key={item.id}
                    layout
                    className="bg-white rounded-2xl p-4 border border-gray-100 shadow-soft"
                  >
                    <div className="flex gap-3">
                      {item.photoUrl && (
                        <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-100">
                          <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-primary text-sm">{item.name}</h3>
                          {item.isFeatured && <Badge variant="success" size="sm">Popular</Badge>}
                          {item.isNew && <Badge variant="info" size="sm">New</Badge>}
                        </div>
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{item.description}</p>
                        {item.dietary && (
                          <div className="flex items-center gap-2 mt-2">
                            {item.dietary.isHalal && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-text-secondary font-medium">Halal</span>}
                            {item.dietary.isVegetarian && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-text-secondary font-medium">Vegetarian</span>}
                            {item.dietary.isVegan && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-text-secondary font-medium">Vegan</span>}
                            {item.dietary.isGlutenFree && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-text-secondary font-medium">Gluten-Free</span>}
                          </div>
                        )}
                        <p className="text-sm font-bold text-secondary mt-2">KES {item.price}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end mt-3">
                      {qty === 0 ? (
                        <button
                          onClick={() => addToCart(item)}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-secondary text-white text-sm font-medium hover:bg-secondary-dark transition-all"
                        >
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartQuantity(item.id, qty - 1)}
                            className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-primary hover:bg-gray-50"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-semibold text-primary text-sm">{qty}</span>
                          <button
                            onClick={() => addToCart(item)}
                            className="w-8 h-8 rounded-xl bg-secondary text-white flex items-center justify-center hover:bg-secondary-dark"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

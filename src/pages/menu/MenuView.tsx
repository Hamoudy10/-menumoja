import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { ShoppingCart, Plus, Minus, ChefHat, MapPin, Star, Search, Loader2, CheckCircle, Megaphone, Gift, PartyPopper, Percent, Tag, RotateCw, TrendingUp, BadgePercent, Sparkles } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Badge } from '@/components/ui/Badge'
import { BrandLoader } from '@/components/ui/BrandLoader'
import { AIChat } from '@/components/customer/AIChat'
import { useTheme } from '@/components/theme/ThemeProvider'
import * as menuApi from '@/api/menu'

const PROMO_ICONS: Record<string, any> = { SPECIAL: Star, OFFER: Percent, EVENT: PartyPopper, GIVEAWAY: Gift }
const PROMO_BADGE: Record<string, string> = {
  SPECIAL: 'bg-orange-100 text-orange-700',
  OFFER: 'bg-emerald-100 text-emerald-700',
  EVENT: 'bg-violet-100 text-violet-700',
  GIVEAWAY: 'bg-rose-100 text-rose-700',
}

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
  const [promotions, setPromotions] = useState<any[]>([])
  const [announcement, setAnnouncement] = useState('')
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [sections, setSections] = useState<{ mostPopular: any[]; bestValue: any[]; newItems: any[] }>({ mostPopular: [], bestValue: [], newItems: [] })

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  const activeOrder = JSON.parse(sessionStorage.getItem(`activeOrder_${restaurantSlug}`) || 'null')
  const showTrackOrder = activeOrder && (Date.now() - activeOrder.time < 7200000)

  const loadMenu = useCallback(async () => {
    if (!restaurantSlug) return
    setLoading(true)
    setError('')
    try {
      const data = await menuApi.getPublicMenu(restaurantSlug)
      const restaurant = data.restaurant || data
      const cats = (data.categories || []).map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        items: cat.items || [],
      }))

      setRestaurantInfo(restaurant)
      setMenuCategories(cats)
      setPromotions(data.promotions || [])
      if (cats.length > 0) setActiveCategory(cats[0]?.id || '')
      if (restaurant?.language) setLanguage(restaurant.language)

      // personalized storefront sections (aggregate data for anonymous sessions)
      try {
        const sessionKey = `menuSession_${restaurantSlug}`
        if (!sessionStorage.getItem(sessionKey)) sessionStorage.setItem(sessionKey, crypto.randomUUID())
        const personalized = await menuApi.getPersonalizedMenu(restaurantSlug, sessionStorage.getItem(sessionKey) || undefined)
        setSections({
          mostPopular: personalized?.mostPopular || [],
          bestValue: personalized?.bestValue || [],
          newItems: personalized?.newItems || [],
        })
      } catch { /* personalization is best-effort */ }

      const settings = restaurant?.settings
      if (settings?.announcementActive && settings?.announcement) {
        setAnnouncement(settings.announcement)
      }
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
      setError(err?.response?.data?.message || err?.message || 'Failed to load menu')
    } finally {
      setLoading(false)
    }
  }, [restaurantSlug, setLanguage, applyTheme])

  useEffect(() => {
    if (!restaurantSlug) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await loadMenu()
    }
    run()
    return () => { cancelled = true }
  }, [loadMenu, restaurantSlug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center">
        <BrandLoader label={`Loading ${restaurantInfo?.name || 'menu'}…`} />
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
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => loadMenu()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-white text-sm font-medium hover:bg-secondary-dark transition-colors"
          >
            <RotateCw className="w-4 h-4" /> Try Again
          </motion.button>
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
                <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center overflow-hidden">
                  {restaurantInfo?.logoUrl ? (
                    <img src={restaurantInfo.logoUrl} alt="logo" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <ChefHat className="w-5 h-5 text-white" />
                  )}
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
        {announcement && (
          <div className="flex items-center gap-2 bg-secondary/10 text-secondary rounded-2xl px-4 py-3 text-sm font-medium">
            <Megaphone className="w-4 h-4 shrink-0" />
            <span>{announcement}</span>
          </div>
        )}

        {(sections.mostPopular.length > 0 || sections.bestValue.length > 0 || sections.newItems.length > 0) && (
          <section className="space-y-4">
            {sections.mostPopular.length > 0 && (
              <div>
                <h2 className="font-heading font-bold text-primary text-lg flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-secondary" /> Most Popular
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
                  {sections.mostPopular.map((item) => (
                    <MiniItemCard key={item.id} item={item} cart={cart} justAdded={justAdded} onAdd={(i) => { addToCart(i); setJustAdded(i.id); window.setTimeout(() => setJustAdded((c) => (c === i.id ? null : c)), 900) }} onUpdate={(id, q) => updateCartQuantity(id, q)} />
                  ))}
                </div>
              </div>
            )}
            {sections.bestValue.length > 0 && (
              <div>
                <h2 className="font-heading font-bold text-primary text-lg flex items-center gap-2 mb-2">
                  <BadgePercent className="w-4 h-4 text-success" /> Best Value
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
                  {sections.bestValue.map((item) => (
                    <MiniItemCard key={item.id} item={item} cart={cart} justAdded={justAdded} onAdd={(i) => { addToCart(i); setJustAdded(i.id); window.setTimeout(() => setJustAdded((c) => (c === i.id ? null : c)), 900) }} onUpdate={(id, q) => updateCartQuantity(id, q)} />
                  ))}
                </div>
              </div>
            )}
            {sections.newItems.length > 0 && (
              <div>
                <h2 className="font-heading font-bold text-primary text-lg flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-accent" /> New
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
                  {sections.newItems.map((item) => (
                    <MiniItemCard key={item.id} item={item} cart={cart} justAdded={justAdded} onAdd={(i) => { addToCart(i); setJustAdded(i.id); window.setTimeout(() => setJustAdded((c) => (c === i.id ? null : c)), 900) }} onUpdate={(id, q) => updateCartQuantity(id, q)} />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {promotions.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-heading font-bold text-primary text-lg flex items-center gap-2">
              <Star className="w-4 h-4 text-secondary" /> Specials & Offers
            </h2>            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
              {promotions.map((promo) => {
                const Icon = PROMO_ICONS[promo.type] || Tag
                const badgeCls = PROMO_BADGE[promo.type] || PROMO_BADGE.SPECIAL
                const linked = promo.menuItem
                const promoQty = linked ? cart.find((c) => c.item.id === linked.id)?.quantity || 0 : 0
                return (
                  <motion.div
                    key={promo.id}
                    layout
                    className="w-[280px] shrink-0 snap-start bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden"
                  >
                    {promo.imageUrl && (
                      <div className="h-28 overflow-hidden bg-gray-100">
                        <img src={promo.imageUrl} alt={promo.title} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      </div>
                    )}
                    <div className="p-4">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeCls}`}>
                        <Icon className="w-3 h-3" /> {promo.type}
                      </span>
                      <h3 className="font-heading font-bold text-primary mt-2">{promo.title}</h3>
                      {promo.description && (
                        <p className="text-xs text-text-secondary mt-1 line-clamp-3">{promo.description}</p>
                      )}
                      {(promo.startsAt || promo.endsAt) && (
                        <p className="text-[10px] text-text-secondary/70 mt-1.5">
                          {promo.startsAt ? new Date(promo.startsAt).toLocaleDateString() : ''}
                          {promo.startsAt && promo.endsAt ? ' → ' : ''}
                          {promo.endsAt ? new Date(promo.endsAt).toLocaleDateString() : ''}
                        </p>
                      )}
                      {linked && (
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                          <div>
                            <p className="text-xs font-medium text-text-primary truncate">{linked.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {promo.specialPrice != null && (
                                <span className="text-xs text-text-secondary line-through">KES {Number(linked.price).toLocaleString()}</span>
                              )}
                              <span className="font-bold text-secondary">
                                KES {Number(promo.specialPrice ?? linked.price).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {promoQty === 0 ? (
                            <motion.button
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                addToCart({ ...linked, price: Number(promo.specialPrice ?? linked.price) })
                                setJustAdded(linked.id)
                                window.setTimeout(() => setJustAdded((cur) => (cur === linked.id ? null : cur)), 900)
                              }}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                                justAdded === linked.id ? 'bg-success text-white animate-pop-in' : 'bg-secondary text-white hover:bg-secondary-dark'
                              }`}
                            >
                              {justAdded === linked.id ? <CheckCircle className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                              {justAdded === linked.id ? 'Added' : 'Add'}
                            </motion.button>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => updateCartQuantity(linked.id, promoQty - 1)}
                                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-primary hover:bg-gray-50"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center font-semibold text-primary text-sm">{promoQty}</span>
                              <button
                                onClick={() => addToCart({ ...linked, price: Number(promo.specialPrice ?? linked.price) })}
                                className="w-7 h-7 rounded-lg bg-secondary text-white flex items-center justify-center hover:bg-secondary-dark"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </section>
        )}

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
                          {item.isTodaysSpecial && <Badge variant="warning" size="sm">Today's Special</Badge>}
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
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            addToCart(item)
                            setJustAdded(item.id)
                            window.setTimeout(() => setJustAdded((cur) => (cur === item.id ? null : cur)), 900)
                          }}
                          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                            justAdded === item.id ? 'bg-success text-white animate-pop-in' : 'bg-secondary text-white hover:bg-secondary-dark'
                          }`}
                        >
                          {justAdded === item.id ? <CheckCircle className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          {justAdded === item.id ? 'Added' : 'Add'}
                        </motion.button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => updateCartQuantity(item.id, qty - 1)}
                            className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-primary hover:bg-gray-50"
                          >
                            <Minus className="w-4 h-4" />
                          </motion.button>
                          <motion.span key={qty} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="w-8 text-center font-semibold text-primary text-sm">{qty}</motion.span>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              addToCart(item)
                              setJustAdded(item.id)
                              window.setTimeout(() => setJustAdded((cur) => (cur === item.id ? null : cur)), 900)
                            }}
                            className="w-8 h-8 rounded-xl bg-secondary text-white flex items-center justify-center hover:bg-secondary-dark"
                          >
                            <Plus className="w-4 h-4" />
                          </motion.button>
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

      {restaurantInfo?.id && (
        <AIChat
          restaurantId={restaurantInfo.id}
          menuItems={menuCategories.flatMap((cat) => cat.items)}
        />
      )}
    </div>
  )
}

function MiniItemCard({ item, cart, justAdded, onAdd, onUpdate }: {
  item: any
  cart: any[]
  justAdded: string | null
  onAdd: (item: any) => void
  onUpdate: (id: string, qty: number) => void
}) {
  const qty = cart.find((c) => c.item.id === item.id)?.quantity || 0
  return (
    <div className="w-[160px] shrink-0 snap-start bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
      {item.photoUrl ? (
        <div className="h-20 overflow-hidden bg-gray-100">
          <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </div>
      ) : (
        <div className="h-20 bg-gradient-to-br from-secondary/10 to-accent/10 flex items-center justify-center">
          <ChefHat className="w-6 h-6 text-secondary/40" />
        </div>
      )}
      <div className="p-3">
        <p className="text-sm font-medium text-primary truncate">{item.name}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="font-bold text-secondary text-sm">KES {Number(item.price).toLocaleString()}</span>
          {qty === 0 ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onAdd({ ...item, price: Number(item.price) })}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                justAdded === item.id ? 'bg-success text-white animate-pop-in' : 'bg-secondary text-white hover:bg-secondary-dark'
              }`}
            >
              {justAdded === item.id ? <CheckCircle className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              {justAdded === item.id ? 'Added' : 'Add'}
            </motion.button>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => onUpdate(item.id, qty - 1)} className="w-6 h-6 rounded-md border border-gray-200 flex items-center justify-center text-primary hover:bg-gray-50">
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-5 text-center font-semibold text-primary text-xs">{qty}</span>
              <button onClick={() => onUpdate(item.id, qty + 1)} className="w-6 h-6 rounded-md bg-secondary text-white flex items-center justify-center hover:bg-secondary-dark">
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

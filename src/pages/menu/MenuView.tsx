import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { ShoppingCart, Plus, Minus, ChefHat, MapPin, Star, Search } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default function MenuView() {
  const { restaurantSlug } = useParams()
  const navigate = useNavigate()
  const { categories, cart, addToCart, updateCartQuantity, restaurant } = useStore()
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || '')

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

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
                <h1 className="font-heading font-bold text-primary text-sm">{restaurant?.name || restaurantSlug || 'Restaurant'}</h1>
                <p className="text-[10px] text-text-secondary">Digital Menu</p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/menu/${restaurantSlug}/cart`)}
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

          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
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
        {categories.filter(c => !activeCategory || c.id === activeCategory).map((category) => (
          <div key={category.id}>
            <h2 className="font-heading font-bold text-primary text-lg mb-3">{category.name}</h2>
            <div className="space-y-3">
              {category.items.map((item) => {
                const cartItem = cart.find(c => c.item.id === item.id)
                const qty = cartItem?.quantity || 0
                return (
                  <motion.div
                    key={item.id}
                    layout
                    className="bg-white rounded-2xl p-4 border border-gray-100 shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-primary text-sm">{item.name}</h3>
                          {item.isPopular && <Badge variant="success" size="sm">Popular</Badge>}
                          {item.isNew && <Badge variant="info" size="sm">New</Badge>}
                        </div>
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">{item.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {item.dietaryTags.map((tag) => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-text-secondary font-medium">{tag}</span>
                          ))}
                        </div>
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

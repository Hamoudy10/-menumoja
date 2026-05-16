import { create } from 'zustand'
import toast from 'react-hot-toast'
import * as authApi from '@/api/auth'
import * as restaurantApi from '@/api/restaurant'
import * as menuApi from '@/api/menu'
import * as ordersApi from '@/api/orders'
import * as tablesApi from '@/api/tables'
import * as paymentsApi from '@/api/payments'
import * as staffApi from '@/api/staff'
import * as marketingApi from '@/api/marketing'
import * as surveillanceApi from '@/api/surveillance'
import * as notificationsApi from '@/api/notifications'
import type {
  MenuCategory, Order, Staff, TableInfo,
  Transaction, Post, Camera, Customer, OnboardingData, CartItem,
} from '@/types'
import type { Restaurant } from '@/types'

interface AppState {
  darkMode: boolean
  toggleDarkMode: () => void

  isAuthenticated: boolean
  userRole: 'owner' | 'admin' | null
  accessToken: string | null
  refreshToken: string | null
  restaurant: Restaurant | null
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: (credential: string) => Promise<void>
  register: (data: any) => Promise<any>
  verifyOtp: (userId: string, otp: string) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<void>

  onboarding: OnboardingData
  updateOnboarding: (data: Partial<OnboardingData>) => void
  nextStep: () => void
  prevStep: () => void
  resetOnboarding: () => void

  categories: MenuCategory[]
  loadingCategories: boolean
  fetchCategories: () => Promise<void>
  addCategory: (data: any) => Promise<void>
  updateCategory: (id: string, data: any) => Promise<void>
  removeCategory: (id: string) => Promise<void>
  addItem: (categoryId: string, data: any) => Promise<void>
  updateItem: (categoryId: string, itemId: string, data: any) => Promise<void>
  removeItem: (categoryId: string, itemId: string) => Promise<void>
  toggleItemAvailability: (itemId: string) => Promise<void>

  orders: Order[]
  liveOrders: Order[]
  loadingOrders: boolean
  fetchOrders: (params?: any) => Promise<void>
  fetchLiveOrders: () => Promise<void>
  updateOrderStatus: (id: string, status: string) => Promise<void>
  placeOrder: (data: any) => Promise<any>
  addOrder: (order: any) => void

  tables: TableInfo[]
  fetchTables: () => Promise<void>
  createTable: (data: any) => Promise<void>

  transactions: Transaction[]
  todaySummary: any
  fetchPayments: (params?: any) => Promise<void>
  fetchTodaySummary: () => Promise<void>
  initiateMpesa: (orderId: string, phone: string) => Promise<any>
  recordCashPayment: (data: any) => Promise<void>

  staff: Staff[]
  fetchStaff: () => Promise<void>
  addStaff: (data: any) => Promise<void>
  removeStaff: (id: string) => Promise<void>

  posts: any[]
  fetchPosts: () => Promise<void>
  addPost: (post: any) => Promise<any>
  updatePost: (id: string, data: any) => Promise<void>
  approvePost: (id: string) => Promise<void>
  publishPost: (id: string) => Promise<void>

  cameras: Camera[]
  alerts: any[]
  fetchCameras: () => Promise<void>
  addCamera: (camera: any) => Promise<void>
  updateCamera: (id: string, data: any) => Promise<void>
  addAlert: (cameraId: string, alert: any) => void
  fetchAlerts: () => Promise<void>

  notifications: any[]
  unreadCount: number
  fetchNotifications: () => Promise<void>

  updateRestaurant: (data: Partial<Restaurant>) => Promise<void>

  customer: Customer | null
  setCustomer: (customer: Customer) => void
  cart: CartItem[]
  addToCart: (item: any) => void
  removeFromCart: (itemId: string) => void
  updateCartQuantity: (itemId: string, quantity: number) => void
  clearCart: () => void
  language: 'en' | 'sw' | 'ar'
  setLanguage: (lang: 'en' | 'sw' | 'ar') => void
}

const defaultOnboarding: OnboardingData = {
  step: 0, restaurantName: '', ownerName: '', email: '', phone: '', password: '',
  cuisine: '', restaurantType: '', location: '', description: '', openingHours: '',
  logo: '', coverPhoto: '', brandColor: '#FF6B35', fontStyle: 'modern', layout: 'grid',
  welcomeMessage: '', categories: [], faqs: [], tables: 10, qrStyle: 0,
  socialMedia: [], aiMarketing: false,
}

export const useStore = create<AppState>((set) => ({
  darkMode: false,
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),

  isAuthenticated: false,
  userRole: null,
  accessToken: null,
  refreshToken: null,
  restaurant: null,

  login: async (email, password) => {
    try {
      const data = await authApi.login(email, password)
      const accessToken = data.tokens?.accessToken || data.accessToken
      const refreshToken = data.tokens?.refreshToken || data.refreshToken
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      set({
        isAuthenticated: true,
        userRole: data.user?.role || 'owner',
        accessToken,
        refreshToken,
        restaurant: data.restaurant || null,
      })
      toast.success('Welcome back!')
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Login failed'
      toast.error(msg)
      throw err
    }
  },

  loginWithGoogle: async (credential) => {
    try {
      const data = await authApi.loginWithGoogle(credential)
      const accessToken = data.tokens?.accessToken || data.accessToken
      const refreshToken = data.tokens?.refreshToken || data.refreshToken
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      set({
        isAuthenticated: true,
        userRole: data.user?.role || 'owner',
        accessToken,
        refreshToken,
        restaurant: data.restaurant || null,
      })
      toast.success('Signed in with Google')
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Google sign in failed'
      toast.error(msg)
      throw err
    }
  },

  register: async (registerData) => {
    try {
      const data = await authApi.register(registerData)
      if (data.tokens) {
        localStorage.setItem('accessToken', data.tokens.accessToken)
        localStorage.setItem('refreshToken', data.tokens.refreshToken)
        set({
          isAuthenticated: true,
          userRole: data.user?.role || 'owner',
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          restaurant: data.restaurant || null,
        })
      }
      toast.success('Account created! Check your phone for OTP.')
      return data
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Registration failed'
      toast.error(msg)
      throw err
    }
  },

  verifyOtp: async (userId, otp) => {
    try {
      await authApi.verifyOtp(userId, otp)
      toast.success('Phone verified successfully!')
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Verification failed'
      toast.error(msg)
      throw err
    }
  },

  logout: async () => {
    try {
      const token = localStorage.getItem('refreshToken') || undefined
      await authApi.logout(token)
    } catch {
      // ignore server errors
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      set({
        isAuthenticated: false,
        userRole: null,
        accessToken: null,
        refreshToken: null,
        restaurant: null,
        categories: [],
        orders: [],
        liveOrders: [],
        tables: [],
        transactions: [],
        todaySummary: null,
        staff: [],
        posts: [],
        cameras: [],
        alerts: [],
        notifications: [],
        unreadCount: 0,
        customer: null,
        cart: [],
      })
      window.location.href = '/login'
    }
  },

  restoreSession: async () => {
    const accessToken = localStorage.getItem('accessToken')
    const refreshToken = localStorage.getItem('refreshToken')
    if (!accessToken || !refreshToken) return
    try {
      set({ accessToken, refreshToken })
      const data = await restaurantApi.fetchRestaurant()
      set({
        isAuthenticated: true,
        userRole: data.user?.role || 'owner',
        restaurant: data.restaurant || data,
      })
    } catch {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      set({ isAuthenticated: false, userRole: null, restaurant: null, accessToken: null, refreshToken: null })
    }
  },

  onboarding: defaultOnboarding,
  updateOnboarding: (data) => set((s) => ({ onboarding: { ...s.onboarding, ...data } })),
  nextStep: () => set((s) => ({ onboarding: { ...s.onboarding, step: Math.min(s.onboarding.step + 1, 6) } })),
  prevStep: () => set((s) => ({ onboarding: { ...s.onboarding, step: Math.max(s.onboarding.step - 1, 0) } })),
  resetOnboarding: () => set({ onboarding: defaultOnboarding }),

  categories: [],
  loadingCategories: false,
  fetchCategories: async () => {
    set({ loadingCategories: true })
    try {
      const data = await menuApi.fetchCategories()
      const cats = (data.categories || data || []).map((c: any) => ({ ...c, items: c.items || [] }))
      set({ categories: cats })
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to load menu'
      toast.error(msg)
    } finally {
      set({ loadingCategories: false })
    }
  },
  addCategory: async (data) => {
    try {
      const res = await menuApi.addCategory(data)
      const newCat = { items: [], ...(res.category || res) }
      set((s) => ({ categories: [...s.categories, newCat] }))
      toast.success('Category added')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add category')
      throw err
    }
  },
  updateCategory: async (id, data) => {
    try {
      const res = await menuApi.updateCategory(id, data)
      set((s) => ({ categories: s.categories.map((c) => c.id === id ? { items: c.items || [], ...c, ...(res.category || res) } : c) }))
      toast.success('Category updated')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update category')
      throw err
    }
  },
  removeCategory: async (id) => {
    try {
      await menuApi.removeCategory(id)
      set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
      toast.success('Category removed')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to remove category')
      throw err
    }
  },
  addItem: async (categoryId, data) => {
    try {
      const payload = {
        name: data.name || 'New Item',
        price: data.price || 0,
        description: data.description || '',
        categoryId,
        isAvailable: data.available !== false,
        isPopular: !!data.isPopular,
        preparationTime: data.prepTime || 10,
        ingredients: data.ingredients || [],
        allergens: data.allergens || [],
      }
      const res = await menuApi.addItem(payload)
      const newItem = res.item || res
      set((s) => ({
        categories: s.categories.map((c) =>
          c.id === categoryId ? { ...c, items: [...c.items, newItem] } : c,
        ),
      }))
      toast.success('Item added')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add item')
      throw err
    }
  },
  updateItem: async (categoryId, itemId, data) => {
    try {
      const mapped: any = {}
      if (data.name !== undefined) mapped.name = data.name
      if (data.price !== undefined) mapped.price = data.price
      if (data.description !== undefined) mapped.description = data.description
      if (data.available !== undefined) mapped.isAvailable = data.available
      if (data.isPopular !== undefined) mapped.isPopular = data.isPopular
      if (data.prepTime !== undefined) mapped.preparationTime = data.prepTime
      if (data.ingredients !== undefined) mapped.ingredients = data.ingredients
      if (data.allergens !== undefined) mapped.allergens = data.allergens
      if (data.photo !== undefined) mapped.image = data.photo
      const res = await menuApi.updateItem(itemId, mapped)
      set((s) => ({
        categories: s.categories.map((c) =>
          c.id === categoryId
            ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...(res.item || res), ...data } : i)) }
            : c,
        ),
      }))
      toast.success('Item updated')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update item')
      throw err
    }
  },
  removeItem: async (categoryId, itemId) => {
    try {
      await menuApi.removeItem(itemId)
      set((s) => ({
        categories: s.categories.map((c) =>
          c.id === categoryId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c,
        ),
      }))
      toast.success('Item removed')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to remove item')
      throw err
    }
  },
  toggleItemAvailability: async (itemId) => {
    try {
      const res = await menuApi.toggleItemAvailability(itemId)
      set((s) => ({
        categories: s.categories.map((c) => ({
          ...c,
          items: c.items.map((i) =>
            i.id === itemId ? { ...i, available: res.item?.available ?? !i.available } : i,
          ),
        })),
      }))
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to toggle availability')
    }
  },

  orders: [],
  liveOrders: [],
  loadingOrders: false,
  fetchOrders: async (params) => {
    set({ loadingOrders: true })
    try {
      const data = await ordersApi.fetchOrders(params)
      set({ orders: data.orders || data })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load orders')
    } finally {
      set({ loadingOrders: false })
    }
  },
  fetchLiveOrders: async () => {
    try {
      const data = await ordersApi.fetchLiveOrders()
      set({ liveOrders: data.orders || data })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load live orders')
    }
  },
  updateOrderStatus: async (id, status) => {
    try {
      const res = await ordersApi.updateOrderStatus(id, status)
      set((s) => ({
        orders: s.orders.map((o) => (o.id === id ? { ...o, ...(res.order || res), status } : o)),
        liveOrders: s.liveOrders.map((o) => (o.id === id ? { ...o, ...(res.order || res), status } : o)),
      }))
      toast.success(`Order ${status}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update order')
      throw err
    }
  },
  placeOrder: async (data) => {
    try {
      const res = await ordersApi.placeOrder(data)
      set((s) => ({ orders: [res.order || res, ...s.orders] }))
      toast.success('Order placed!')
      return res.order || res
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to place order')
      throw err
    }
  },
  addOrder: (order: any) => {
    set((s) => ({ orders: [order, ...s.orders] }))
  },

  tables: [],
  fetchTables: async () => {
    try {
      const data = await tablesApi.fetchTables()
      set({ tables: data.tables || data })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load tables')
    }
  },
  createTable: async (data) => {
    try {
      const res = await tablesApi.createTable(data)
      set((s) => ({ tables: [...s.tables, res.table || res] }))
      toast.success('Table created')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create table')
      throw err
    }
  },

  transactions: [],
  todaySummary: null,
  fetchPayments: async (params) => {
    try {
      const data = await paymentsApi.fetchPayments(params)
      set({ transactions: data.transactions || data })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load payments')
    }
  },
  fetchTodaySummary: async () => {
    try {
      const data = await paymentsApi.fetchTodaySummary()
      set({ todaySummary: data })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load summary')
    }
  },
  initiateMpesa: async (orderId, phone) => {
    try {
      const data = await paymentsApi.initiateMpesa(orderId, phone)
      toast.success('M-Pesa STK push sent')
      return data
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'M-Pesa payment failed')
      throw err
    }
  },
  recordCashPayment: async (data) => {
    try {
      const res = await paymentsApi.recordCashPayment(data)
      set((s) => ({ transactions: [res.transaction || res, ...s.transactions] }))
      toast.success('Cash payment recorded')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to record payment')
      throw err
    }
  },

  staff: [],
  fetchStaff: async () => {
    try {
      const data = await staffApi.fetchStaff()
      set({ staff: data.staff || data })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load staff')
    }
  },
  addStaff: async (data) => {
    try {
      const res = await staffApi.addStaff(data)
      set((s) => ({ staff: [...s.staff, res.staff || res] }))
      toast.success('Staff added')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add staff')
      throw err
    }
  },
  removeStaff: async (id) => {
    try {
      await staffApi.removeStaff(id)
      set((s) => ({ staff: s.staff.filter((m) => m.id !== id) }))
      toast.success('Staff removed')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to remove staff')
      throw err
    }
  },

  posts: [],
  fetchPosts: async () => {
    try {
      const data = await marketingApi.fetchPosts()
      set({ posts: data.posts || data })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load posts')
    }
  },
  addPost: async (post: any) => {
    try {
      const res = await marketingApi.createPost(post)
      const newPost = res.post || res
      set((s) => ({ posts: [...s.posts, newPost] }))
      toast.success('Post created')
      return newPost
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create post')
      throw err
    }
  },
  updatePost: async (id: string, data: any) => {
    try {
      const res = await marketingApi.updatePost(id, data)
      set((s) => ({
        posts: s.posts.map((p) => p.id === id ? { ...p, ...(res.post || res), ...data } : p),
      }))
      toast.success('Post updated')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update post')
    }
  },
  approvePost: async (id: string) => {
    try {
      await marketingApi.approvePost(id)
      set((s) => ({
        posts: s.posts.map((p) => p.id === id ? { ...p, status: 'approved' } : p),
      }))
      toast.success('Post approved')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to approve post')
    }
  },
  publishPost: async (id: string) => {
    try {
      await marketingApi.publishPost(id)
      set((s) => ({
        posts: s.posts.map((p) => p.id === id ? { ...p, status: 'posted' } : p),
      }))
      toast.success('Post published!')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to publish post')
    }
  },

  cameras: [],
  alerts: [],
  fetchCameras: async () => {
    try {
      const data = await surveillanceApi.fetchCameras()
      set({ cameras: data.cameras || data })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load cameras')
    }
  },
  addCamera: async (camera: any) => {
    try {
      const res = await surveillanceApi.createCamera(camera)
      const newCam = res.camera || res
      set((s) => ({ cameras: [...s.cameras, newCam] }))
      toast.success('Camera added')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to add camera')
      throw err
    }
  },
  updateCamera: async (id: string, data: any) => {
    try {
      const res = await surveillanceApi.updateCamera(id, data)
      set((s) => ({
        cameras: s.cameras.map((c) => c.id === id ? { ...c, ...(res.camera || res) } : c),
      }))
      toast.success('Camera updated')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update camera')
    }
  },
  addAlert: (cameraId: string, alert: any) => set((s) => ({
    cameras: s.cameras.map((c) => c.id === cameraId ? { ...c, alerts: [alert, ...c.alerts] } : c),
  })),
  fetchAlerts: async () => {
    try {
      const data = await surveillanceApi.getAlerts()
      const alerts = data.alerts || data
      set({ alerts })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load alerts')
    }
  },

  notifications: [],
  unreadCount: 0,
  fetchNotifications: async () => {
    try {
      const data = await notificationsApi.fetchNotifications()
      set({
        notifications: data.notifications || data,
        unreadCount: data.unreadCount ?? 0,
      })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load notifications')
    }
  },

  customer: null,
  updateRestaurant: async (data) => {
    try {
      const res = await restaurantApi.updateRestaurant(data)
      set({ restaurant: { ...useStore.getState().restaurant!, ...(res.restaurant || res), ...data } })
      toast.success('Settings saved')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save settings')
      throw err
    }
  },
  setCustomer: (customer) => set({ customer }),
  cart: [],
  addToCart: (item) => set((s) => {
    const existing = s.cart.find((c) => c.item.id === item.id)
    if (existing) return { cart: s.cart.map((c) => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c) }
    return { cart: [...s.cart, { item, quantity: 1, specialInstructions: '' }] }
  }),
  removeFromCart: (itemId) => set((s) => ({ cart: s.cart.filter((c) => c.item.id !== itemId) })),
  updateCartQuantity: (itemId, quantity) => set((s) =>
    quantity <= 0
      ? { cart: s.cart.filter((c) => c.item.id !== itemId) }
      : { cart: s.cart.map((c) => c.item.id === itemId ? { ...c, quantity } : c) },
  ),
  clearCart: () => set({ cart: [] }),

  language: 'en',
  setLanguage: (lang) => set({ language: lang }),
}))

import { create } from 'zustand'
import toast from 'react-hot-toast'
import * as authApi from '@/api/auth'
import * as restaurantApi from '@/api/restaurant'
import * as menuApi from '@/api/menu'
import * as ordersApi from '@/api/orders'
import * as tablesApi from '@/api/tables'
import * as paymentsApi from '@/api/payments'
import * as staffApi from '@/api/staff'
import * as surveillanceApi from '@/api/surveillance'
import * as notificationsApi from '@/api/notifications'
import * as qrcodesApi from '@/api/qrcodes'
import type {
  MenuCategory, Order, Staff, FloorTable, FloorZone,
  Transaction, Camera, Customer, OnboardingData, CartItem,
} from '@/types'
import type { Restaurant } from '@/types'

function normalizeOrderStatus(status: unknown): 'new' | 'preparing' | 'ready' | 'served' | 'cancelled' {
  const s = String(status || '').toUpperCase()
  if (s === 'PENDING' || s === 'NEW') return 'new'
  if (s === 'CONFIRMED' || s === 'PREPARING') return 'preparing'
  if (s === 'READY') return 'ready'
  if (s === 'SERVED' || s === 'COMPLETED') return 'served'
  if (s === 'CANCELLED' || s === 'CANCELED') return 'cancelled'
  return 'new'
}

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
  addItem: (categoryId: string, data: any) => Promise<any>
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

  tables: FloorTable[]
  zones: FloorZone[]
  fetchTables: () => Promise<void>
  createTable: (data: any) => Promise<void>
  updateTable: (id: string, data: any) => Promise<void>
  removeTable: (id: string) => Promise<void>
  setTableStatus: (id: string, status: string) => Promise<void>
  fetchZones: () => Promise<void>
  createZone: (data: any) => Promise<void>
  updateZone: (id: string, data: any) => Promise<void>
  removeZone: (id: string) => Promise<void>

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
  updateStaff: (id: string, data: any) => Promise<void>

  cameras: Camera[]
  alerts: any[]
  fetchCameras: () => Promise<void>
  addCamera: (camera: any) => Promise<void>
  updateCamera: (id: string, data: any) => Promise<void>
  deleteCamera: (id: string) => Promise<void>
  addAlert: (cameraId: string, alert: any) => void
  fetchAlerts: () => Promise<void>

  notifications: any[]
  unreadCount: number
  fetchNotifications: () => Promise<void>

  updateRestaurant: (data: Partial<Restaurant>) => Promise<void>

  qrCodes: any[]
  fetchQrCodes: () => Promise<void>
  generateQrCode: (data: any) => Promise<any>
  generateBatchQrCodes: (data: any) => Promise<any>
  deleteQrCode: (id: string) => Promise<void>

  customer: Customer | null
  setCustomer: (customer: Customer) => void
  cart: CartItem[]
  addToCart: (item: any, specialInstructions?: string) => void
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
  darkMode: (() => {
    try {
      return localStorage.getItem('app-theme')
        ? (JSON.parse(localStorage.getItem('app-theme') || '{}').darkMode === true)
        : false
    } catch {
      return false
    }
  })(),
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
      const userEmail = data.user?.email || data.email || ''
      if (userEmail) {
        localStorage.setItem('google_email', userEmail)
      }
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
          accessToken: data.tokens.accessToken,
          refreshToken: data.tokens.refreshToken,
          userRole: data.user?.role || 'owner',
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
      set({ isAuthenticated: true })
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
      localStorage.removeItem('google_email')
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
        cameras: [],
        alerts: [],
        notifications: [],
        unreadCount: 0,
        customer: null,
        cart: [],
      })
    }
  },

  restoreSession: async () => {
    const accessToken = localStorage.getItem('accessToken')
    const refreshToken = localStorage.getItem('refreshToken')
    if (!accessToken || !refreshToken) return
    try {
      set({ accessToken, refreshToken, isAuthenticated: true, userRole: 'owner' })
      const data = await restaurantApi.fetchRestaurant()
      if (data) {
        const restaurant = data.restaurant || data
        if (restaurant && restaurant.settings && !restaurant.brandColor) {
          restaurant.brandColor = restaurant.settings.primaryColor || '#FF6B35'
        }
        set({
          userRole: data.user?.role || 'owner',
          restaurant,
        })
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        set({ isAuthenticated: false, userRole: null, restaurant: null, accessToken: null, refreshToken: null })
      }
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
      const cats = (data.categories || data || []).map((c: any) => ({
        ...c,
        items: (c.menuItems || c.items || []).map((raw: any) => ({
          id: raw.id,
          name: raw.name || '',
          price: raw.price || 0,
          description: raw.description || '',
          photo: raw.image || raw.photoUrl || raw.photo || '',
          categoryId: raw.categoryId || c.id,
          dietaryTags: raw.dietaryTags || [],
          prepTime: raw.preparationTime || raw.prepTime || 10,
          available: raw.isAvailable !== false,
          isSpecial: raw.isSpecial || false,
          isPopular: raw.isPopular || false,
          isNew: raw.isNew ?? true,
          isPromoted: raw.isPromoted || false,
          order: raw.order ?? 0,
          ingredients: raw.ingredients || [],
          allergens: raw.allergens || [],
        })),
      }))
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
      set((s) => ({ categories: s.categories.map((c) => c.id === id ? { ...c, ...(res.category || res), items: (res.category || res)?.items || c.items || [] } : c) }))
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
        isSpecial: !!data.isSpecial,
        isNew: !!data.isNew,
        preparationTime: data.prepTime || 10,
        ingredients: data.ingredients || [],
        allergens: data.allergens || [],
        calories: data.calories,
        isHalal: !!data.isHalal,
        isVegetarian: !!data.isVegetarian,
        isVegan: !!data.isVegan,
        isGlutenFree: !!data.isGlutenFree,
        spiceLevel: data.spiceLevel,
        containsNuts: !!data.containsNuts,
        containsDairy: !!data.containsDairy,
        containsSeafood: !!data.containsSeafood,
        allergenNotes: data.allergenNotes,
        nameSw: data.nameSw,
        nameAr: data.nameAr,
        descriptionSw: data.descriptionSw,
        descriptionAr: data.descriptionAr,
      }
      const res = await menuApi.addItem(payload)
      const raw = res.item || res
      const newItem = {
        id: raw.id,
        name: raw.name || '',
        price: raw.price || 0,
        description: raw.description || '',
        photo: raw.image || raw.photoUrl || '',
        categoryId: raw.categoryId || categoryId,
        dietaryTags: raw.dietaryTags || [],
        prepTime: raw.preparationTime || raw.prepTime || 10,
        available: raw.isAvailable !== false,
        isSpecial: raw.isSpecial || raw.isTodaysSpecial || false,
        isPopular: raw.isPopular || raw.isFeatured || false,
        isNew: raw.isNew ?? true,
        isPromoted: raw.isPromoted || false,
        order: raw.order ?? 0,
        ingredients: raw.ingredients || [],
        allergens: raw.allergens || [],
        calories: raw.calories,
        isHalal: raw.isHalal || false,
        isVegetarian: raw.isVegetarian || false,
        isVegan: raw.isVegan || false,
        isGlutenFree: raw.isGlutenFree || false,
        spiceLevel: raw.spiceLevel,
        containsNuts: raw.containsNuts || false,
        containsDairy: raw.containsDairy || false,
        containsSeafood: raw.containsSeafood || false,
        allergenNotes: raw.allergenNotes,
        nameSw: raw.nameSw,
        nameAr: raw.nameAr,
        descriptionSw: raw.descriptionSw,
        descriptionAr: raw.descriptionAr,
      }
      set((s) => ({
        categories: s.categories.map((c) =>
          c.id === categoryId ? { ...c, items: [...c.items, newItem] } : c,
        ),
      }))
      toast.success('Item added')
      return newItem
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
      if (data.isSpecial !== undefined) mapped.isSpecial = data.isSpecial
      if (data.isNew !== undefined) mapped.isNew = data.isNew
      if (data.prepTime !== undefined) mapped.preparationTime = data.prepTime
      if (data.ingredients !== undefined) mapped.ingredients = data.ingredients
      if (data.allergens !== undefined) mapped.allergens = data.allergens
      if (data.photo !== undefined) mapped.image = data.photo
      if (data.calories !== undefined) mapped.calories = data.calories
      if (data.isHalal !== undefined) mapped.isHalal = data.isHalal
      if (data.isVegetarian !== undefined) mapped.isVegetarian = data.isVegetarian
      if (data.isVegan !== undefined) mapped.isVegan = data.isVegan
      if (data.isGlutenFree !== undefined) mapped.isGlutenFree = data.isGlutenFree
      if (data.spiceLevel !== undefined) mapped.spiceLevel = data.spiceLevel
      if (data.containsNuts !== undefined) mapped.containsNuts = data.containsNuts
      if (data.containsDairy !== undefined) mapped.containsDairy = data.containsDairy
      if (data.containsSeafood !== undefined) mapped.containsSeafood = data.containsSeafood
      if (data.allergenNotes !== undefined) mapped.allergenNotes = data.allergenNotes
      if (data.nameSw !== undefined) mapped.nameSw = data.nameSw
      if (data.nameAr !== undefined) mapped.nameAr = data.nameAr
      if (data.descriptionSw !== undefined) mapped.descriptionSw = data.descriptionSw
      if (data.descriptionAr !== undefined) mapped.descriptionAr = data.descriptionAr
      const res = await menuApi.updateItem(itemId, mapped)
      const raw = res.item || res
      const normalized = {
        id: raw.id || itemId,
        name: raw.name,
        price: raw.price,
        description: raw.description,
        photo: raw.image || raw.photoUrl,
        categoryId: raw.categoryId,
        dietaryTags: raw.dietaryTags || raw.dietaryTags,
        prepTime: raw.preparationTime !== undefined ? raw.preparationTime : raw.prepTime,
        available: raw.isAvailable !== undefined ? raw.isAvailable : raw.available,
        isSpecial: raw.isSpecial || raw.isTodaysSpecial,
        isPopular: raw.isPopular || raw.isFeatured,
        isNew: raw.isNew,
        isPromoted: raw.isPromoted,
        order: raw.order,
        ingredients: raw.ingredients,
        allergens: raw.allergens,
        calories: raw.calories,
        isHalal: raw.isHalal || false,
        isVegetarian: raw.isVegetarian || false,
        isVegan: raw.isVegan || false,
        isGlutenFree: raw.isGlutenFree || false,
        spiceLevel: raw.spiceLevel,
        containsNuts: raw.containsNuts || false,
        containsDairy: raw.containsDairy || false,
        containsSeafood: raw.containsSeafood || false,
        allergenNotes: raw.allergenNotes,
        nameSw: raw.nameSw,
        nameAr: raw.nameAr,
        descriptionSw: raw.descriptionSw,
        descriptionAr: raw.descriptionAr,
      }
      set((s) => ({
        categories: s.categories.map((c) =>
          c.id === categoryId
            ? { ...c, items: c.items.map((i) => (i.id === itemId ? { ...i, ...normalized, ...data } : i)) }
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
    const prevState = useStore.getState().categories
    let prevAvailable = true
    for (const c of prevState) {
      const found = c.items.find((i) => i.id === itemId)
      if (found) { prevAvailable = found.available; break }
    }
    set((s) => ({
      categories: s.categories.map((c) => ({
        ...c,
        items: c.items.map((i) =>
          i.id === itemId ? { ...i, available: !i.available } : i,
        ),
      })),
    }))
    try {
      await menuApi.toggleItemAvailability(itemId)
    } catch (err: any) {
      set((s) => ({
        categories: s.categories.map((c) => ({
          ...c,
          items: c.items.map((i) =>
            i.id === itemId ? { ...i, available: prevAvailable } : i,
          ),
        })),
      }))
      toast.error(err?.response?.data?.message || 'Failed to toggle availability')
    }
  },

  orders: [],
  liveOrders: [],
  loadingOrders: false,
  fetchOrders: async (params) => {    set({ loadingOrders: true })
    try {
      const data = await ordersApi.fetchOrders(params)
      const rawOrders = data.orders || data
      const normalized = Array.isArray(rawOrders) ? rawOrders.map((o: any) => ({
        id: o.id,
        tableNumber: o.tableNumber ?? o.table_number ?? 0,
        items: (o.items || []).map((i: any) => ({ name: i.name || i.itemName || '', price: i.price || i.itemPrice || 0, quantity: i.quantity || 1 })),
        total: (o.total ?? o.totalAmount ?? 0) as number,
        status: normalizeOrderStatus(o.status),
        paymentMethod: (o.paymentMethod || 'cash') as 'mpesa' | 'cash' | 'card',
        paymentStatus: (o.paymentStatus || 'pending') as 'pending' | 'confirmed' | 'failed',
        specialInstructions: o.specialInstructions || o.specialNotes || '',
        createdAt: o.createdAt || new Date().toISOString(),
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
      })) : []
      set({ orders: normalized })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load orders')
    } finally {
      set({ loadingOrders: false })
    }
  },
  fetchLiveOrders: async () => {
    try {
      const data = await ordersApi.fetchLiveOrders()
      const rawOrders = data.orders || data
      const normalized = Array.isArray(rawOrders) ? rawOrders.map((o: any) => ({
        id: o.id,
        tableNumber: o.tableNumber ?? o.table_number ?? 0,
        items: (o.items || []).map((i: any) => ({ name: i.name || i.itemName || '', price: i.price || i.itemPrice || 0, quantity: i.quantity || 1 })),
        total: (o.total ?? o.totalAmount ?? 0) as number,
        status: normalizeOrderStatus(o.status),
        paymentMethod: (o.paymentMethod || 'cash') as 'mpesa' | 'cash' | 'card',
        paymentStatus: (o.paymentStatus || 'pending') as 'pending' | 'confirmed' | 'failed',
        specialInstructions: o.specialInstructions || o.specialNotes || '',
        createdAt: o.createdAt || new Date().toISOString(),
      })) : []
      set({ liveOrders: normalized })
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
      const order = res.order || (res.orderId ? { id: res.orderId, orderNumber: res.orderNumber, ...res } : res)
      set((s) => ({ orders: [order, ...s.orders] }))
      toast.success('Order placed!')
      return order
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to place order')
      throw err
    }
  },
  addOrder: (order: any) => {
    if (!order || !order.id) return
    const normalized = {
      id: order.id,
      tableNumber: order.tableNumber || order.table_number || 0,
      items: order.items || [],
      total: order.total || order.totalAmount || 0,
      status: order.status || 'new',
      paymentMethod: order.paymentMethod || order.payment_method || 'cash',
      paymentStatus: order.paymentStatus || order.payment_status || 'pending',
      specialInstructions: order.specialInstructions || order.special_instructions || '',
      createdAt: order.createdAt || order.created_at || new Date().toISOString(),
    }
    set((s) => ({ orders: [normalized, ...s.orders] }))
  },

  tables: [],
  fetchTables: async () => {
    try {
      const data = await tablesApi.fetchTables()
      const raw = data.tables || data
      const normalized: FloorTable[] = Array.isArray(raw)
        ? raw.map((t: any) => ({
            id: t.id,
            tableNumber: t.tableNumber ?? t.number ?? 0,
            label: t.label || `Table ${t.tableNumber ?? t.number ?? ''}`,
            capacity: t.capacity ?? null,
            status: (t.status || 'FREE').toUpperCase(),
            area: t.area ?? null,
            shape: (t.shape || 'ROUND').toUpperCase(),
            positionX: t.positionX ?? t.position_x ?? 0,
            positionY: t.positionY ?? t.position_y ?? 0,
            width: t.width ?? 2,
            height: t.height ?? 2,
            rotation: t.rotation ?? 0,
            zoneId: t.zoneId ?? t.zone_id ?? null,
            zone: t.zone ?? null,
            sessions: t.sessions ?? [],
            qrCode: t.qrCode ?? null,
            _count: t._count ?? { orders: 0 },
          }))
        : []
      set({ tables: normalized as any })
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
  updateTable: async (id, data) => {
    try {
      const res = await tablesApi.updateTable(id, data)
      set((s) => ({ tables: s.tables.map((t: any) => (t.id === id ? { ...t, ...data, ...res } : t)) }))
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update table')
      throw err
    }
  },
  removeTable: async (id) => {
    try {
      await tablesApi.deleteTable(id)
      set((s) => ({ tables: s.tables.filter((t: any) => t.id !== id) }))
      toast.success('Table deleted')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete table')
      throw err
    }
  },
  setTableStatus: async (id, status) => {
    try {
      await tablesApi.setTableStatus(id, status)
      set((s) => ({ tables: s.tables.map((t: any) => (t.id === id ? { ...t, status } : t)) }))
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update table status')
      throw err
    }
  },
  zones: [],
  fetchZones: async () => {
    try {
      const data = await tablesApi.fetchZones()
      const raw = data.zones || data
      set({ zones: Array.isArray(raw) ? raw : [] })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load zones')
    }
  },
  createZone: async (data) => {
    try {
      const res = await tablesApi.createZone(data)
      set((s) => ({ zones: [...s.zones, res.zone || res] }))
      toast.success('Zone created')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create zone')
      throw err
    }
  },
  updateZone: async (id, data) => {
    try {
      const res = await tablesApi.updateZone(id, data)
      set((s) => ({ zones: s.zones.map((z) => (z.id === id ? { ...z, ...data, ...res } : z)) }))
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update zone')
      throw err
    }
  },
  removeZone: async (id) => {
    try {
      await tablesApi.deleteZone(id)
      set((s) => ({ zones: s.zones.filter((z) => z.id !== id) }))
      toast.success('Zone deleted')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete zone')
      throw err
    }
  },

  transactions: [],
  todaySummary: null,
  fetchPayments: async (params) => {
    try {
      const data = await paymentsApi.fetchPayments(params)
      const raw = data.transactions || data
      const normalized = Array.isArray(raw) ? raw.map((p: any) => ({
        id: p.id,
        tableNumber: p.order?.tableNumber ?? p.tableNumber ?? 0,
        amount: p.amount || 0,
        method: p.paymentMethod === 'MPESA' ? 'mpesa' as const : p.paymentMethod === 'CARD' ? 'card' as const : 'cash' as const,
        status: p.status === 'PAID' ? 'confirmed' as const : p.status === 'PENDING' ? 'pending' as const : 'failed' as const,
        reference: p.mpesaReceiptNumber || p.mpesaTransactionId || `Order #${p.order?.orderNumber || ''}`,
        createdAt: p.createdAt || p.processedAt || new Date().toISOString(),
      })) : []
      set({ transactions: normalized as any })
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
  updateStaff: async (id: string, data: any) => {
    try {
      const res = await staffApi.updateStaff(id, data)
      set((s) => ({ staff: s.staff.map((m) => m.id === id ? { ...m, ...(res.staff || res), ...data } : m) }))
      toast.success('Staff updated')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update staff')
      throw err
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
  deleteCamera: async (id: string) => {
    try {
      await surveillanceApi.deleteCamera(id)
      set((s) => ({ cameras: s.cameras.filter((c) => c.id !== id) }))
      toast.success('Camera deleted')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete camera')
    }
  },
  addAlert: (cameraId: string, alert: any) => set((s) => ({
    cameras: s.cameras.map((c) => c.id === cameraId ? { ...c, alerts: [alert, ...(c.alerts || [])] } : c),
    alerts: [alert, ...s.alerts],
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
      const merged = { ...useStore.getState().restaurant!, ...(res.restaurant || res), ...data }
      if (merged.settings) {
        merged.brandColor = merged.brandColor || merged.settings.primaryColor || '#FF6B35'
      }
      set({ restaurant: merged })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save settings')
      throw err
    }
  },

  qrCodes: [],
  fetchQrCodes: async () => {
    try {
      const data = await qrcodesApi.fetchQrCodes()
      set({ qrCodes: data || [] })
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load QR codes')
    }
  },
  generateQrCode: async (data) => {
    try {
      const res = await qrcodesApi.generateQrCode(data)
      const qr = res.qrCode || res
      set((s) => ({ qrCodes: [...s.qrCodes, qr] }))
      toast.success('QR code generated!')
      return qr
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate QR code')
      throw err
    }
  },
  generateBatchQrCodes: async (data) => {
    try {
      const res = await qrcodesApi.generateBatchQrCodes(data)
      const codes = res.qrCodes || res || []
      set((s) => ({ qrCodes: [...s.qrCodes, ...codes] }))
      toast.success(`${codes.length} QR codes generated!`)
      return codes
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to generate QR codes')
      throw err
    }
  },
  deleteQrCode: async (id) => {
    try {
      await qrcodesApi.deleteQrCode(id)
      set((s) => ({ qrCodes: s.qrCodes.filter((q: any) => q.id !== id) }))
      toast.success('QR code deleted')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete QR code')
    }
  },

  setCustomer: (customer) => set({ customer }),
  cart: [],
  addToCart: (item, specialInstructions = '') => set((s) => {
    const existing = s.cart.find((c) => c.item.id === item.id)
    if (existing) return { cart: s.cart.map((c) => c.item.id === item.id ? { ...c, quantity: c.quantity + 1, specialInstructions: specialInstructions || c.specialInstructions } : c) }
    return { cart: [...s.cart, { item, quantity: 1, specialInstructions: specialInstructions || '' }] }
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

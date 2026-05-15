export interface Restaurant {
  id: string
  name: string
  slug: string
  ownerName: string
  email: string
  phone: string
  cuisine: string
  description: string
  location: string
  logo: string
  coverPhoto: string
  brandColor: string
  fontStyle: 'modern' | 'elegant' | 'classic'
  layout: 'grid' | 'list'
  openingHours: string
  welcomeMessage: string
  isLive: boolean
  plan: 'starter' | 'business' | 'premium'
  isHalal: boolean
  rating: number
  createdAt: string
}

export interface MenuCategory {
  id: string
  name: string
  items: MenuItem[]
  order: number
}

export interface MenuItem {
  id: string
  name: string
  price: number
  description: string
  photo: string
  categoryId: string
  dietaryTags: string[]
  prepTime: number
  available: boolean
  isSpecial: boolean
  isPopular: boolean
  isNew: boolean
  isPromoted: boolean
  order: number
  ingredients: string[]
  allergens: string[]
}

export interface Order {
  id: string
  tableNumber: number
  items: OrderItem[]
  total: number
  status: 'new' | 'preparing' | 'ready' | 'served'
  paymentMethod: 'mpesa' | 'cash'
  paymentStatus: 'pending' | 'confirmed' | 'failed'
  specialInstructions: string
  createdAt: string
}

export interface OrderItem {
  menuItemId: string
  name: string
  quantity: number
  price: number
  specialInstructions: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  language: 'en' | 'sw' | 'ar'
}

export interface Staff {
  id: string
  name: string
  phone: string
  role: 'waiter' | 'cashier' | 'kitchen' | 'manager'
  pin: string
  active: boolean
}

export interface AiMessage {
  id: string
  role: 'ai' | 'customer'
  content: string
  type: 'text' | 'item' | 'image'
  menuItemId?: string
  timestamp: string
}

export interface TableInfo {
  number: number
  status: 'free' | 'occupied' | 'order-pending' | 'bill-requested'
  orderId?: string
}

export interface Transaction {
  id: string
  tableNumber: number
  amount: number
  method: 'mpesa' | 'cash'
  status: 'confirmed' | 'pending' | 'failed'
  reference: string
  createdAt: string
}

export interface Post {
  id: string
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'tiktok'
  content: string
  image: string
  scheduledAt: string
  status: 'pending' | 'approved' | 'posted'
  reach: number
  likes: number
  clicks: number
  comments: number
}

export interface Alert {
  id: string
  type: 'motion' | 'sound' | 'alert'
  cameraName: string
  message: string
  timestamp: string
  viewed: boolean
  clipUrl: string
}

export interface Camera {
  id: string
  name: string
  ip: string
  port?: number
  username?: string
  location?: string
  active: boolean
  feedUrl: string
  alerts: Alert[]
}

export interface CartItem {
  item: MenuItem
  quantity: number
  specialInstructions: string
}

export interface OnboardingData {
  step: number
  restaurantName: string
  ownerName: string
  email: string
  phone: string
  password: string
  cuisine: string
  restaurantType: string
  location: string
  description: string
  openingHours: string
  logo: string
  coverPhoto: string
  brandColor: string
  fontStyle: 'modern' | 'elegant' | 'classic'
  layout: 'grid' | 'list'
  welcomeMessage: string
  categories: MenuCategory[]
  faqs: { question: string; answer: string; enabled: boolean }[]
  tables: number
  qrStyle: number
  socialMedia: { platform: string; connected: boolean }[]
  aiMarketing: boolean
}

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
  address?: string
  city?: string
  county?: string
  kraPin?: string
  businessRegNo?: string
  vatRegNo?: string
  businessType?: string
  settings?: {
    primaryColor?: string
    secondaryColor?: string
    fontFamily?: string
    gradientStart?: string
    gradientEnd?: string
    useGradient?: boolean
    headingFont?: string
    bodyFont?: string
    accentFont?: string
    layoutStyle?: string
    welcomeMessage?: string
  }
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
  isHalal?: boolean
  isVegetarian?: boolean
  isVegan?: boolean
  isGlutenFree?: boolean
  spiceLevel?: string
  containsNuts?: boolean
  containsDairy?: boolean
  containsSeafood?: boolean
  calories?: number
  allergenNotes?: string
  nameSw?: string
  nameAr?: string
  descriptionSw?: string
  descriptionAr?: string
}

export interface Order {
  id: string
  tableNumber: number
  items: OrderItem[]
  total: number
  status: 'new' | 'preparing' | 'ready' | 'served'
  paymentMethod: 'mpesa' | 'cash' | 'card'
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

export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'UNAVAILABLE'

export type TableShape = 'ROUND' | 'SQUARE' | 'RECTANGLE' | 'OVAL' | 'BOOTH'

export interface FloorZone {
  id: string
  name: string
  color: string
  positionX: number
  positionY: number
  width: number
  height: number
  _count?: { tables: number }
}

export interface FloorTable {
  id: string
  tableNumber: number
  label: string
  capacity: number | null
  status: TableStatus
  area: string | null
  shape: TableShape | string
  positionX: number
  positionY: number
  width: number
  height: number
  rotation: number
  zoneId: string | null
  zone?: FloorZone | null
  sessions?: Array<{ id: string; startedAt: string; endedAt: string | null; guestCount: number | null }>
  qrCode?: { id: string; label?: string; qrImageUrl?: string; scanCount?: number } | null
  _count?: { orders: number }
}

export interface Transaction {
  id: string
  tableNumber: number
  amount: number
  method: 'mpesa' | 'cash' | 'card'
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
  ipAddress: string
  port?: number
  username?: string
  location?: string
  isActive: boolean
  streamUrl?: string
  lastSeen?: string
  alertCount?: number
  alerts?: Alert[]
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

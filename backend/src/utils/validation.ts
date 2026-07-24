import { z } from 'zod';

const phoneRegex = /^\+254[17]\d{8}$/;
const kenyanCountyRegex = /^[A-Za-z\s-]+$/;

function isValidKenyanPhone(val: string) {
  return phoneRegex.test(val);
}

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email address').max(255),
    phone: z
      .string()
      .regex(phoneRegex, 'Phone must be in +254XXXXXXXXX format')
      .refine(isValidKenyanPhone, 'Must be a valid Kenyan phone number'),
    password: passwordSchema,
    restaurantName: z.string().min(1, 'Restaurant name is required').max(200),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().email('Invalid email address').optional(),
    phone: z
      .string()
      .regex(phoneRegex, 'Phone must be in +254XXXXXXXXX format')
      .optional(),
    password: z.string().min(1, 'Password is required'),
  })
  .strict()
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone is required',
  });

export const verifyOtpSchema = z
  .object({
    phone: z
      .string()
      .regex(phoneRegex, 'Phone must be in +254XXXXXXXXX format'),
    otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: z.string().email('Invalid email address'),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
  })
  .strict();

export const createRestaurantSchema = z
  .object({
    name: z.string().min(1, 'Restaurant name is required').max(200),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
      .min(3)
      .max(100)
      .optional(),
    phone: z
      .string()
      .regex(phoneRegex, 'Phone must be in +254XXXXXXXXX format')
      .or(z.literal('')),
    email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
    address: z.string().max(500).optional(),
    city: z.string().max(100).optional(),
    county: z
      .string()
      .regex(kenyanCountyRegex, 'Invalid county name')
      .max(100)
      .optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    currency: z.enum(['KES', 'USD']).default('KES'),
    timezone: z.string().default('Africa/Nairobi'),
    brandColor: z.string().optional(),
    fontStyle: z.string().optional(),
  })
  .strict();

export const updateRestaurantSchema = createRestaurantSchema.partial().strict();

export const updateSettingsSchema = z
  .object({
    currency: z.enum(['KES', 'USD']).optional(),
    timezone: z.string().optional(),
    taxRate: z.number().min(0).max(100).optional(),
    serviceChargeRate: z.number().min(0).max(100).optional(),
    enableOnlineOrders: z.boolean().optional(),
    enableMpesa: z.boolean().optional(),
    enableCash: z.boolean().optional(),
    enableStaffLogin: z.boolean().optional(),
    lowStockThreshold: z.number().int().min(0).optional(),
    openingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format').optional(),
    closingTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format').optional(),
    allowTableReservations: z.boolean().optional(),
    receiptFooter: z.string().max(500).optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    fontFamily: z.string().optional(),
    layoutStyle: z.enum(['GRID', 'LIST']).optional(),
    welcomeMessage: z.string().optional(),
    welcomeMessageSw: z.string().optional(),
    showPrices: z.boolean().optional(),
    allowOrdering: z.boolean().optional(),
    allowCashPayment: z.boolean().optional(),
    allowMpesaPayment: z.boolean().optional(),
    tipEnabled: z.boolean().optional(),
    tipPercentages: z.array(z.number()).optional(),
    serviceChargePercent: z.number().optional(),
    taxPercent: z.number().optional(),
    announcement: z.string().optional(),
    announcementActive: z.boolean().optional(),
    language: z.string().optional(),
    notifications: z.any().optional(),
    paymentSettings: z.any().optional(),
  });

export const createCategorySchema = z
  .object({
    name: z.string().min(1, 'Category name is required').max(100),
    nameSw: z.string().max(100).optional(),
    nameAr: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().default(true),
    image: z.string().optional(),
  })
  .strict();

export const createItemSchema = z
  .object({
    name: z.string().min(1, 'Item name is required').max(200),
    description: z.string().max(2000).optional(),
    price: z.number().min(0, 'Price must be at least 0'),
    categoryId: z.string().uuid('Invalid category ID'),
    image: z.string().optional(),
    isAvailable: z.boolean().default(true),
    isPopular: z.boolean().default(false),
    preparationTime: z.number().int().min(0).optional(),
    calories: z.number().int().min(0).optional(),
    ingredients: z.array(z.string()).max(100).optional(),
    allergens: z.array(z.string()).max(50).optional(),
    variations: z
      .array(
        z.object({
          name: z.string().min(1).max(100),
          price: z.number().min(0),
        })
      )
      .optional(),
    addOns: z
      .array(
        z.object({
          name: z.string().min(1).max(100),
          price: z.number().min(0),
        })
      )
      .optional(),
  })
  .strict();

export const updateItemSchema = createItemSchema.partial().strict();

export const bulkUpdateSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          price: z.number().min(0).optional(),
          isAvailable: z.boolean().optional(),
          isPopular: z.boolean().optional(),
          categoryId: z.string().uuid().optional(),
        })
      )
      .min(1, 'At least one item is required')
      .max(100, 'Maximum 100 items per bulk update'),
  })
  .strict();

export const createOrderSchema = z
  .object({
    items: z
      .array(
        z.object({
          itemId: z.string().uuid('Invalid item ID'),
          quantity: z.number().int().min(1, 'Quantity must be at least 1'),
          variation: z.string().optional(),
          addOns: z.array(z.string()).optional(),
          notes: z.string().max(500).optional(),
        })
      )
      .min(1, 'At least one item is required'),
    tableNumber: z.number().int().min(1).optional(),
    customerName: z.string().max(100).optional(),
    customerPhone: z.string().regex(phoneRegex, 'Must be a valid Kenyan phone').optional(),
    customerEmail: z.string().email().optional(),
    notes: z.string().max(1000).optional(),
    orderType: z.enum(['dine_in', 'takeaway', 'delivery']).default('dine_in'),
    paymentMethod: z.enum(['cash', 'mpesa', 'card']).default('cash'),
    discount: z.number().min(0).max(100).optional(),
  })
  .strict();

export const updateOrderStatusSchema = z
  .object({
    status: z.enum([
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'served',
      'completed',
      'cancelled',
    ]),
    reason: z.string().max(500).optional(),
    estimatedReadyTime: z.string().datetime().optional(),
  })
  .strict();

export const initiateMpesaSchema = z
  .object({
    phone: z
      .string()
      .regex(phoneRegex, 'Phone must be in +254XXXXXXXXX format'),
    amount: z.number().min(1, 'Amount must be at least KES 1').max(150000, 'Amount exceeds M-Pesa maximum (KES 150,000)'),
    orderId: z.string().uuid('Invalid order ID'),
    accountReference: z.string().min(1).max(12).optional(),
    transactionDesc: z.string().max(100).optional(),
  })
  .strict();

export const recordCashSchema = z
  .object({
    orderId: z.string().uuid('Invalid order ID'),
    amount: z.number().min(1, 'Amount must be at least 1'),
    amountTendered: z.number().min(1, 'Amount tendered must be at least 1'),
    notes: z.string().max(500).optional(),
  })
  .strict()
  .refine((data) => data.amountTendered >= data.amount, {
    message: 'Amount tendered must be at least the order amount',
    path: ['amountTendered'],
  });

export const createStaffSchema = z
  .object({
    name: z.string().min(1, 'Staff name is required').max(100),
    email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
    phone: z
      .string()
      .regex(phoneRegex, 'Phone must be in +254XXXXXXXXX format')
      .or(z.literal('')),
    role: z.enum(['manager', 'cashier', 'waiter', 'kitchen']),
    pin: z
      .string()
      .regex(/^\d{4,6}$/, 'PIN must be 4-6 digits')
      .optional(),
    employeeNumber: z.string().optional(),
    nationalId: z.string().optional(),
    kraPin: z.string().optional(),
    nhifNumber: z.string().optional(),
    nssfNumber: z.string().optional(),
    dateOfBirth: z.string().optional(),
    address: z.string().optional(),
    emergencyName: z.string().optional(),
    emergencyPhone: z.string().optional(),
    emergencyRelation: z.string().optional(),
    nextOfKin: z.string().optional(),
    nextOfKinPhone: z.string().optional(),
    nextOfKinRelation: z.string().optional(),
    bankName: z.string().optional(),
    bankBranch: z.string().optional(),
    bankAccount: z.string().optional(),
    monthlySalary: z.number().optional(),
    hourlyRate: z.number().optional(),
    leaveDays: z.number().int().optional(),
    startDate: z.string().optional(),
    notes: z.string().optional(),
    isActive: z.boolean().optional(),
    active: z.boolean().optional(),
  });

export const updateStaffSchema = createStaffSchema.partial().strict();

export const staffLoginSchema = z
  .object({
    pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits'),
    restaurantSlug: z.string().min(1, 'Restaurant slug is required'),
  })
  .strict();

export const createCameraSchema = z
  .object({
    name: z.string().min(1, 'Camera name is required').max(100),
    rtspUrl: z.string().url('Invalid RTSP URL').refine(
      (url) => url.startsWith('rtsp://'),
      'Must be an RTSP URL'
    ),
    location: z.string().max(200).optional(),
    isActive: z.boolean().default(true),
  })
  .strict();

export const aiChatSchema = z
  .object({
    message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
    context: z
      .object({
        restaurantId: z.string().uuid().optional(),
        orderId: z.string().uuid().optional(),
      })
      .optional(),
  })
  .strict();

export const generateDescriptionSchema = z
  .object({
    itemName: z.string().min(1, 'Item name is required').max(200),
    keywords: z.array(z.string()).max(20).optional(),
    tone: z.enum(['professional', 'casual', 'elegant', 'playful', 'fun', 'classic']).default('professional'),
    maxLength: z.number().int().min(50).max(500).default(150),
    userContext: z.string().max(500, 'Context too long').optional(),
    generateOptions: z.boolean().optional().default(false),
    optionCount: z.number().int().min(1).max(5).optional().default(3),
  })
  .strict();

export const generateImageSchema = z
  .object({
    prompt: z.string().min(1, 'Prompt is required').max(1000),
    style: z.enum(['realistic', 'cartoon', 'minimalist', 'vibrant']).default('realistic'),
    size: z.enum(['256x256', '512x512', '1024x1024']).default('512x512'),
  })
  .strict();

export const createSocialPostSchema = z
  .object({
    platform: z.enum(['instagram', 'facebook', 'twitter', 'whatsapp']),
    content: z.string().min(1, 'Content is required').max(5000),
    mediaUrls: z.array(z.string().url()).max(10).optional(),
    scheduledAt: z.string().datetime().optional(),
    hashtags: z
      .array(z.string().regex(/^#?[A-Za-z0-9_]+$/, 'Invalid hashtag'))
      .max(30)
      .optional(),
    restaurantId: z.string().uuid().optional(),
  })
  .strict();

export const schedulePostSchema = z
  .object({
    postId: z.string().uuid('Invalid post ID'),
    scheduledAt: z.string().datetime('Must be a valid ISO datetime'),
  })
  .strict();

export const updateCategorySchema = createCategorySchema.partial().strict();

export const reorderCategoriesSchema = z.object({
  order: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })),
}).strict();

export const bulkUpdateItemsSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  price: z.number().positive().optional(),
  isAvailable: z.boolean().optional(),
  categoryId: z.string().uuid().optional(),
}).strict();

export const openingHoursSchema = z.object({
  hours: z.array(z.object({
    dayOfWeek: z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']),
    openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
    closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format'),
    isClosed: z.boolean().default(false),
  })).length(7),
}).strict();

export const createBranchSchema = z.object({
  branchName: z.string().min(1).max(100),
  address: z.string().min(1).max(500),
  phone: z.string().regex(/^(\+254|0)[17]\d{8}$/, 'Must be a valid Kenyan phone number'),
  managerName: z.string().max(100).optional(),
}).strict();

export const createTableSchema = z.object({
  tableNumber: z.number().int().min(1),
  label: z.string().min(1).max(50),
  capacity: z.number().int().min(1).optional(),
  area: z.string().optional(),
  shape: z.string().optional(),
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
}).strict();

export const updateTableSchema = createTableSchema.partial().strict();

export const openShiftSchema = z.object({
  cashierId: z.string().uuid(),
}).strict();

export const closeShiftSchema = z.object({
  shiftId: z.string().uuid(),
  actualCash: z.number().positive(),
  notes: z.string().max(500).optional(),
}).strict();

export const generateFaqSchema = z.object({
  restaurantType: z.string().min(1),
  cuisineType: z.string().min(1),
}).strict();

export const generateSocialPostSchema = z.object({
  restaurantId: z.string().uuid(),
  postType: z.enum(['DAILY_SPECIAL', 'PROMOTION', 'ANNOUNCEMENT', 'ENGAGEMENT', 'SEASONAL', 'CUSTOM']),
  platform: z.enum(['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'WHATSAPP']),
  menuItemId: z.string().uuid().optional(),
  language: z.enum(['en', 'sw']).default('en'),
}).strict();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const orderListQuerySchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  tableNumber: z.coerce.number().int().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const historyQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const exportQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const paymentQuerySchema = z.object({
  method: z.enum(['mpesa', 'cash']).optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const reportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

export const taxReportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Admin schemas
export const suspendSchema = z.object({
  reason: z.string().min(1).max(500),
}).strict();

export const replyTicketSchema = z.object({
  message: z.string().min(1).max(5000),
}).strict();

export const broadcastSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  sendSms: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
}).strict();

// Marketing schemas
export const createPostSchema = z.object({
  platform: z.enum(['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'WHATSAPP']),
  contentText: z.string().min(1),
  contentTextSw: z.string().optional(),
  imageUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
  postType: z.enum(['DAILY_SPECIAL', 'PROMOTION', 'ANNOUNCEMENT', 'ENGAGEMENT', 'SEASONAL', 'CUSTOM']).default('PROMOTION'),
}).strict();

export const aiGenerateSchema = z.object({
  frequency: z.enum(['1x', '2x', 'daily']),
  platforms: z.array(z.enum(['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'WHATSAPP'])).min(1),
  style: z.string().optional(),
  autoApprove: z.boolean().default(false),
}).strict();

export const editPostSchema = z.object({
  contentText: z.string().optional(),
  contentTextSw: z.string().optional(),
  imageUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
}).strict();

// Surveillance schemas
export const addCameraSchema = z.object({
  name: z.string().min(1).max(100),
  ipAddress: z.string().ip({ version: 'v4' }).or(z.string().min(7)),
  port: z.number().int().min(1).max(65535).default(554),
  username: z.string().optional(),
  password: z.string().optional(),
  location: z.string().max(200).optional(),
}).strict();

export const updateCameraSchema = addCameraSchema.partial().strict();

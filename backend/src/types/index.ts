import { Request } from 'express';

export interface ApiResponse<T = undefined> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    messageSwahili: string;
  };
  meta?: {
    total: number;
    page: number;
    perPage: number;
  };
}

export interface JwtPayload {
  userId: string;
  role: 'super_admin' | 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'staff';
  restaurantId?: string;
  type: 'access' | 'refresh';
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface PaginationParams {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface MpesaCallbackMetadataItem {
  Name: string;
  Value: string | number;
}

export interface MpesaCallbackBody {
  Body?: {
    stkCallback?: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item?: MpesaCallbackMetadataItem[];
      };
    };
  };
}

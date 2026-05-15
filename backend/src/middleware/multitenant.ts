import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { ForbiddenError, UnauthorizedError, AppError } from '../utils/errors';
import logger from '../utils/logger';
import { asyncHandler } from '../utils/helpers';

export function extractRestaurantId(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required', 'Uhakiki unahitajika');
  }

  const fromJwt = req.user.restaurantId;
  const fromParams = req.params.restaurantId;
  const fromBody = req.body?.restaurantId;
  const fromQuery = req.query?.restaurantId as string;

  const restaurantId = fromJwt || fromParams || fromBody || fromQuery;

  if (!restaurantId) {
    throw new AppError(
      400,
      'RESTAURANT_ID_REQUIRED',
      'Restaurant ID is required',
      'Kitambulisho cha mgahawa kinahitajika'
    );
  }

  (req as any).restaurantId = restaurantId;
  next();
}

export function validateAccess(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required', 'Uhakiki unahitajika');
  }

  if (req.user.role === 'super_admin') {
    return next();
  }

  const resourceRestaurantId = (req as any).restaurantId || req.params.restaurantId;

  if (!resourceRestaurantId) {
    throw new AppError(
      400,
      'RESTAURANT_ID_REQUIRED',
      'Restaurant ID is required for access validation',
      'Kitambulisho cha mgahawa kinahitajika kwa uthibitisho wa ufikiaji'
    );
  }

  if (req.user.restaurantId && req.user.restaurantId !== resourceRestaurantId) {
    logger.warn('Cross-restaurant access attempt', {
      userId: req.user.userId,
      userRestaurantId: req.user.restaurantId,
      targetRestaurantId: resourceRestaurantId,
    });

    throw new ForbiddenError(
      'You do not have access to this restaurant\'s data',
      'Huna ufikiaji wa data ya mgahawa huu'
    );
  }

  next();
}

export function enforceRestaurantScope(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  if (req.user?.role === 'super_admin') {
    return next();
  }

  const restaurantId = req.user?.restaurantId || (req as any).restaurantId;

  if (!restaurantId) {
    throw new AppError(
      400,
      'RESTAURANT_ID_REQUIRED',
      'Restaurant context is required',
      'Muktadha wa mgahawa unahitajika'
    );
  }

  (req as any).restaurantId = restaurantId;

  next();
}

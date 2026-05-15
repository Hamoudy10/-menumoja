import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  owner: 80,
  manager: 60,
  cashier: 40,
  waiter: 30,
  kitchen: 20,
  staff: 10,
};

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'Uhakiki unahitajika');
    }

    const hasRole = roles.some((role) => {
      if (role === 'admin' || role === 'super_admin') {
        return req.user!.role === 'super_admin';
      }
      if (role.includes('+')) {
        const [baseRole, ...additional] = role.split('+');
        return req.user!.role === baseRole || additional.includes(req.user!.role);
      }
      return req.user!.role === role;
    });

    if (!hasRole) {
      const hierarchyMatch = roles.some((role) => {
        const userLevel = ROLE_HIERARCHY[req.user!.role];
        const requiredLevel = ROLE_HIERARCHY[role.replace('+', '')];
        return requiredLevel !== undefined && userLevel >= requiredLevel;
      });

      if (!hierarchyMatch) {
        throw new ForbiddenError(
          `Access denied. Required role: ${roles.join(' or ')}`,
          `Huna ruhusa. Wajibu unaohitajika: ${roles.join(' au ')}`
        );
      }
    }

    next();
  };
}

export function requireOwnership(modelName: string) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'Uhakiki unahitajika');
    }

    if (req.user.role === 'super_admin') {
      return next();
    }

    const paramRestaurantId = req.params.restaurantId || req.params.id;
    const bodyRestaurantId = req.body?.restaurantId;
    const queryRestaurantId = req.query?.restaurantId as string;

    const resourceRestaurantId = paramRestaurantId || bodyRestaurantId || queryRestaurantId;

    if (req.user.restaurantId && resourceRestaurantId && req.user.restaurantId !== resourceRestaurantId) {
      throw new ForbiddenError(
        `You do not have access to this ${modelName}`,
        `Huna ufikiaji wa ${modelName} hii`
      );
    }

    if (req.user.restaurantId && !resourceRestaurantId) {
      (req as any).restaurantId = req.user.restaurantId;
    }

    next();
  };
}

export function requireStaffRole(...roles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'Uhakiki unahitajika');
    }

    const allowedStaffRoles = roles.length > 0 ? roles : ['manager', 'cashier', 'waiter', 'kitchen'];

    if (!allowedStaffRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Staff role ${req.user.role} is not authorized for this action`,
        `Wajibu wa mfanyakazi ${req.user.role} haujaidhinishwa kwa kitendo hiki`
      );
    }

    if (!req.user.restaurantId) {
      throw new ForbiddenError(
        'Staff must be associated with a restaurant',
        'Mfanyakazi lazima ahusishwe na mgahawa'
      );
    }

    next();
  };
}

export function requireSelfOrAdmin() {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required', 'Uhakiki unahitajika');
    }

    if (req.user.role === 'super_admin') {
      return next();
    }

    const targetUserId = req.params.userId || req.params.id;

    if (targetUserId && req.user.userId !== targetUserId) {
      throw new ForbiddenError(
        'You can only access your own account',
        'Unaweza kufikia akaunti yako pekee'
      );
    }

    next();
  };
}

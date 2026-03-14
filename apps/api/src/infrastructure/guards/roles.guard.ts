import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    return requiredRoles.some((role) => this.hasRole(user.role, role));
  }

  private hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.SUPER_ADMIN]: 7,
      [UserRole.ADMIN]: 6,
      [UserRole.TEAM_LEAD]: 5,
      [UserRole.AGENT]: 4,
      [UserRole.TEACHER]: 3,
      [UserRole.PARENT]: 2,
      [UserRole.STUDENT]: 1,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }
}

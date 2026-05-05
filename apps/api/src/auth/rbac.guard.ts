import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthzService } from './authz.service';
import { ROLES_KEY } from './roles.decorator';
import type { AppRole, AuthIdentity, RequestPrincipal } from './auth.types';
import type { Request } from 'express';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthzService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const req = context.switchToHttp().getRequest<
      Request & { principal?: RequestPrincipal; partialIdentity?: AuthIdentity }
    >();

    const identity = req.partialIdentity;
    if (!identity) {
      throw new ForbiddenException('Not authenticated');
    }

    const principal = await this.authz.resolvePrincipal(identity);
    req.principal = principal;

    if (!required?.length) {
      return true;
    }

    if (!this.authz.principalHasAnyRole(principal, required)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}

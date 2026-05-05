import { SetMetadata } from '@nestjs/common';
import { AppRole } from './auth.types';

export const ROLES_KEY = 'protect:roles';

export const RequireRoles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

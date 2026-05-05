import type { AuthIdentity, RequestPrincipal } from '../auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      partialIdentity?: AuthIdentity;
      principal?: RequestPrincipal;
      requestId?: string;
    }
  }
}

export {};

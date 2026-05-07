import { handlers } from '@/auth';

/** Force Node: Auth.js + jose need full Node crypto; avoid experimental Edge for this route. */
export const runtime = 'nodejs';

export const { GET, POST } = handlers;

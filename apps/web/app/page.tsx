import { redirect } from 'next/navigation';

/** `/` is handled in middleware (OAuth or → /dashboard); this is a fallback. */
export default function HomePage() {
  redirect('/dashboard');
}

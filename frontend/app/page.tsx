'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { firstAllowedRoute } from '@/lib/routing';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getSession() ? firstAllowedRoute(getSession()?.allowedModules) : '/login');
  }, [router]);

  return null;
}

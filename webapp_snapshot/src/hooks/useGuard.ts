import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { can, canView } from '@/lib/permissions';

export function useGuard(requiredModule: string, requiredAction?: string) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated) {
          router.replace('/login');
          return;
        }

        const hasModule = canView(data.user, requiredModule);
        const hasAction = !requiredAction || can(data.user, requiredAction);

        if (!hasModule || !hasAction) {
          router.replace('/'); 
        } else {
          setUser(data.user);
          setAuthorized(true);
        }
      })
      .catch(() => {
        router.replace('/');
      });
  }, [router, requiredModule, requiredAction]);

  return { authorized, user };
}

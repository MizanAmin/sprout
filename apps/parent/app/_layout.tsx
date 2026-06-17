import '../global.css'; // MUST be the first import — registers NativeWind styles
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@sprout/db/native';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (
          ['UNAUTHORIZED', 'FORBIDDEN', 'TRIAL_EXPIRED', 'PLAN_UPGRADE_REQUIRED'].includes(
            error?.code,
          )
        )
          return false;
        return failureCount < 2;
      },
    },
  },
});

// Redirect based on auth state: unauthenticated → (auth)/login; authenticated
// users sitting on an auth screen → (tabs).
function useAuthGuard(session: Session | null, ready: boolean) {
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, ready, segments, router]);
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Session is persisted in expo-secure-store via the native client.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useAuthGuard(session, ready);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}

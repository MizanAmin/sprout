import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { supabase } from '@sprout/db';
import { router } from './router';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Never retry auth or billing errors — they won't resolve on retry.
        if (
          ['UNAUTHORIZED', 'FORBIDDEN', 'TRIAL_EXPIRED', 'PLAN_UPGRADE_REQUIRED'].includes(
            error?.code,
          )
        )
          return false;
        return failureCount < 2;
      },
    },
    mutations: {
      onError: (error: any) => {
        if (error?.code === 'UNAUTHORIZED') {
          supabase.auth.signOut();
          router.navigate({ to: '/login' });
        } else if (error?.code === 'TRIAL_EXPIRED' || error?.code === 'PLAN_UPGRADE_REQUIRED') {
          router.navigate({ to: '/billing' });
        }
      },
    },
  },
});

// Global query-error handler — catches auth expiry on any route without per-page
// boilerplate (mutations are handled by defaultOptions.mutations.onError above).
queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== 'updated') return;
  const error = event.query.state.error as any;
  if (error?.code === 'UNAUTHORIZED') {
    supabase.auth.signOut();
    router.navigate({ to: '/login' });
  } else if (error?.code === 'TRIAL_EXPIRED' || error?.code === 'PLAN_UPGRADE_REQUIRED') {
    router.navigate({ to: '/billing' });
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);

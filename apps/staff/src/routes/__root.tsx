import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@sprout/db';

export const Route = createRootRoute({ component: RootShell });

// Session type, inferred so we don't need a direct @supabase/supabase-js import.
type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

// Primary navigation. Full page set lives under src/routes; this is a curated
// sidebar — extend as sections are built out.
const NAV: { to: string; label: string }[] = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/children', label: 'Children' },
  { to: '/relatives', label: 'Relatives' },
  { to: '/rooms', label: 'Rooms' },
  { to: '/staff', label: 'Staff' },
  { to: '/register', label: 'Live Register' },
  { to: '/daily-logs', label: 'Daily Logs' },
  { to: '/journal', label: 'Learning Journal' },
  { to: '/assessment', label: 'Assessment' },
  { to: '/messages', label: 'Messages' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/finance', label: 'Finance' },
  { to: '/reports', label: 'Reports' },
  { to: '/compliance', label: 'Compliance' },
  { to: '/settings', label: 'Settings' },
];

function RootShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [session, setSession] = useState<Session>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const isLogin = pathname === '/login';

  useEffect(() => {
    if (!ready) return;
    if (!session && !isLogin) navigate({ to: '/login' });
    if (session && isLogin) navigate({ to: '/dashboard' });
  }, [ready, session, isLogin, navigate]);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;
  }
  // Login screen renders standalone (no app shell).
  if (isLogin) return <Outlet />;
  // Signed out on a protected route — redirecting via the effect above.
  if (!session) return null;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: '/login' });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-white">
        <div className="px-5 py-5 text-lg font-semibold">🌱 Sprout</div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white [&.active]:bg-white/15 [&.active]:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="m-2 rounded-md px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
        >
          Sign out
        </button>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

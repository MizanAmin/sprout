import { createRootRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { supabase } from '@sprout/db';
import { useCurrentUser, planAtLeast, type Plan } from '../features/auth/useCurrentUser';
import { QuickJump } from '../components/QuickJump';
import { initTheme, isDark, toggleTheme } from '../lib/theme';

export const Route = createRootRoute({ component: RootShell });

type Session = Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'];

// Navigation grouped into sections. `mgr` items are hidden from non-manager
// staff (the API also enforces this server-side); `plan` items are hidden below
// the required tier. Dashboard sits above the groups as a standalone item.
type NavItem = { to: string; label: string; mgr?: boolean; plan?: Plan };

const DASHBOARD: NavItem = { to: '/dashboard', label: 'Dashboard' };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'People',
    items: [
      { to: '/children', label: 'Children' },
      { to: '/relatives', label: 'Relatives' },
      { to: '/staff', label: 'Staff' },
      { to: '/staff-dev', label: 'Staff Development', mgr: true, plan: 'blossom' },
      { to: '/enquiries', label: 'Enquiries', mgr: true },
      { to: '/waiting-list', label: 'Waiting List', mgr: true },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/register', label: 'Live Register' },
      { to: '/rooms', label: 'Rooms' },
      { to: '/rota', label: 'Staff Rota' },
      { to: '/sessions', label: 'Sessions & Funding' },
      { to: '/booking-requests', label: 'Booking Requests' },
      { to: '/daily-logs', label: 'Daily Logs' },
      { to: '/monitoring', label: 'Monitoring' },
      { to: '/calendar', label: 'Calendar' },
      { to: '/messages', label: 'Messages' },
      { to: '/newsfeed', label: 'Newsfeed' },
      { to: '/consents', label: 'Consent Forms', mgr: true },
    ],
  },
  {
    title: 'Pedagogy',
    items: [
      { to: '/planning', label: 'Planning' },
      { to: '/assessment', label: 'Assessment' },
      { to: '/journal', label: 'Learning Journal' },
      { to: '/reflections', label: 'Reflections' },
      { to: '/send', label: 'SEND' },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { to: '/medications', label: 'Medications' },
      { to: '/incidents', label: 'Incidents' },
      { to: '/accident-book', label: 'Accident Book' },
      { to: '/fire-register', label: 'Fire Register' },
      { to: '/ofsted', label: 'Ofsted Mode', mgr: true },
      { to: '/compliance', label: 'Compliance Hub', mgr: true, plan: 'blossom' },
      { to: '/gdpr', label: 'GDPR', mgr: true },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/invoices', label: 'Invoices', mgr: true },
      { to: '/finance', label: 'Finance', mgr: true },
      { to: '/funding', label: 'Funding', mgr: true },
      { to: '/funded-hours', label: 'Funded Hours', mgr: true },
      { to: '/revenue-report', label: 'Revenue Report', mgr: true },
      { to: '/reports', label: 'Reports', mgr: true },
      { to: '/users', label: 'Staff Accounts', mgr: true },
      { to: '/settings', label: 'Settings', mgr: true },
      { to: '/billing', label: 'Billing', mgr: true },
    ],
  },
];

function RootShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [session, setSession] = useState<Session>(null);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);
  // Collapsed nav groups (by title), persisted across reloads. Default: all open.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('nav.collapsed') ?? '[]'));
    } catch {
      return new Set();
    }
  });
  const user = useCurrentUser();

  const toggleGroup = (title: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      localStorage.setItem('nav.collapsed', JSON.stringify([...next]));
      return next;
    });

  useEffect(() => {
    initTheme();
    setDark(isDark());
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const isLogin = pathname === '/login';
  // The second-factor step renders bare (no nav shell) but requires a session.
  const isMfa = pathname === '/mfa';

  useEffect(() => {
    if (!ready) return;
    if (!session && !isLogin) navigate({ to: '/login' });
    if (session && isLogin) navigate({ to: '/dashboard' });
  }, [ready, session, isLogin, navigate]);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;
  }
  if (isLogin) return <Outlet />;
  if (!session) return null;
  if (isMfa) return <Outlet />;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: '/login' });
  }

  // Hide manager-only items from staff, and plan-gated items below the tier.
  const canSee = (n: NavItem) => {
    if (n.mgr && user && user.role !== 'manager') return false;
    if (n.plan && user && !planAtLeast(user.plan, n.plan)) return false;
    return true;
  };
  const visibleGroups = NAV_GROUPS.map((g) => ({
    title: g.title,
    items: g.items.filter(canSee),
  })).filter((g) => g.items.length > 0);
  // Flat list (Dashboard + all visible items) for the ⌘K palette and topbar title.
  const flatNav = [DASHBOARD, ...NAV_GROUPS.flatMap((g) => g.items)].filter(canSee);
  // Topbar title = the deepest matching nav label.
  const current = [...flatNav]
    .filter((n) => pathname === n.to || pathname.startsWith(n.to + '/'))
    .sort((a, b) => b.to.length - a.to.length)[0];

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-white">
        <div className="flex items-center gap-2 px-5 py-5 text-lg font-semibold">🌱 Sprout</div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <Link
            to={DASHBOARD.to}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/55 transition hover:bg-sidebar-hover hover:text-white/90 [&.active]:bg-sidebar-active [&.active]:font-semibold [&.active]:text-indigo-300"
          >
            {DASHBOARD.label}
          </Link>
          {visibleGroups.map((group) => {
            const isCollapsed = collapsed.has(group.title);
            return (
              <div key={group.title} className="mt-4 space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between rounded-lg px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-white/35 transition hover:text-white/70"
                >
                  {group.title}
                  <span
                    className={`text-[9px] transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  >
                    ▶
                  </span>
                </button>
                {!isCollapsed &&
                  group.items.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/55 transition hover:bg-sidebar-hover hover:text-white/90 [&.active]:bg-sidebar-active [&.active]:font-semibold [&.active]:text-indigo-300"
                    >
                      {item.label}
                    </Link>
                  ))}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Sticky translucent topbar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/80 px-6 backdrop-blur">
          <h2 className="text-base font-semibold text-gray-900">{current?.label ?? ''}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const e = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
                window.dispatchEvent(e);
              }}
              className="hidden items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:text-gray-900 sm:flex"
              title="Quick jump"
            >
              🔎 Jump <kbd className="rounded bg-gray-100 px-1 font-sans text-[10px]">⌘K</kbd>
            </button>
            <button
              onClick={() => setDark(toggleTheme())}
              className="rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-gray-100"
              title="Toggle dark mode"
            >
              {dark ? '☀️' : '🌙'}
            </button>
            {user?.name && <span className="hidden text-sm text-muted md:inline">{user.name}</span>}
            <button
              onClick={signOut}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <QuickJump items={flatNav.map((n) => ({ to: n.to, label: n.label }))} />
    </div>
  );
}

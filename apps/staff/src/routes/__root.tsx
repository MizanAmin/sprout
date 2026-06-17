import { createRootRoute, Link, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({ component: RootShell });

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
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

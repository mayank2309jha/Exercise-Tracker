import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Activity, BookOpen, Footprints, History, LayoutDashboard, MoreHorizontal, Plus, Ruler, Settings, Target, TrendingUp, X } from 'lucide-react';
import { useStore } from '../data/store';
import { cx, Notice } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/log', label: 'Log Workout', icon: Plus },
  { to: '/library', label: 'Exercise Library', icon: BookOpen },
  { to: '/history', label: 'Workout History', icon: History },
  { to: '/strength', label: 'Strength Progress', icon: TrendingUp },
  { to: '/cardio', label: 'Cardio Analytics', icon: Footprints },
  { to: '/body', label: 'Body Measurements', icon: Ruler },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/settings', label: 'Settings & Profile', icon: Settings },
];

const MOBILE_PRIMARY = ['/', '/log', '/history', '/body'];

export function Layout({ children }: { children: ReactNode }) {
  const { state, loadError, saveError } = useStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-ink-950 text-ink-100">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-800 bg-ink-900/60 px-3 py-5 backdrop-blur lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400 text-ink-950">
            <Activity size={18} strokeWidth={2.5} aria-hidden />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Exercise Tracker</div>
            <div className="text-[11px] text-ink-500">Personal dashboard</div>
          </div>
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors', isActive ? 'bg-ink-800 font-medium text-ink-100' : 'text-ink-400 hover:bg-ink-800/60 hover:text-ink-100')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-lime-400' : ''} aria-hidden />
                  {label}
                  {to === '/log' && state.draft && <span className="ml-auto rounded-full bg-lime-400/15 px-1.5 text-[10px] font-semibold text-lime-300">LIVE</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 text-[11px] leading-relaxed text-ink-500">
          Data is stored in this browser. Export a backup from Settings.
        </div>
      </aside>

      {/* Main */}
      <main className="pb-24 lg:pb-10 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          {(loadError || saveError) && !dismissed && (
            <div className="mb-4">
              <Notice tone="danger" onClose={() => setDismissed(true)}>
                {loadError ?? 'Could not save to browser storage. Export your data from Settings to avoid losing changes.'}
              </Notice>
            </div>
          )}
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-800 bg-ink-900/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {NAV.filter((n) => MOBILE_PRIMARY.includes(n.to)).map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-1 py-2.5 text-[10px]', isActive ? 'text-lime-400' : 'text-ink-400')}>
              {to === '/log' ? (
                <span className="-mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-lime-400 text-ink-950 shadow-lg shadow-lime-400/20">
                  <Plus size={22} strokeWidth={2.5} aria-hidden />
                </span>
              ) : (
                <Icon size={20} aria-hidden />
              )}
              {label.split(' ')[0] === 'Log' ? 'Log' : label.split(' ')[0]}
            </NavLink>
          ))}
          <button type="button" onClick={() => setMoreOpen(true)} className={cx('flex flex-col items-center gap-1 py-2.5 text-[10px]', !MOBILE_PRIMARY.includes(loc.pathname) ? 'text-lime-400' : 'text-ink-400')}>
            <MoreHorizontal size={20} aria-hidden />
            More
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-ink-700 bg-ink-900 p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">More</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close menu" className="rounded-lg p-1 text-ink-400">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NAV.filter((n) => !MOBILE_PRIMARY.includes(n.to)).map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} onClick={() => setMoreOpen(false)} className={({ isActive }) => cx('flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm', isActive ? 'border-lime-700/60 bg-ink-800 text-ink-100' : 'border-ink-800 text-ink-300')}>
                  <Icon size={18} aria-hidden />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


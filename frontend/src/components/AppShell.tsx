import type { ReactNode } from 'react'
import type { PageName, Route } from '../hooks/useRoute'
import './AppShell.css'

interface AppShellProps {
  route: Route
  navigate: (route: Route) => void
  activeWellName?: string | null
  children: ReactNode
}

const NAV_ITEMS: { page: PageName; label: string; icon: ReactNode }[] = [
  {
    page: 'overview',
    label: 'Overview',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    page: 'wells',
    label: 'Wells',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M10 2v6.5L4.2 19.8A1.4 1.4 0 0 0 5.4 22h13.2a1.4 1.4 0 0 0 1.2-2.2L14 8.5V2" />
        <path d="M9 2h6" />
        <path d="M7.5 14h9" />
      </svg>
    ),
  },
  {
    page: 'map',
    label: 'Explore Map',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M9 5 3 7.5v13L9 18l6 2.5 6-2.5v-13L15 7.5 9 5Z" />
        <path d="M9 5v13" />
        <path d="M15 7.5v13" />
      </svg>
    ),
  },
]

export function AppShell({ route, navigate, activeWellName, children }: AppShellProps) {
  return (
    <div className="gl-shell">
      <nav className="gl-sidebar" aria-label="Primary">
        <button
          className="gl-brand"
          onClick={() => navigate({ page: 'overview', wellId: null })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <span className="gl-brand-mark">GroundLog</span>
          <span className="gl-brand-tag">Grounded subsurface data-quality &amp; query platform</span>
        </button>

        <div className="gl-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.page}
              className={`gl-nav-item${route.page === item.page ? ' is-active' : ''}`}
              onClick={() => navigate({ page: item.page, wellId: null })}
              aria-current={route.page === item.page ? 'page' : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {route.page === 'workspace' && (
          <div className="gl-workspace-context">
            <div className="gl-workspace-context-label">Well workspace</div>
            <div className="gl-workspace-context-well">{activeWellName ?? 'Loading…'}</div>
          </div>
        )}

        <div className="gl-sidebar-footer">
          Solo-built portfolio project.
          <br />
          <a href="https://github.com/vhugo23/slb-groundlog" target="_blank" rel="noopener noreferrer">
            View source on GitHub
          </a>
        </div>
      </nav>

      <main className="gl-content">{children}</main>
    </div>
  )
}

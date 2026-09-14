import { useCallback, useEffect, useState } from 'react'

export type PageName = 'overview' | 'wells' | 'workspace' | 'map'

export interface Route {
  page: PageName
  wellId: number | null
}

// Deliberately not react-router: at this scope (four screens, one of which
// takes an id) a ~30-line hash parser is simpler to reason about than a
// routing dependency, while still giving real URLs, browser back/forward,
// and a shareable/bookmarkable link to a specific well's workspace.
function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const parts = clean.split('/').filter(Boolean)

  if (parts[0] === 'wells' && parts[1]) {
    const id = Number(parts[1])
    return { page: 'workspace', wellId: Number.isFinite(id) ? id : null }
  }
  if (parts[0] === 'wells') return { page: 'wells', wellId: null }
  if (parts[0] === 'map') return { page: 'map', wellId: null }
  return { page: 'overview', wellId: null }
}

function routeToHash(route: Route): string {
  if (route.page === 'workspace' && route.wellId !== null) return `#/wells/${route.wellId}`
  if (route.page === 'wells') return '#/wells'
  if (route.page === 'map') return '#/map'
  return '#/'
}

export function useRoute() {
  const [route, setRouteState] = useState<Route>(() =>
    typeof window !== 'undefined' ? parseHash(window.location.hash) : { page: 'overview', wellId: null }
  )

  useEffect(() => {
    const onHashChange = () => setRouteState(parseHash(window.location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((next: Route) => {
    const hash = routeToHash(next)
    if (window.location.hash !== hash) {
      window.location.hash = hash
    } else {
      setRouteState(next)
    }
  }, [])

  return { route, navigate }
}

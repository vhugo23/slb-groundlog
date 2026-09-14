import { AppShell } from './components/AppShell'
import { OverviewPage } from './components/OverviewPage'
import { WellsPage } from './components/WellsPage'
import { WellWorkspace } from './components/WellWorkspace'
import { ExploreMap } from './components/ExploreMap'
import { useWells } from './hooks/useWells'
import { useRoute } from './hooks/useRoute'
import './styles/tokens.css'
import './styles/base.css'
import './styles/pages.css'

function App() {
  const { wells, loading: wellsLoading, error: wellsError, isSlow: wellsSlow } = useWells()
  const { route, navigate } = useRoute()

  function openWell(wellId: number) {
    navigate({ page: 'workspace', wellId })
  }

  const activeWell = route.wellId !== null ? wells.find((w) => w.id === route.wellId) ?? null : null

  return (
    <AppShell route={route} navigate={navigate} activeWellName={activeWell?.name}>
      {route.page === 'overview' && (
        <OverviewPage
          wells={wells}
          wellsLoading={wellsLoading}
          wellsError={wellsError}
          wellsSlow={wellsSlow}
          onOpenWell={openWell}
          onOpenMap={() => navigate({ page: 'map', wellId: null })}
          onOpenWells={() => navigate({ page: 'wells', wellId: null })}
        />
      )}

      {route.page === 'wells' && (
        <WellsPage wells={wells} loading={wellsLoading} error={wellsError} isSlow={wellsSlow} onOpenWell={openWell} />
      )}

      {route.page === 'workspace' && route.wellId !== null && (
        <WellWorkspace
          wellId={route.wellId}
          wellSummary={activeWell}
          onBack={() => navigate({ page: 'wells', wellId: null })}
        />
      )}

      {route.page === 'map' && (
        <div style={{ height: '100vh', padding: 'var(--space-5)' }}>
          <ExploreMap wells={wells} onOpenWell={openWell} height="100%" />
        </div>
      )}
    </AppShell>
  )
}

export default App

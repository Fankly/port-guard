import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { AppInfo } from '../bridge'
import {
  loadDesktopState,
  readAppInfo,
} from '../bridge'
import { emptyState } from '../data'
import { useAppStore } from '../store/app-store'

type Bootstrap = {
  state: Awaited<ReturnType<typeof loadDesktopState>>
  info: AppInfo | null
}

export type BootstrapStatus = 'loading' | 'ready' | 'error'

/**
 * Desktop state is loaded through TanStack Query so the first paint has a real
 * loading/error surface. The browser preview stays synchronous and local.
 */
export function useBootstrap() {
  const desktop = true // Both WebView and browser now require the real backend.
  const hydrate = useAppStore(state => state.hydrate)
  const [status, setStatus] = useState<BootstrapStatus>(
    desktop ? 'loading' : 'ready',
  )
  const hydrated = useRef(false)

  const query = useQuery<Bootstrap>({
    queryKey: ['desktop-bootstrap'],
    enabled: desktop,
    retry: 1,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const [state, info] = await Promise.all([
        loadDesktopState(),
        readAppInfo(),
      ])
      return { state, info }
    },
  })

  useEffect(() => {
    if (!desktop) return
    if (query.isSuccess) {
      if (!hydrated.current) {
        hydrate(query.data.state ?? emptyState(query.data.info?.platform))
        hydrated.current = true
      }
      setStatus('ready')
    } else if (query.isError) {
      setStatus('error')
    }
  }, [desktop, query.isSuccess, query.isError, query.data, hydrate])

  return {
    desktop,
    status,
    info: query.data?.info ?? null,
    retry: query.refetch,
    retrying: query.isFetching,
  }
}

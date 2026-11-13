import { useQuery } from '@tanstack/react-query'
import { readSystemRules } from '../bridge'

/** Shared host snapshot for the sidebar and rule list. */
export function useSystemRules(enabled = true) {
  return useQuery({
    queryKey: ['system-rules'], queryFn: readSystemRules, enabled,
    retry: false, staleTime: 30000, refetchOnWindowFocus: false,
  })
}

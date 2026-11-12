import { useCallback, useEffect, useState } from 'react'

export const pageIds = [
  'overview',
  'rules',
  'access',
  'operations',
  'settings',
] as const

export type PageId = (typeof pageIds)[number]

const titles: Record<PageId, string> = {
  overview: '总览',
  rules: '端口规则',
  access: '访问日志',
  operations: '操作日志',
  settings: '设置',
}

function pageFromHash(): PageId {
  const value = window.location.hash.replace(/^#\/?/, '')
  return pageIds.includes(value as PageId) ? (value as PageId) : 'overview'
}

export function useRoute() {
  const [page, setPage] = useState<PageId>(pageFromHash)

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    document.title = `${titles[page]} · Port Guard`
  }, [page])

  const navigate = useCallback((next: PageId) => {
    setPage(next)
    if (window.location.hash !== `#/${next}`) {
      window.location.hash = `#/${next}`
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  return { page, navigate }
}

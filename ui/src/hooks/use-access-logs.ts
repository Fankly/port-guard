import { useQuery } from '@tanstack/react-query'
import { readAccessLogs } from '../bridge'
import { formatTime } from '../data'
import type { AccessEvent } from '../data'

const labels = { connected: 'PF 日志已读取', missing_interface: '缺少 PFLOG 接口', permission: '需要日志读取权限', error: '日志读取失败', unsupported: '该平台日志待接入' }

export function useAccessLogs(enabled = true) {
  const query = useQuery({
    queryKey: ['access-logs'], queryFn: readAccessLogs, enabled, retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: query => query.state.data?.status === 'connected' ? 1500 : false,
  })
  const events: AccessEvent[] = (query.data?.events ?? []).map(record => ({
    ...record, time: formatTime(new Date(record.timestampMs)), count: 1,
  }))
  return { ...query, events, statusLabel: query.isError ? '日志后端连接失败' : query.data ? labels[query.data.status] : '正在检查日志源' }
}

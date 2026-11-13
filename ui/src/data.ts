import ipaddr from 'ipaddr.js'
import { detectPlatform } from './lib/platform'

export type Protocol = 'tcp' | 'udp'
export type Source = { address: string; label: string }
export type Rule = {
  id: string
  name: string
  port: number
  protocols: Protocol[]
  sources: Source[]
  enabled: boolean
  updatedAt: string
}
export type AccessEvent = {
  id: string
  time: string
  source: string
  port: number
  protocol: Protocol
  result: 'allow' | 'block'
  count: number
  direction?: 'in' | 'out'
  local?: string
  ruleLabel?: string
  sourcePort?: number
  destinationPort?: number
}
export type Operation = {
  id: string
  time: string
  action: string
  detail: string
  port?: number
  result: '成功' | '失败'
}
export type Preferences = {
  interface: string
  logInterface: string
  retention: string
  launchAtLogin: boolean
  notifyBlocked: boolean
  notifyLogGap: boolean
}
export type PreviewState = {
  rules: Rule[]
  operations: Operation[]
  preferences: Preferences
}

export const demoRules: Rule[] = [
  {
    id: 'web', name: '办公 Web 服务', port: 8080, protocols: ['tcp'], enabled: true,
    updatedAt: '2026-11-12 10:38',
    sources: [
      { address: '192.168.1.10', label: '办公电脑' },
      { address: '192.168.1.11', label: '同事的电脑' },
      { address: '192.168.2.0/24', label: '办公室网段' },
    ],
  },
  {
    id: 'ssh', name: 'SSH 远程终端', port: 22, protocols: ['tcp'], enabled: true,
    updatedAt: '2026-11-12 09:24',
    sources: [
      { address: '192.168.1.10', label: '办公电脑' },
      { address: '2001:db8::10', label: 'IPv6 工作站' },
    ],
  },
  {
    id: 'postgres', name: 'PostgreSQL 数据库', port: 5432, protocols: ['tcp'], enabled: true,
    updatedAt: '2026-11-11 16:42',
    sources: [{ address: '192.168.2.0/24', label: '办公室网段' }],
  },
  {
    id: 'redis', name: 'Redis 缓存服务', port: 6379, protocols: ['tcp'], enabled: false,
    updatedAt: '2026-11-11 15:18',
    sources: [{ address: '192.168.1.20', label: '开发工作站' }],
  },
  {
    id: 'dns', name: '本地 DNS 服务', port: 53, protocols: ['tcp', 'udp'], enabled: false,
    updatedAt: '2026-11-11 14:05',
    sources: [
      { address: '192.168.1.0/24', label: '本地网络' },
      { address: '2001:db8::/64', label: 'IPv6 本地网络' },
    ],
  },
]

// Illustrative, aggregated filter events. These are never read from the host firewall.
export const demoAccess: AccessEvent[] = [
  { id: 'a1', time: '2026-11-12 10:42:18', source: '192.168.1.10', port: 8080, protocol: 'tcp', result: 'allow', count: 654 },
  { id: 'a2', time: '2026-11-12 10:42:16', source: '192.168.1.88', port: 8080, protocol: 'tcp', result: 'block', count: 84 },
  { id: 'a3', time: '2026-11-12 10:42:12', source: '192.168.1.11', port: 8080, protocol: 'tcp', result: 'allow', count: 498 },
  { id: 'a4', time: '2026-11-12 10:41:56', source: '192.168.1.10', port: 22, protocol: 'tcp', result: 'allow', count: 204 },
  { id: 'a5', time: '2026-11-12 10:41:48', source: '10.0.0.24', port: 5432, protocol: 'tcp', result: 'block', count: 12 },
  { id: 'a6', time: '2026-11-12 10:40:22', source: '192.168.2.18', port: 5432, protocol: 'tcp', result: 'allow', count: 126 },
  { id: 'a7', time: '2026-11-12 10:38:05', source: '192.168.1.66', port: 22, protocol: 'tcp', result: 'block', count: 32 },
]

export const demoOperations: Operation[] = [
  { id: 'o1', time: '2026-11-12 10:38:00', action: '更新白名单', detail: '办公 Web 服务 · 新增办公室网段 192.168.2.0/24', port: 8080, result: '成功' },
  { id: 'o2', time: '2026-11-12 09:24:00', action: '更新白名单', detail: 'SSH 远程终端 · 新增 IPv6 工作站 2001:db8::10', port: 22, result: '成功' },
  { id: 'o3', time: '2026-11-11 16:42:00', action: '创建端口规则', detail: 'PostgreSQL 数据库 · TCP · 1 个来源地址', port: 5432, result: '成功' },
  { id: 'o4', time: '2026-11-11 15:18:00', action: '停用端口规则', detail: 'Redis 缓存服务 · 恢复系统原有策略', port: 6379, result: '成功' },
  { id: 'o5', time: '2026-11-11 14:05:00', action: '创建端口规则', detail: '本地 DNS 服务 · TCP + UDP · 2 个来源地址', port: 53, result: '成功' },
]

/** First-run demo values follow the host platform instead of assuming macOS. */
const platform = detectPlatform()
const networkDefaults =
  platform === 'windows'
    ? { interface: '以太网', logInterface: 'WFP Net Events' }
    : platform === 'macos'
      ? { interface: 'en0', logInterface: 'pflog7' }
      : { interface: '默认接口', logInterface: '系统日志' }

export const defaultPreferences: Preferences = {
  interface: networkDefaults.interface,
  logInterface: networkDefaults.logInterface,
  retention: '7',
  launchAtLogin: true,
  notifyBlocked: false,
  notifyLogGap: true,
}

/** A real empty database starts empty; illustrative rules are never seeded. */
export function emptyState(reportedPlatform?: string): PreviewState {
  const platform = detectPlatform(reportedPlatform)
  return {
    rules: [],
    operations: [],
    preferences: {
      ...defaultPreferences,
      interface: platform === 'windows' ? '以太网' : platform === 'macos' ? 'en0' : '默认接口',
      logInterface: platform === 'windows' ? 'WFP Net Events' : platform === 'macos' ? 'pflog7' : '系统日志',
      launchAtLogin: false,
    },
  }
}

// No capture backend exists yet. Never present illustrative packets as data.
export const accessEvents: AccessEvent[] = []

const initialState: PreviewState = {
  rules: demoRules,
  operations: demoOperations,
  preferences: defaultPreferences,
}
const storageKey = 'port-guard-preview-v2'

export function createId(prefix: string): string {
  const value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${value}`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

export function formatTime(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date)
}

export function shortTime(value: string): string {
  return value.slice(11, 16)
}

export function dayOf(value: string): string {
  return value.slice(0, 10)
}

export function friendlyDay(day: string): string {
  const today = formatTime().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000)
  const previous = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(yesterday)
  if (day === today) return '今天'
  if (day === previous) return '昨天'
  const [year, month, date] = day.split('-')
  return year === today.slice(0, 4) ? `${Number(month)} 月 ${Number(date)} 日` : `${year} 年 ${Number(month)} 月 ${Number(date)} 日`
}

export function protocolLabel(protocols: Protocol[]): string {
  return protocols.map(protocol => protocol.toUpperCase()).join(' + ')
}

export function normalizeAddress(input: string): string {
  const value = input.trim()
  const parts = value.split('/')
  if (parts.length > 2 || !parts[0] || /\s/.test(value)) throw new Error('请输入有效的 IP 地址或 CIDR 网段。')
  const raw = parts[0]
  if (!raw.includes(':') && !/^(0|[1-9]\d{0,2})(\.(0|[1-9]\d{0,2})){3}$/.test(raw)) {
    throw new Error('IPv4 地址需要包含完整的四段数字。')
  }
  if (!ipaddr.isValid(raw)) throw new Error('地址格式不正确，请检查后再添加。')
  const address = ipaddr.parse(raw)
  if (parts.length === 1) return address.toString()
  const maximum = address.kind() === 'ipv4' ? 32 : 128
  if (!/^(0|[1-9]\d{0,2})$/.test(parts[1]) || Number(parts[1]) > maximum) {
    throw new Error(`这个地址的网段前缀应为 0–${maximum}。`)
  }
  const prefix = Number(parts[1])
  const bytes = address.toByteArray().map((byte, index) => {
    const bits = Math.max(0, Math.min(8, prefix - index * 8))
    return byte & (255 << (8 - bits))
  })
  return `${ipaddr.fromByteArray(bytes).toString()}/${prefix}`
}

export function readPreview(): PreviewState {
  try {
    const stored = localStorage.getItem(storageKey)
    if (!stored) return initialState
    const data: unknown = JSON.parse(stored)
    if (!data || typeof data !== 'object') return initialState
    const candidate = data as PreviewState
    if (!Array.isArray(candidate.rules) || !Array.isArray(candidate.operations) || !candidate.preferences) return initialState
    const rulesValid = candidate.rules.every(rule =>
      typeof rule.id === 'string' && typeof rule.name === 'string' &&
      Number.isInteger(rule.port) && rule.port > 0 && rule.port <= 65535 &&
      typeof rule.enabled === 'boolean' && typeof rule.updatedAt === 'string' &&
      Array.isArray(rule.protocols) && rule.protocols.length > 0 && rule.protocols.every(p => p === 'tcp' || p === 'udp') &&
      Array.isArray(rule.sources) && rule.sources.every(s => typeof s.address === 'string' && typeof s.label === 'string'),
    )
    const operationsValid = candidate.operations.every(op =>
      typeof op.id === 'string' && typeof op.time === 'string' &&
      typeof op.action === 'string' && typeof op.detail === 'string' &&
      (op.result === '成功' || op.result === '失败'),
    )
    if (!rulesValid || !operationsValid) return initialState
    const preferences = candidate.preferences
    return {
      rules: candidate.rules,
      operations: candidate.operations.slice(0, 100),
      preferences: {
        interface: typeof preferences.interface === 'string' ? preferences.interface : defaultPreferences.interface,
        logInterface: typeof preferences.logInterface === 'string' ? preferences.logInterface : defaultPreferences.logInterface,
        retention: ['7', '14', '30'].includes(preferences.retention) ? preferences.retention : '7',
        launchAtLogin: typeof preferences.launchAtLogin === 'boolean' ? preferences.launchAtLogin : true,
        notifyBlocked: typeof preferences.notifyBlocked === 'boolean' ? preferences.notifyBlocked : false,
        notifyLogGap: typeof preferences.notifyLogGap === 'boolean' ? preferences.notifyLogGap : true,
      },
    }
  } catch {
    return initialState
  }
}

export function savePreview(state: PreviewState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // A design preview should keep working even when storage is unavailable.
  }
}

export function resetPreview(): PreviewState {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // Ignore unavailable storage; the caller resets in-memory state too.
  }
  return {
    rules: demoRules.map(rule => ({ ...rule, sources: rule.sources.map(source => ({ ...source })) })),
    operations: demoOperations.map(operation => ({ ...operation })),
    preferences: { ...defaultPreferences },
  }
}

export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map(row => row.map(cell => {
    const value = String(cell)
    return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
  }).join(',')).join('\r\n')
}

export { initialState }

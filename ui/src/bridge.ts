import { invoke } from '@tauri-apps/api/core'
import type { PreviewState } from './data'

export type AppInfo = {
  version: string
  platform: string
  arch: string
  database: string
  runtime: string
}

export type SystemRuleCategory = 'allow' | 'block' | 'translation' | 'anchor' | 'other'
export type SystemRule = {
  id: string
  sourceId: string
  name: string
  category: SystemRuleCategory
  direction: 'in' | 'out' | 'both' | 'unknown'
  protocols: string
  ports: string
  remotePorts: string
  source: string
  destination: string
  application: string
  enabled: boolean | null
  raw: string
}
export type SystemRuleSource = {
  id: string
  label: string
  kind: 'config' | 'live' | 'system'
  status: 'ok' | 'permission' | 'error' | 'unsupported'
  message: string
  ruleCount: number
}
export type SystemRuleInventory = {
  platform: string
  readAt: number
  sources: SystemRuleSource[]
  rules: SystemRule[]
}

/** True when the page is running inside the Tauri WebView rather than a browser. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** Same Rust/SQLite backend through IPC in Tauri, loopback HTTP in a browser. */
async function call<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isDesktop()) return invoke<T>(command, args)
  const response = await fetch(`/api/${command}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(command === 'read_system_rules' ? 30000 : 10000),
  })
  const result = await response.json()
  if (!response.ok || !result.ok) throw new Error(result.error ?? `HTTP ${response.status}`)
  return result.data as T
}

/**
 * Load the persisted state from the Rust-side SQLite store. Returns `null` when
 * the store is still empty, so the caller displays an empty configuration.
 */
export async function loadDesktopState(): Promise<PreviewState | null> {
  return call<PreviewState | null>('load_state')
}

/** Persist the whole preview state. Rust re-validates every rule before writing. */
export async function saveDesktopState(state: PreviewState): Promise<void> {
  await call('save_state', { payload: state })
}

export async function resetDesktopState(): Promise<void> {
  await call('reset_state')
}

/** Render the isolated PF anchor body from the shared Rust policy core. */
export async function renderPolicy(state: PreviewState): Promise<string> {
  return call<string>('preview_policy', { payload: state })
}

export async function readAppInfo(): Promise<AppInfo | null> {
  return call<AppInfo>('app_info')
}

/** Automatically choose the reader on the host, including in browser mode. */
export async function readSystemRules(): Promise<SystemRuleInventory> {
  return call<SystemRuleInventory>('read_system_rules')
}

export type LogSnapshot = {
  status: 'connected' | 'missing_interface' | 'permission' | 'error' | 'unsupported'
  message: string
  interface: string | null
  interfaces: string[]
  checkedAt: number
  undecodable: number
  kernelDropped: number | null
  events: {
    id: string; timestampMs: number; source: string; local: string; port: number;
    sourcePort: number; destinationPort: number; protocol: 'tcp' | 'udp'; result: 'allow' | 'block';
    direction: 'in' | 'out'; ruleLabel: string;
  }[]
}

export async function readAccessLogs(): Promise<LogSnapshot> {
  return call<LogSnapshot>('read_access_logs')
}

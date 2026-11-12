import { invoke } from '@tauri-apps/api/core'
import type { PreviewState } from './data'

export type AppInfo = {
  version: string
  platform: string
  arch: string
  database: string
  runtime: string
}

/** True when the page is running inside the Tauri WebView rather than a browser. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Load the persisted state from the Rust-side SQLite store. Returns `null` when
 * the store is still empty, so the caller keeps the demo data and seeds the DB.
 */
export async function loadDesktopState(): Promise<PreviewState | null> {
  if (!isDesktop()) return null
  return invoke<PreviewState | null>('load_state')
}

/** Persist the whole preview state. Rust re-validates every rule before writing. */
export async function saveDesktopState(state: PreviewState): Promise<void> {
  if (!isDesktop()) return
  await invoke('save_state', { payload: state })
}

export async function resetDesktopState(): Promise<void> {
  if (!isDesktop()) return
  await invoke('reset_state')
}

/** Render the isolated PF anchor body from the shared Rust policy core. */
export async function renderPolicy(state: PreviewState): Promise<string> {
  return invoke<string>('preview_policy', { payload: state })
}

export async function readAppInfo(): Promise<AppInfo | null> {
  if (!isDesktop()) return null
  return invoke<AppInfo>('app_info')
}

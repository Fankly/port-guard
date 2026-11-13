/**
 * Platform copy for the shell. The Rust side reports `std::env::consts::OS`
 * ("macos" / "windows" / "linux"); the browser preview has no IPC, so it falls
 * back to the user agent. Engine and log names follow the platform so a Windows
 * build never claims to be running PF.
 */
export type PlatformId = 'windows' | 'macos' | 'other'

export type PlatformCopy = {
  id: PlatformId
  osLabel: string
  osInitial: string
  deviceLabel: string
  engineName: string
  engineDetail: string
  engineStatus: string
  logLabel: string
  logDetail: string
  logStatus: string
  serviceLabel: string
  serviceStatus: string
  rulesDetail: string
  rulesStatus: string
}

const copy: Record<PlatformId, PlatformCopy> = {
  macos: {
    id: 'macos',
    osLabel: 'macOS',
    osInitial: 'M',
    deviceLabel: '这台 Mac',
    engineName: 'PF',
    engineDetail: 'anchor · 未接入',
    engineStatus: '未接入',
    logLabel: 'PF 日志',
    logDetail: 'pflog · 未接入',
    logStatus: '未接入',
    serviceLabel: 'LaunchDaemon',
    serviceStatus: '未安装',
    rulesDetail: '独立 anchor · 未接入',
    rulesStatus: '未挂载',
  },
  windows: {
    id: 'windows',
    osLabel: 'Windows',
    osInitial: 'W',
    deviceLabel: '这台 PC',
    engineName: 'WFP',
    engineDetail: 'sublayer · 未接入',
    engineStatus: '未接入',
    logLabel: 'WFP 事件',
    logDetail: 'Net Events · 未接入',
    logStatus: '未接入',
    serviceLabel: 'Windows 服务',
    serviceStatus: '未安装',
    rulesDetail: 'WFP sublayer · 未接入',
    rulesStatus: '未挂载',
  },
  other: {
    id: 'other',
    osLabel: '本机',
    osInitial: 'P',
    deviceLabel: '这台设备',
    engineName: '系统防火墙',
    engineDetail: '未接入',
    engineStatus: '未接入',
    logLabel: '系统日志',
    logDetail: '未接入',
    logStatus: '未接入',
    serviceLabel: '后台服务',
    serviceStatus: '未安装',
    rulesDetail: '未接入',
    rulesStatus: '未挂载',
  },
}

export function detectPlatform(reported?: string | null): PlatformId {
  const value = (reported ?? '').trim().toLowerCase()
  if (value) {
    if (value.startsWith('win')) return 'windows'
    if (value === 'macos' || value === 'darwin' || value.startsWith('mac')) {
      return 'macos'
    }
    return 'other'
  }
  if (typeof navigator === 'undefined') return 'other'
  const userAgent = navigator.userAgent
  if (/windows/i.test(userAgent)) return 'windows'
  if (/macintosh|mac os x/i.test(userAgent)) return 'macos'
  return 'other'
}

export function platformCopy(platform: PlatformId): PlatformCopy {
  return copy[platform]
}

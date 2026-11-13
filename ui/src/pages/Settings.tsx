import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  AlertTriangle,
  BellRing,
  Cable,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  HardDrive,
  Info,
  Loader2,
  Lock,
  RotateCcw,
  ScrollText,
  Server,
  Settings2,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppInfo } from '../bridge'
import type { Operation, Preferences, Rule } from '../data'
import { downloadFile, formatTime, toCsv } from '../data'
import type { PlatformId } from '../lib/platform'
import { detectPlatform, platformCopy } from '../lib/platform'
import { cn } from '../lib/utils'
import { useReturnFocus } from '../hooks/use-return-focus'
import { ConfirmDialog } from '../components/feedback/confirm-dialog'
import { PageHeader } from '../components/shared/page-header'
import { Segmented } from '../components/shared/segmented'
import { Button } from '../components/ui/button'
import { Card, CardHeader } from '../components/ui/card'
import { Select } from '../components/ui/select'
import { Switch } from '../components/ui/switch'

type Props = {
  preferences: Preferences
  rules: Rule[]
  operations: Operation[]
  desktop: boolean
  appInfo: AppInfo | null
  onSave: (preferences: Preferences) => void
  onReset: () => void
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  storageError: boolean
}

const interfaceCatalog: Record<
  PlatformId,
  { value: string; label: string; hint: string }[]
> = {
  macos: [
    { value: 'en0', label: 'en0 · Wi-Fi', hint: '当前默认网络接口' },
    { value: 'en1', label: 'en1 · 以太网', hint: '有线网络适配器' },
    { value: 'en2', label: 'en2 · 其他', hint: '请在系统中确认接口名称' },
  ],
  windows: [
    { value: '以太网', label: '以太网 · Ethernet', hint: 'Windows 网络连接' },
    { value: 'Wi-Fi', label: 'Wi-Fi · WLAN', hint: '无线网络适配器' },
  ],
  other: [{ value: '默认接口', label: '默认接口', hint: '使用系统默认路由' }],
}

const logInterfaceCatalog: Record<PlatformId, string[]> = {
  macos: ['pflog0', 'pflog1', 'pflog2', 'pflog7'],
  windows: ['WFP Net Events'],
  other: ['系统日志'],
}

export default function Settings({
  preferences,
  rules,
  operations,
  desktop,
  appInfo,
  onSave,
  onReset,
  saveState,
  storageError,
}: Props) {
  const [draft, setDraft] = useState<Preferences>(preferences)
  const [confirmReset, setConfirmReset] = useState(false)
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<number | undefined>(undefined)
  const reduceMotion = useReducedMotion()
  const resetFocus = useReturnFocus()
  const dirty = JSON.stringify(draft) !== JSON.stringify(preferences)
  const saving = desktop && saved && saveState === 'saving'
  const failed = desktop && saved && saveState === 'error'
  const copy = platformCopy(detectPlatform(appInfo?.platform))
  const interfaces = interfaceCatalog[copy.id]
  const logInterfaces = logInterfaceCatalog[copy.id]

  const interfaceOptions = interfaces.some(item => item.value === draft.interface)
    ? interfaces
    : [...interfaces, { value: draft.interface, label: draft.interface, hint: '已保存的接口' }]

  useEffect(() => {
    setDraft(preferences)
  }, [preferences])

  useEffect(
    () => () => window.clearTimeout(savedTimer.current),
    [],
  )

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setDraft(current => ({ ...current, [key]: value }))
    setSaved(false)
  }

  function save() {
    onSave(draft)
    setSaved(true)
    window.clearTimeout(savedTimer.current)
    savedTimer.current = window.setTimeout(() => setSaved(false), 2600)
  }

  function resetDraft() {
    setDraft(preferences)
    setSaved(false)
  }

  function exportConfig() {
    downloadFile(
      `port-guard-config-${formatTime().slice(0, 10)}.json`,
      JSON.stringify(
        { version: 1, exportedAt: formatTime(), preferences, rules },
        null,
        2,
      ),
      'application/json',
    )
  }

  function exportOperations() {
    const rows: (string | number)[][] = [
      ['时间', '操作', '详情', '端口', '结果'],
      ...operations.map(operation => [
        operation.time,
        operation.action,
        operation.detail,
        operation.port ?? '',
        operation.result,
      ]),
    ]
    downloadFile(
      `port-guard-operations-${formatTime().slice(0, 10)}.csv`,
      `\uFEFF${toCsv(rows)}`,
      'text/csv;charset=utf-8',
    )
  }

  return (
    <div className="pb-14">
      <PageHeader
        label="Settings / 设置"
        title="设置"
        description="配置网络接口、日志存储与运行行为。涉及系统权限的变更会由后台服务执行。"
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1.1fr_0.9fr] xl:gap-8">
        <div className="space-y-6">
          <Card>
            <SectionHeader
              icon={<Cable className="size-5" strokeWidth={2.6} />}
              title="网络与日志"
              description={`告诉 Port Guard 应该核对哪个接口、从哪里读取${copy.logLabel}。`}
            />

            <SettingRow
              title="受管网络接口"
              description="用于核对本机 IP 是否属于该接口；不是限制规则只在该接口生效。"
            >
              <Select
                value={draft.interface}
                onChange={event => update('interface', event.target.value)}
                aria-label="受管网络接口"
                className="w-full sm:w-[200px]"
              >
                {interfaceOptions.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </SettingRow>

            <SettingRow
              title={`${copy.logLabel}接口`}
              description="从系统过滤层的事件源读取真实允许/拦截记录，不使用普通网卡抓包冒充。"
            >
              <Select
                value={draft.logInterface}
                onChange={event => update('logInterface', event.target.value)}
                aria-label={`${copy.logLabel}接口`}
                className="w-full sm:w-[200px]"
              >
                {[...new Set([...logInterfaces, draft.logInterface])].map(item => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </SettingRow>

            <SettingRow
              title="日志保留"
              description="超过保留期的访问日志会自动清理。管理操作日志单独保存。"
            >
              <Segmented
                value={draft.retention}
                onChange={value => update('retention', value)}
                ariaLabel="日志保留天数"
                options={[
                  { value: '7', label: '7 天' },
                  { value: '14', label: '14 天' },
                  { value: '30', label: '30 天' },
                ]}
                className="w-full justify-between sm:w-auto"
              />
            </SettingRow>

            <SettingRow
              title="登录后自动启动"
              description="关闭主窗口后，后台服务继续维护规则并采集日志。"
            >
              <Switch
                checked={draft.launchAtLogin}
                onCheckedChange={value => update('launchAtLogin', value)}
                aria-label="登录后自动启动"
              />
            </SettingRow>
          </Card>

          <Card>
            <SectionHeader
              icon={<BellRing className="size-5" strokeWidth={2.6} />}
              title="提醒"
              description="只在需要你处理时提醒，不把每一次拦截都变成打扰。"
            />

            <SettingRow
              title="拦截通知"
              description="当非白名单来源访问受管端口时显示系统通知。"
            >
              <Switch
                checked={draft.notifyBlocked}
                onCheckedChange={value => update('notifyBlocked', value)}
                aria-label="拦截通知"
              />
            </SettingRow>

            <SettingRow
              title="日志中断提醒"
              description="日志采集失败、队列丢失或读取异常时提醒我，避免把空列表当成没有访问。"
            >
              <Switch
                checked={draft.notifyLogGap}
                onCheckedChange={value => update('notifyLogGap', value)}
                aria-label="日志中断提醒"
              />
            </SettingRow>
          </Card>

          <div className="flex gap-3 border-2 border-ink bg-tangerine px-4 py-4 shadow-[4px_4px_0_0_#000]">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" strokeWidth={2.6} />
            <div>
              <strong className="font-mono text-[11px] font-bold uppercase tracking-[0.08em]">
                权限边界
              </strong>
              <p className="mt-1 font-mono text-[12px] leading-[1.7]">
                界面只通过受限接口管理规则，不获得任意高权限命令执行能力。安装、规则挂载与卸载需要单独的系统授权和验收。
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionHeader
              icon={<Server className="size-5" strokeWidth={2.6} />}
              title="运行状态"
              description={
                storageError
                  ? '界面无法读取本机 SQLite，当前显示演示数据；重试成功后会自动恢复。'
                  : desktop
                    ? '界面已通过 Tauri IPC 接入本机 SQLite；系统过滤层状态仍为示例。'
                    : '这里是设计预览中的静态状态，尚未连接真实系统。'
              }
              aside={
                <span className="border border-ink bg-tangerine px-1.5 py-px font-mono text-[12px] font-bold uppercase tracking-[0.08em]">
                  示例
                </span>
              }
            />
            <div>
              <StatusRow
                icon={<Settings2 className="size-3.5" strokeWidth={2.6} />}
                label="后台服务"
                detail={`${copy.serviceLabel} · 已授权`}
                value={copy.serviceStatus}
              />
              <StatusRow
                icon={<ShieldCheck className="size-3.5" strokeWidth={2.6} />}
                label={`${copy.engineName} 引擎`}
                detail={copy.engineDetail}
                value={copy.engineStatus}
              />
              <StatusRow
                icon={<ScrollText className="size-3.5" strokeWidth={2.6} />}
                label="日志采集"
                detail={copy.logDetail}
                value={copy.logStatus}
              />
              <StatusRow
                icon={<Terminal className="size-3.5" strokeWidth={2.6} />}
                label="主规则挂载"
                detail={copy.rulesDetail}
                value={copy.rulesStatus}
              />
              <StatusRow
                icon={<Database className="size-3.5" strokeWidth={2.6} />}
                label="本地存储"
                detail={
                  storageError
                    ? '无法读取本机 SQLite'
                    : appInfo?.database ?? '浏览器设计预览'
                }
                value={
                  storageError ? '异常' : desktop ? 'SQLite' : 'localStorage'
                }
                muted={!desktop || storageError}
                error={storageError}
              />
            </div>
            <div className="flex gap-2 border-t-2 border-ink bg-slab px-4 py-3 font-mono text-[11px] leading-[1.6]">
              <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.6} />
              <span>
                系统版本与规则挂载信息将在接入后台服务后读取，不使用固定演示值。
              </span>
            </div>
          </Card>

          <Card>
            <SectionHeader
              icon={<Database className="size-5" strokeWidth={2.6} />}
              title="数据与维护"
              description={
                desktop
                  ? '导出本机规则与日志；恢复演示数据只影响本应用的 SQLite 存储。'
                  : '导出界面预览中的规则与日志，或恢复初始演示数据。'
              }
            />
            <div>
              <DataAction
                icon={<FileText className="size-4" strokeWidth={2.6} />}
                title="导出配置"
                description="JSON · 规则与偏好设置"
                onClick={exportConfig}
              />
              <DataAction
                icon={<HardDrive className="size-4" strokeWidth={2.6} />}
                title="导出操作日志"
                description={`CSV · 最近 ${operations.length} 条`}
                onClick={exportOperations}
              />
              <DataAction
                icon={<RotateCcw className="size-4" strokeWidth={2.6} />}
                title="恢复演示数据"
                description={
                  desktop
                    ? '清除本机 SQLite 状态，不会影响系统防火墙'
                    : '清除本地预览状态，不会影响系统防火墙'
                }
                danger
                onClick={() => {
                  resetFocus.capture()
                  setConfirmReset(true)
                }}
              />
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3 px-4 py-4">
              <span className="grid size-12 shrink-0 place-items-center border-2 border-ink bg-ink text-acid-lime shadow-[4px_4px_0_0_#000]">
                <ShieldCheck className="size-6" strokeWidth={2.6} />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block font-sans text-[20px] font-black leading-none tracking-[-0.02em]">
                  Port Guard
                </strong>
                <span className="mt-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.1em]">
                  {desktop
                    ? '本机端口白名单 · 桌面预览'
                    : '本机端口白名单 · 设计预览'}
                </span>
              </div>
              <span className="border border-ink bg-slab px-1.5 py-0.5 font-mono text-[11px] font-bold">
                v{appInfo?.version ?? '0.1.0'}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink bg-slab px-4 py-2.5 font-mono text-[11px] font-bold">
              <span>目标平台 macOS 13+ / Windows 10+</span>
              <span>
                {desktop
                  ? `Tauri 2 · ${appInfo?.platform ?? copy.osLabel} ${appInfo?.arch ?? ''}`
                  : 'React + Tauri 方向'}
              </span>
            </div>
            <div className="flex items-start gap-2 border-t-2 border-ink px-4 py-3 font-mono text-[11px] leading-[1.6]">
              <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.6} />
              <p>
                当前页面不会修改 {copy.engineName}、不会安装服务，也不会调用任何管理员命令。
              </p>
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {(dirty || saved || saving) && (
          <motion.div
            initial={reduceMotion ? false : { y: 20 }}
            animate={{ y: 0 }}
            exit={reduceMotion ? undefined : { y: 14 }}
            transition={{ duration: 0.16, ease: [0.22, 0.8, 0.28, 1] }}
            className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 lg:bottom-8 lg:left-[calc(50%+130px)]"
            role="status"
          >
            <div className="border-2 border-ink bg-paper p-3 shadow-[6px_6px_0_0_#000]">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center border-2 border-ink',
                    failed
                      ? 'bg-hot-pink text-ink'
                      : saved
                        ? 'bg-electric-cyan text-ink'
                        : 'bg-tangerine text-ink',
                  )}
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2.6} />
                  ) : failed ? (
                    <AlertTriangle className="size-4" strokeWidth={2.6} />
                  ) : saved ? (
                    <CheckCircle2 className="size-4" strokeWidth={2.6} />
                  ) : (
                    <Info className="size-4" strokeWidth={2.6} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate font-mono text-[11px] font-bold uppercase tracking-[0.04em]">
                    {failed
                      ? '写入本机 SQLite 失败'
                      : saving
                        ? '正在写入本机 SQLite…'
                        : saved
                          ? desktop
                            ? '设置已保存到本机 SQLite'
                            : '设置已保存到本地预览'
                          : '有未保存的修改'}
                  </strong>
                  <p className="truncate font-mono text-[11px] leading-[1.5]">
                    {failed
                      ? '偏好已在界面更新，但未写入本机存储。请重试保存。'
                      : saving
                        ? '偏好已更新，正在写入本机存储。'
                        : saved
                          ? '偏好已经更新；不会修改系统网络配置。'
                          : desktop
                            ? '保存后才会写入本机 SQLite。'
                            : '保存后才会写入本地预览状态。'}
                  </p>
                </div>
                {!saved && (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={resetDraft}>
                      放弃
                    </Button>
                    <Button size="sm" onClick={save}>
                      保存设置
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {confirmReset && (
        <ConfirmDialog
          title="恢复初始演示数据？"
          description={
            desktop
              ? '本机 SQLite 中的规则、操作日志和设置都会被重置。该操作不会修改系统防火墙。'
              : '本机预览中的规则、操作日志和设置都会被重置。该操作只影响浏览器 localStorage，不会修改系统防火墙。'
          }
          confirmLabel="恢复演示数据"
          danger
          onCancel={() => {
            setConfirmReset(false)
            resetFocus.restore()
          }}
          onConfirm={() => {
            setConfirmReset(false)
            setDraft(preferences)
            onReset()
            resetFocus.restore()
          }}
        />
      )}
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  description,
  aside,
}: {
  icon: ReactNode
  title: string
  description: string
  aside?: ReactNode
}) {
  return (
    <CardHeader className="items-start gap-3 border-b-2 border-ink bg-slab px-4 py-4">
      <span className="grid size-10 shrink-0 place-items-center border-2 border-ink bg-paper">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-sans text-[24px] font-black leading-[1.05] tracking-[-0.02em]">
            {title}
          </h2>
          {aside}
        </div>
        <p className="mt-1 font-mono text-[12px] leading-[1.6]">
          {description}
        </p>
      </div>
    </CardHeader>
  )
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 border-t-2 border-ink px-4 py-4 first-of-type:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <strong className="block font-mono text-[11px] font-bold">{title}</strong>
        <p className="mt-1 max-w-[430px] font-mono text-[12px] leading-[1.6]">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center sm:justify-end">{children}</div>
    </div>
  )
}

function StatusRow({
  icon,
  label,
  detail,
  value,
  muted,
  error,
}: {
  icon: ReactNode
  label: string
  detail: string
  value: string
  muted?: boolean
  error?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 border-t-2 border-ink px-4 py-3 first:border-t-0">
      <span className="grid size-7 shrink-0 place-items-center border-2 border-ink bg-paper">
        {icon}
      </span>
      <span className="font-mono text-[12px] font-bold">{label}</span>
      <span className="ml-auto hidden max-w-[160px] truncate font-mono text-[11px] sm:block">
        {detail}
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 border-2 border-ink px-1.5 py-px font-mono text-[11px] font-bold',
          error
            ? 'bg-hot-pink text-ink'
            : muted
              ? 'bg-slab text-ink'
              : 'bg-acid-lime text-ink',
        )}
      >
        <span
          className={cn(
            'size-1.5 border border-current',
            error ? 'bg-paper' : muted ? 'bg-ink' : 'bg-ink',
          )}
        />
        {value}
      </span>
    </div>
  )
}

function DataAction({
  icon,
  title,
  description,
  danger,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 border-t-2 border-ink px-4 py-3.5 text-left transition-colors duration-150 first:border-t-0',
        danger ? 'hover:bg-hot-pink hover:text-ink' : 'hover:bg-acid-lime',
      )}
    >
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center border-2 border-ink bg-paper text-ink',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong
          className={cn(
            'block font-mono text-[11px] font-bold',
            danger && 'text-hot-pink group-hover:text-paper',
          )}
        >
          {title}
        </strong>
        <small className="mt-0.5 block font-mono text-[11px]">
          {description}
        </small>
      </span>
      <ChevronRight className="size-4 shrink-0 transition-transform duration-150 group-hover:translate-x-1" strokeWidth={3} />
    </button>
  )
}

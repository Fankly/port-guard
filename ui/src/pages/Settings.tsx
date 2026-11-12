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
import { cn } from '../lib/utils'
import { useReturnFocus } from '../hooks/use-return-focus'
import { ConfirmDialog } from '../components/feedback/confirm-dialog'
import { PageHeader } from '../components/shared/page-header'
import { Segmented } from '../components/shared/segmented'
import { LiveDot } from '../components/shared/status'
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

const interfaces = [
  { value: 'en0', label: 'en0 · Wi-Fi', hint: '当前默认网络接口' },
  { value: 'en1', label: 'en1 · 以太网', hint: '有线网络适配器' },
  { value: 'en2', label: 'en2 · 其他', hint: '请在系统中确认接口名称' },
]

const logInterfaces = ['pflog0', 'pflog1', 'pflog2', 'pflog7']

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
    <div className="pb-10 lg:pb-14">
      <PageHeader
        title="设置"
        description="配置网络接口、日志存储与运行行为。涉及系统权限的变更会由后台服务执行。"
      />

      <div className="grid items-start gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <Card>
            <SectionHeader
              icon={<Cable className="size-[17px]" />}
              title="网络与日志"
              description="告诉 Port Guard 应该核对哪个接口、从哪里读取 PF 日志。"
            />

            <SettingRow
              title="受管网络接口"
              description="用于核对本机 IP 是否属于该接口；不是限制规则只在该接口生效。"
            >
              <Select
                value={draft.interface}
                onChange={event => update('interface', event.target.value)}
                aria-label="受管网络接口"
                className="w-full sm:w-[180px]"
              >
                {interfaceOptions.map(item => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </SettingRow>

            <SettingRow
              title="PF 日志接口"
              description="从已存在的 pflog 接口读取真实允许/拦截事件，不使用普通网卡抓包冒充。"
            >
              <Select
                value={draft.logInterface}
                onChange={event => update('logInterface', event.target.value)}
                aria-label="PF 日志接口"
                className="w-full sm:w-[180px]"
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
              icon={<BellRing className="size-[17px]" />}
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

          <div className="flex gap-3 rounded-xl border border-border bg-card/60 px-4 py-3.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <strong className="text-[11.5px] font-medium">权限边界</strong>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                界面只通过受限接口管理规则，不获得任意高权限命令执行能力。安装、规则挂载与卸载需要单独的系统授权和验收。
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeader
              icon={<Server className="size-[17px]" />}
              title="运行状态"
              description={
                storageError
                  ? '界面无法读取本机 SQLite，当前显示演示数据；重试成功后会自动恢复。'
                  : desktop
                    ? '界面已通过 Tauri IPC 接入本机 SQLite；系统过滤层状态仍为示例。'
                    : '这里是设计预览中的静态状态，尚未连接真实系统。'
              }
              aside={
                <span className="rounded-full border border-[#f0dfbb] bg-warning-soft px-1.5 py-px text-[9px] font-medium text-warning">
                  示例
                </span>
              }
            />
            <div>
              <StatusRow
                icon={<Settings2 className="size-3.5" />}
                label="后台服务"
                detail="LaunchDaemon · 已授权"
                value="运行中"
              />
              <StatusRow
                icon={<ShieldCheck className="size-3.5" />}
                label="PF 引擎"
                detail="anchor · pf_port_guard"
                value="已启用"
              />
              <StatusRow
                icon={<ScrollText className="size-3.5" />}
                label="日志采集"
                detail="pflog7 · 无丢包"
                value="正常"
              />
              <StatusRow
                icon={<Terminal className="size-3.5" />}
                label="主规则挂载"
                detail="独立 anchor 引用"
                value="已挂载"
              />
              <StatusRow
                icon={<Database className="size-3.5" />}
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
            <div className="flex gap-2 border-t border-border/70 px-5 py-2.5 text-[10px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3 shrink-0" />
              <span>
                系统版本与规则挂载信息将在接入后台服务后读取，不使用固定演示值。
              </span>
            </div>
          </Card>

          <Card>
            <SectionHeader
              icon={<Database className="size-[17px]" />}
              title="数据与维护"
              description={
                desktop
                  ? '导出本机规则与日志；恢复演示数据只影响本应用的 SQLite 存储。'
                  : '导出界面预览中的规则与日志，或恢复初始演示数据。'
              }
            />
            <div>
              <DataAction
                icon={<FileText className="size-4" />}
                title="导出配置"
                description="JSON · 规则与偏好设置"
                onClick={exportConfig}
              />
              <DataAction
                icon={<HardDrive className="size-4" />}
                title="导出操作日志"
                description={`CSV · 最近 ${operations.length} 条`}
                onClick={exportOperations}
              />
              <DataAction
                icon={<RotateCcw className="size-4" />}
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

          <Card className="overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-[#1d926c] to-[#0b5943] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                <ShieldCheck className="size-[19px] text-white" strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block text-[13px] font-semibold">
                  Port Guard
                </strong>
                <span className="block text-[10.5px] text-muted-foreground">
                  {desktop
                    ? '本机端口白名单 · 桌面预览'
                    : '本机端口白名单 · 设计预览'}
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                v{appInfo?.version ?? '0.1.0'}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-muted/25 px-5 py-2.5 text-[10px] text-muted-foreground">
              <span>目标平台 macOS 13+ / Windows 10+</span>
              <span>
                {desktop
                  ? `Tauri 2 · ${appInfo?.platform ?? 'macos'} ${appInfo?.arch ?? ''}`
                  : 'React + Tauri 方向'}
              </span>
            </div>
            <div className="flex items-start gap-2 border-t border-border/70 px-5 py-3 text-[10px] leading-relaxed text-muted-foreground">
              <Lock className="mt-0.5 size-3 shrink-0" />
              <p>
                当前页面不会修改 PF、不会安装服务，也不会调用任何管理员命令。
              </p>
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {(dirty || saved || saving) && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: [0.22, 0.8, 0.28, 1] }}
            className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[540px] -translate-x-1/2 lg:bottom-6 lg:left-[calc(50%+120px)]"
            role="status"
          >
            <div
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-card/95 p-3 shadow-lift backdrop-blur',
                saved && !failed ? 'border-[#cfe6da]' : 'border-border',
              )}
            >
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-lg',
                  failed
                    ? 'bg-destructive-soft text-destructive'
                    : saved
                      ? 'bg-[#eff8f2] text-[#0e6a4e]'
                      : 'bg-warning-soft text-warning',
                )}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : failed ? (
                  <AlertTriangle className="size-4" />
                ) : saved ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Info className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-[11.5px] font-medium">
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
                <p className="truncate text-[10px] text-muted-foreground">
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
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={resetDraft}>
                    放弃
                  </Button>
                  <Button size="sm" onClick={save}>
                    保存设置
                  </Button>
                </div>
              )}
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
    <CardHeader className="items-center gap-3 px-5 py-4">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-[13.5px] font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {aside}
        </div>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
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
    <div className="flex flex-col gap-2.5 border-t border-border/60 px-5 py-3.5 first-of-type:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <strong className="block text-[11.5px] font-medium">{title}</strong>
        <p className="mt-0.5 max-w-[430px] text-[10px] leading-relaxed text-muted-foreground">
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
    <div className="flex items-center gap-2.5 border-t border-border/60 px-5 py-2.5 first:border-t-0">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted/70 text-muted-foreground">
        {icon}
      </span>
      <span className="text-[11px] font-medium">{label}</span>
      <span className="ml-auto hidden max-w-[150px] truncate text-[9.5px] text-muted-foreground sm:block">
        {detail}
      </span>
      <span
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 text-[10px]',
          error
            ? 'text-destructive'
            : muted
              ? 'text-muted-foreground'
              : 'text-[#0e6a4e]',
        )}
      >
        {error ? (
          <span className="size-1.5 rounded-full bg-destructive" />
        ) : muted ? (
          <span className="size-1.5 rounded-full bg-muted-foreground/50" />
        ) : (
          <LiveDot className="scale-[0.8]" />
        )}
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
        'group flex w-full items-center gap-3 border-t border-border/60 px-5 py-3 text-left transition-colors first:border-t-0',
        danger ? 'hover:bg-destructive-soft/40' : 'hover:bg-muted/35',
      )}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-lg',
          danger
            ? 'bg-destructive-soft/70 text-destructive'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong
          className={cn(
            'block text-[11.5px] font-medium',
            danger && 'text-destructive',
          )}
        >
          {title}
        </strong>
        <small className="mt-0.5 block text-[10px] text-muted-foreground">
          {description}
        </small>
      </span>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { emptyState } from './data'
import { useQueryClient } from '@tanstack/react-query'
import type { Preferences, Rule } from './data'
import { saveDesktopState, resetDesktopState } from './bridge'
import { useBootstrap } from './hooks/use-bootstrap'
import { useReturnFocus } from './hooks/use-return-focus'
import { useRoute } from './hooks/use-route'
import { useSystemRules } from './hooks/use-system-rules'
import { useAccessLogs } from './hooks/use-access-logs'
import { detectPlatform } from './lib/platform'
import { useAppStore, stateAfterDeletingRule } from './store/app-store'
import { Sidebar } from './components/layout/sidebar'
import { MobileNav } from './components/layout/mobile-nav'
import { MobileHeader } from './components/layout/mobile-header'
import { MarqueeBar } from './components/layout/marquee-bar'
import { AppSkeleton } from './components/layout/app-skeleton'
import { RuleSheet } from './components/rules/rule-sheet'
import { ConfirmDialog } from './components/feedback/confirm-dialog'
import { Button } from './components/ui/button'
import { TooltipProvider } from './components/ui/tooltip'
import Overview from './pages/Overview'
import Rules from './pages/Rules'
import AccessLog from './pages/AccessLog'
import Operations from './pages/Operations'
import Settings from './pages/Settings'

type SheetState = { mode: 'create' | 'edit'; rule: Rule | null }

export default function App() {
  const { page, navigate } = useRoute()
  const { desktop, status, info, retry, retrying } = useBootstrap()
  const systemRules = useSystemRules(status === 'ready')
  const logs = useAccessLogs(status === 'ready')
  const queryClient = useQueryClient()
  const systemReadStatus = status !== 'ready' ? '等待后端' : systemRules.isPending ? '读取中' : systemRules.isError ? '读取失败' : systemRules.data?.sources.some(source => source.status !== 'ok') ? '部分读取' : '已读取'
  const platform = detectPlatform(info?.platform)
  const reduceMotion = useReducedMotion()
  const dialogFocus = useReturnFocus()

  const rules = useAppStore(state => state.rules)
  const operations = useAppStore(state => state.operations)
  const preferences = useAppStore(state => state.preferences)
  const toggleRule = useAppStore(state => state.toggleRule)
  const saveRule = useAppStore(state => state.saveRule)
  const savePreferences = useAppStore(state => state.savePreferences)
  const hydrate = useAppStore(state => state.hydrate)

  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null)
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const persisted = useRef<string | null>(null)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const [deletePending, setDeletePending] = useState(false)

  // Persist only after a successful bootstrap, so a failed SQLite read never
  // overwrites the real store with demo data.
  useEffect(() => {
    if (status !== 'ready' || deletePending) return
    const snapshot = { rules, operations, preferences }
    const serialized = JSON.stringify(snapshot)
    if (persisted.current === null) {
      persisted.current = serialized
      setSaveState('saved')
      return
    }
    if (persisted.current === serialized) return
    setSaveState('saving')
    let cancelled = false
    const timer = window.setTimeout(() => {
      const request = saveQueue.current.catch(() => undefined).then(() => saveDesktopState(snapshot))
      saveQueue.current = request
      request
        .then(() => {
          if (cancelled) return
          persisted.current = serialized
          setSaveState('saved')
          void queryClient.invalidateQueries({ queryKey: ['access-logs'] })
        })
        .catch(error => {
          if (cancelled) return
          setSaveState('error')
          toast.error(`保存到本机 SQLite 失败：${String(error)}`)
        })
    }, 350)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [status, desktop, rules, operations, preferences, deletePending, queryClient])

  const activeCount = rules.filter(rule => rule.enabled).length
  const blockedEvents = logs.events.filter(
    event => event.result === 'block',
  ).length

  function handleToggle(rule: Rule) {
    const willEnable = !rule.enabled
    toggleRule(rule)
    toast.success(
      willEnable ? `「${rule.name}」已启用` : `「${rule.name}」已停用`,
    )
  }

  function handleSaveRule(rule: Rule, mode: 'create' | 'edit') {
    saveRule(rule, mode)
    setSheet(null)
    dialogFocus.restore()
    toast.success(
      mode === 'create'
        ? `规则「${rule.name}」已创建`
        : `规则「${rule.name}」已保存`,
    )
  }

  async function handleDelete(rule: Rule) {
    if (deletePending) return
    const next = stateAfterDeletingRule(useAppStore.getState(), rule)
    setDeletePending(true)
    try {
      const request = saveQueue.current.catch(() => undefined).then(() => saveDesktopState(next))
      saveQueue.current = request
      await request
      persisted.current = JSON.stringify(next)
      hydrate(next)
      setSaveState('saved')
      setDeleteTarget(null)
      dialogFocus.restore()
      toast.success(`规则「${rule.name}」已从本机数据库删除`)
    } catch (error) {
      toast.error(`删除失败，规则已保留：${String(error)}`)
    } finally {
      setDeletePending(false)
    }
  }

  function handleSavePreferences(next: Preferences) {
    savePreferences(next)
  }

  async function handleReset() {
    if (deletePending) return
    const next = emptyState(info?.platform)
    setDeletePending(true)
    try {
      const request = saveQueue.current.catch(() => undefined).then(() => resetDesktopState())
      saveQueue.current = request
      await request
      persisted.current = JSON.stringify(next)
      hydrate(next)
      setSaveState('saved')
      void queryClient.invalidateQueries({ queryKey: ['access-logs'] })
      toast.success('已清空应用配置、操作记录和已存储日志')
    } catch (error) {
      toast.error(`清空失败，数据已保留：${String(error)}`)
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <TooltipProvider delayDuration={260}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:border-2 focus:border-ink focus:bg-acid-lime focus:px-4 focus:py-2 focus:font-mono focus:text-[12px] focus:font-bold focus:shadow-[4px_4px_0_0_#000]"
      >
        跳到主要内容
      </a>

      <div className="min-h-dvh bg-background">
        <Sidebar
          page={page}
          activeCount={activeCount}
          blockedCount={blockedEvents}
          desktop={desktop}
          storageError={status === 'error'}
          platform={platform}
          systemReadStatus={systemReadStatus}
          systemRuleCount={systemRules.data?.rules.length ?? 0}
          onNavigate={navigate}
        />

        <div className="lg:pl-[260px]">
          <MobileHeader
            desktop={desktop}
            activeCount={activeCount}
            storageError={status === 'error'}
          />

          <MarqueeBar platform={platform} />

          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 outline-none sm:px-6 lg:px-8 lg:pb-16 lg:pt-8"
          >
            {desktop && status === 'error' && (
              <div
                role="alert"
                className="mb-6 flex flex-col gap-3 border-2 border-ink bg-tangerine p-4 shadow-[4px_4px_0_0_#000] sm:flex-row sm:items-center"
              >
                <AlertTriangle className="size-5 shrink-0" strokeWidth={2.6} />
                <div className="min-w-0 flex-1">
                  <strong className="block font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
                    无法读取本机 SQLite
                  </strong>
                  <p className="mt-1 font-mono text-[11px] leading-[1.6]">
                    后端连接失败，当前没有加载数据。请在项目根目录运行 npm run ui:dev，浏览器与本机后端会一起启动，然后重试。
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void retry()}
                  disabled={retrying}
                >
                  <RotateCw
                    className={retrying ? 'size-3.5 animate-spin' : 'size-3.5'}
                  />
                  重试
                </Button>
              </div>
            )}

            {status === 'loading' ? (
              <AppSkeleton />
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  inert={status === 'error'}
                  key={page}
                  initial={reduceMotion ? false : { x: 18 }}
                  animate={{ x: 0 }}
                  exit={reduceMotion ? undefined : { x: -10 }}
                  transition={{ duration: 0.16, ease: [0.22, 0.8, 0.28, 1] }}
                >
                  {page === 'overview' && (
                    <Overview
                      platform={platform}
                      onNavigate={navigate}
                      onNewRule={() => {
                        dialogFocus.capture()
                        setSheet({ mode: 'create', rule: null })
                      }}
                      onToggle={handleToggle}
                    />
                  )}
                  {page === 'rules' && (
                    <Rules
                      onNew={() => {
                        dialogFocus.capture()
                        setSheet({ mode: 'create', rule: null })
                      }}
                      onEdit={rule => {
                        dialogFocus.capture()
                        setSheet({ mode: 'edit', rule })
                      }}
                      onDelete={rule => {
                        dialogFocus.capture()
                        setDeleteTarget(rule)
                      }}
                      onToggle={handleToggle}
                    />
                  )}
                  {page === 'access' && <AccessLog platform={platform} />}
                  {page === 'operations' && <Operations />}
                  {page === 'settings' && (
                    <Settings
                      preferences={preferences}
                      rules={rules}
                      operations={operations}
                      desktop={desktop}
                      appInfo={info}
                      onSave={handleSavePreferences}
                      saveState={saveState}
                      storageError={status === 'error'}
                      onReset={handleReset}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </main>
        </div>

        <MobileNav page={page} onNavigate={navigate} />

        {sheet && (
          <RuleSheet
            mode={sheet.mode}
            rule={sheet.rule}
            rules={rules}
            onClose={() => {
              setSheet(null)
              dialogFocus.restore()
            }}
            onSave={handleSaveRule}
          />
        )}

        {deleteTarget && (
          <ConfirmDialog
            title={`删除「${deleteTarget.name}」？`}
            description={`删除端口 ${deleteTarget.port} 的应用白名单配置。当前配置尚未应用到系统防火墙，电脑原有规则会保留。`}
            confirmLabel="删除规则"
            danger
            busy={deletePending}
            onCancel={() => {
              setDeleteTarget(null)
              dialogFocus.restore()
            }}
            onConfirm={() => handleDelete(deleteTarget)}
          />
        )}

        <Toaster
          position="bottom-right"
          offset={24}
          mobileOffset={{ bottom: 96, left: 16, right: 16 }}
          toastOptions={{ duration: 2800 }}
          theme="light"
        />
      </div>
    </TooltipProvider>
  )
}


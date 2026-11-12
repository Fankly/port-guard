import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Toaster, toast } from 'sonner'
import { demoAccess, savePreview } from './data'
import type { Preferences, Rule } from './data'
import { saveDesktopState, resetDesktopState } from './bridge'
import { useBootstrap } from './hooks/use-bootstrap'
import { useReturnFocus } from './hooks/use-return-focus'
import { useRoute } from './hooks/use-route'
import { useAppStore } from './store/app-store'
import { Sidebar } from './components/layout/sidebar'
import { MobileNav } from './components/layout/mobile-nav'
import { MobileHeader } from './components/layout/mobile-header'
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
  const reduceMotion = useReducedMotion()
  const dialogFocus = useReturnFocus()

  const rules = useAppStore(state => state.rules)
  const operations = useAppStore(state => state.operations)
  const preferences = useAppStore(state => state.preferences)
  const toggleRule = useAppStore(state => state.toggleRule)
  const saveRule = useAppStore(state => state.saveRule)
  const deleteRule = useAppStore(state => state.deleteRule)
  const savePreferences = useAppStore(state => state.savePreferences)
  const reset = useAppStore(state => state.reset)

  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null)
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')

  // Persist only after a successful bootstrap, so a failed SQLite read never
  // overwrites the real store with demo data.
  useEffect(() => {
    if (status !== 'ready') return
    const snapshot = { rules, operations, preferences }
    if (!desktop) {
      savePreview(snapshot)
      setSaveState('saved')
      return
    }
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      saveDesktopState(snapshot)
        .then(() => setSaveState('saved'))
        .catch(error => {
          setSaveState('error')
          toast.error(`保存到本机 SQLite 失败：${String(error)}`)
        })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [status, desktop, rules, operations, preferences])

  const activeCount = rules.filter(rule => rule.enabled).length
  const blockedEvents = demoAccess.filter(
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

  function handleDelete(rule: Rule) {
    deleteRule(rule)
    setDeleteTarget(null)
    dialogFocus.restore()
    toast.success(`规则「${rule.name}」已删除`)
  }

  function handleSavePreferences(next: Preferences) {
    savePreferences(next)
  }

  function handleReset() {
    reset()
    if (desktop) {
      resetDesktopState().catch(error => {
        toast.error(`重置本机存储失败：${String(error)}`)
      })
    }
    toast.success('已恢复初始演示数据')
  }

  return (
    <TooltipProvider delayDuration={260}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-[12px] focus:shadow-lift"
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
          onNavigate={navigate}
        />

        <div className="lg:pl-[240px]">
          <MobileHeader
            desktop={desktop}
            activeCount={activeCount}
            storageError={status === 'error'}
          />

          <main
            id="main"
            tabIndex={-1}
            className="mx-auto outline-none w-full max-w-[1180px] px-4 pb-28 pt-5 sm:px-6 lg:px-9 lg:pb-14 lg:pt-8"
          >
            {desktop && status === 'error' && (
              <div
                role="alert"
                className="mb-4 flex flex-col gap-2.5 rounded-xl border border-[#f0dfbb] bg-warning-soft/70 p-3.5 sm:flex-row sm:items-center"
              >
                <AlertTriangle className="size-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <strong className="block text-[11.5px] font-medium">
                    无法读取本机 SQLite
                  </strong>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                    当前显示本地演示数据，修改不会写入本机存储。重试成功后会自动恢复。
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
                  key={page}
                  initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    reduceMotion
                      ? undefined
                      : { opacity: 0, y: -4 }
                  }
                  transition={{ duration: 0.18, ease: [0.22, 0.8, 0.28, 1] }}
                >
                  {page === 'overview' && (
                    <Overview
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
                  {page === 'access' && <AccessLog />}
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
            description={`删除后端口 ${deleteTarget.port} 将恢复系统原有策略。这个操作只影响当前规则，不会影响其他端口。`}
            confirmLabel="删除规则"
            danger
            onCancel={() => {
              setDeleteTarget(null)
              dialogFocus.restore()
            }}
            onConfirm={() => handleDelete(deleteTarget)}
          />
        )}

        <Toaster
          position="bottom-right"
          offset={20}
          mobileOffset={{ bottom: 82, left: 16, right: 16 }}
          toastOptions={{ duration: 2800 }}
          theme="light"
        />
      </div>
    </TooltipProvider>
  )
}


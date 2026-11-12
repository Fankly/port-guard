import { create } from 'zustand'
import type { Operation, Preferences, PreviewState, Rule } from '../data'
import {
  createId,
  formatTime,
  initialState,
  protocolLabel,
  readPreview,
  resetPreview,
} from '../data'

type AppState = PreviewState & {
  hydrate: (state: PreviewState) => void
  toggleRule: (rule: Rule) => void
  saveRule: (rule: Rule, mode: 'create' | 'edit') => void
  deleteRule: (rule: Rule) => void
  savePreferences: (preferences: Preferences) => void
  reset: () => void
}

function operation(
  action: string,
  detail: string,
  port?: number,
): Operation {
  return {
    id: createId('op'),
    time: formatTime(),
    action,
    detail,
    port,
    result: '成功',
  }
}

function withOperation(
  operations: Operation[],
  action: string,
  detail: string,
  port?: number,
): Operation[] {
  return [operation(action, detail, port), ...operations].slice(0, 100)
}

const initial = typeof window === 'undefined' ? initialState : readPreview()

export const useAppStore = create<AppState>(set => ({
  ...initial,

  hydrate: state =>
    set({
      rules: state.rules,
      operations: state.operations,
      preferences: state.preferences,
    }),

  toggleRule: rule =>
    set(state => {
      const enabled = !rule.enabled
      return {
        rules: state.rules.map(item =>
          item.id === rule.id
            ? { ...item, enabled, updatedAt: formatTime().slice(0, 16) }
            : item,
        ),
        operations: withOperation(
          state.operations,
          enabled ? '启用端口规则' : '停用端口规则',
          enabled
            ? `${rule.name} · ${protocolLabel(rule.protocols)} · ${rule.sources.length} 个来源`
            : `${rule.name} · 恢复系统原有策略`,
          rule.port,
        ),
      }
    }),

  saveRule: (rule, mode) =>
    set(state => ({
      rules:
        mode === 'create'
          ? [rule, ...state.rules]
          : state.rules.map(item => (item.id === rule.id ? rule : item)),
      operations: withOperation(
        state.operations,
        mode === 'create' ? '创建端口规则' : '更新白名单',
        `${rule.name} · ${protocolLabel(rule.protocols)} · ${rule.sources.length} 个来源`,
        rule.port,
      ),
    })),

  deleteRule: rule =>
    set(state => ({
      rules: state.rules.filter(item => item.id !== rule.id),
      operations: withOperation(
        state.operations,
        '删除端口规则',
        `${rule.name} · 已撤除对端口 ${rule.port} 的管理`,
        rule.port,
      ),
    })),

  savePreferences: preferences =>
    set(state => ({
      preferences,
      operations: withOperation(
        state.operations,
        '更新设置',
        `网络接口 ${preferences.interface} · 日志接口 ${preferences.logInterface} · 保留 ${preferences.retention} 天`,
      ),
    })),

  reset: () => {
    const next = resetPreview()
    set({
      rules: next.rules,
      operations: next.operations,
      preferences: next.preferences,
    })
  },
}))

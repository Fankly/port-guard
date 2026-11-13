import {
  AlertTriangle,
  Check,
  Globe2,
  Monitor,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Protocol, Rule, Source } from '../../data'
import {
  createId,
  formatTime,
  normalizeAddress,
  protocolLabel,
} from '../../data'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '../ui/sheet'
import { Switch } from '../ui/switch'

type Props = {
  mode: 'create' | 'edit'
  rule: Rule | null
  rules: Rule[]
  onClose: () => void
  onSave: (rule: Rule, mode: 'create' | 'edit') => void
}

const presets = [
  { address: '192.168.1.0/24', label: '办公室网段' },
  { address: '192.168.1.10', label: '办公电脑' },
  { address: '10.0.0.0/8', label: '内网大段' },
  { address: '2001:db8::/64', label: 'IPv6 网段' },
]

function isCidr(address: string): boolean {
  return address.includes('/')
}

export function RuleSheet({ mode, rule, rules, onClose, onSave }: Props) {
  const [name, setName] = useState(rule?.name ?? '')
  const [port, setPort] = useState(rule ? String(rule.port) : '')
  const [protocols, setProtocols] = useState<Protocol[]>(
    rule?.protocols ?? ['tcp'],
  )
  const [sources, setSources] = useState<Source[]>(
    rule?.sources.map(source => ({ ...source })) ?? [],
  )
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [sourceError, setSourceError] = useState('')
  const [formError, setFormError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const addressRef = useRef<HTMLInputElement>(null)

  const portNumber = Number(port)
  const portValid =
    Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65535
  const overlapping = portValid
    ? rules.find(
        other =>
          other.id !== rule?.id &&
          other.port === portNumber &&
          other.protocols.some(protocol => protocols.includes(protocol)),
      )
    : undefined
  const removedSources = rule
    ? rule.sources.filter(
        item => !sources.some(source => source.address === item.address),
      )
    : []
  const canSave =
    name.trim().length > 0 &&
    portValid &&
    protocols.length > 0 &&
    !overlapping

  function toggleProtocol(protocol: Protocol) {
    setProtocols(current => {
      if (current.includes(protocol)) {
        return current.length === 1
          ? current
          : current.filter(item => item !== protocol)
      }
      return [...current, protocol]
    })
    setFormError('')
  }

  function addSource(event?: FormEvent) {
    event?.preventDefault()
    if (!address.trim()) {
      setSourceError('先填写 IP 地址或 CIDR 网段。')
      addressRef.current?.focus()
      return
    }
    try {
      const normalized = normalizeAddress(address)
      if (sources.some(source => source.address === normalized)) {
        setSourceError('这个地址已经在白名单里了。')
        return
      }
      setSources(current => [
        ...current,
        {
          address: normalized,
          label:
            label.trim() ||
            (isCidr(normalized) ? '自定义网段' : `来源 ${current.length + 1}`),
        },
      ])
      setAddress('')
      setLabel('')
      setSourceError('')
      addressRef.current?.focus()
    } catch (error) {
      setSourceError(
        error instanceof Error ? error.message : '地址格式不正确。',
      )
    }
  }

  function submit() {
    if (!canSave) {
      setFormError(
        !name.trim()
          ? '请填写规则名称。'
          : !portValid
            ? '端口应为 1–65535 之间的整数。'
            : overlapping
              ? `端口 ${portNumber} 已被「${overlapping.name}」占用。`
              : '请至少选择一种协议。',
      )
      return
    }
    const saved: Rule = {
      id: rule?.id ?? createId('rule'),
      name: name.trim(),
      port: portNumber,
      protocols,
      sources: sources.map(source => ({ ...source })),
      enabled,
      updatedAt: formatTime().slice(0, 16),
    }
    onSave(saved, mode)
  }

  return (
    <Sheet open onOpenChange={open => !open && onClose()}>
      <SheetContent
        onOpenAutoFocus={event => {
          event.preventDefault()
          nameRef.current?.focus()
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b-4 border-ink px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 border-2 border-ink bg-hot-pink px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
              <span className="size-1.5 bg-paper" aria-hidden="true" />
              {mode === 'create' ? 'New port rule' : `Port ${rule?.port}`}
            </span>
            <SheetTitle className="mt-3 font-sans text-[32px] font-black leading-[0.95] tracking-[-0.02em]">
              {mode === 'create' ? '新建端口规则' : '编辑端口规则'}
            </SheetTitle>
            <SheetDescription className="mt-2 font-mono text-[12px] leading-[1.6]">
              只允许名单内的来源访问这个本机端口。
            </SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="关闭"
            className="-mr-1 -mt-1 shrink-0"
          >
            <X className="size-5" strokeWidth={3} />
          </Button>
        </header>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={event => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="space-y-2">
              <FieldLabel htmlFor="rule-name">01 / 规则名称</FieldLabel>
              <Input
                id="rule-name"
                ref={nameRef}
                value={name}
                onChange={event => {
                  setName(event.target.value)
                  setFormError('')
                }}
                placeholder="例如：办公 Web 服务"
                maxLength={40}
              />
              <p className="font-mono text-[12px] leading-[1.5]">
                用一句方便识别的话命名，例如服务名或项目名。
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="rule-port">02 / 本机端口</FieldLabel>
                <div
                  className={cn(
                    'flex h-11 items-center border-2 bg-paper pl-3 transition-[background-color,box-shadow] duration-150',
                    port && !portValid
                      ? 'border-hot-pink shadow-[4px_4px_0_0_#ff006e]'
                      : 'border-ink focus-within:shadow-[4px_4px_0_0_#000]',
                  )}
                >
                  <span className="font-mono text-[14px] font-bold">:</span>
                  <input
                    id="rule-port"
                    value={port}
                    onChange={event => {
                      setPort(
                        event.target.value.replace(/\D/g, '').slice(0, 5),
                      )
                      setFormError('')
                    }}
                    inputMode="numeric"
                    placeholder="8080"
                    aria-invalid={Boolean(port && !portValid)}
                    className="h-full w-full bg-transparent px-1.5 font-mono text-[16px] font-bold tracking-[0.04em] outline-none placeholder:text-[13px] placeholder:text-ink"
                  />
                </div>
                <p className="font-mono text-[12px] leading-[1.5]">
                  1–65535，按端口号生效。
                </p>
              </div>

              <div className="space-y-2">
                <span className="block font-mono text-[12px] font-bold uppercase tracking-[0.14em]">
                  03 / 协议
                </span>
                <div className="flex gap-2" role="group" aria-label="协议">
                  {(['tcp', 'udp'] as const).map(protocol => {
                    const active = protocols.includes(protocol)
                    return (
                      <button
                        key={protocol}
                        type="button"
                        onClick={() => toggleProtocol(protocol)}
                        aria-pressed={active}
                        className={cn(
                          'flex h-11 flex-1 items-center gap-2 border-2 border-ink px-3 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-all duration-150',
                          active
                            ? 'bg-acid-lime text-ink shadow-[3px_3px_0_0_#000]'
                            : 'bg-paper text-ink hover:bg-slab',
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-4 place-items-center border-2 border-ink transition-colors',
                            active ? 'bg-ink text-acid-lime' : 'bg-paper',
                          )}
                        >
                          {active && (
                            <Check className="size-2.5" strokeWidth={3.5} />
                          )}
                        </span>
                        {protocol.toUpperCase()}
                      </button>
                    )
                  })}
                </div>
                <p className="font-mono text-[12px] leading-[1.5]">
                  可同时管理 TCP 和 UDP，至少保留一种。
                </p>
              </div>
            </div>

            {overlapping && (
              <div
                className="flex gap-3 border-2 border-ink bg-hot-pink p-3.5 text-ink shadow-[4px_4px_0_0_#000]"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2.6} />
                <span className="font-mono text-[11px] leading-[1.6]">
                  端口 {portNumber} 的 {protocolLabel(protocols)} 已被「
                  {overlapping.name}」管理，同一端口/协议不能重复配置。
                </span>
              </div>
            )}

            {rule?.enabled && removedSources.length > 0 && (
              <div className="flex gap-3 border-2 border-ink bg-tangerine p-3.5 text-ink shadow-[4px_4px_0_0_#000]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2.6} />
                <span className="font-mono text-[11px] leading-[1.6]">
                  保存后，{removedSources.length} 个来源将失去对端口 {rule.port}{' '}
                  的访问权限；已建立的连接也会在规则生效时被撤销。
                </span>
              </div>
            )}

            <section className="border-2 border-ink">
              <div className="flex items-start justify-between gap-3 border-b-2 border-ink bg-slab px-3.5 py-3">
                <div>
                  <span className="font-sans text-[15px] font-black">
                    允许访问的来源
                  </span>
                  <span className="ml-2 border border-ink bg-paper px-1.5 py-px font-mono text-[11px] font-bold">
                    {sources.length} 个地址
                  </span>
                </div>
                <span className="text-right font-mono text-[11px] leading-[1.5]">
                  多个条目取并集
                </span>
              </div>

              <div className="space-y-2 p-3.5">
                {sources.map(source => (
                  <div
                    key={source.address}
                    className="flex items-center gap-3 border-2 border-ink bg-paper px-2.5 py-2 transition-colors duration-150 hover:bg-slab"
                  >
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center border-2 border-ink',
                        isCidr(source.address)
                          ? 'bg-electric-cyan text-ink'
                          : 'bg-acid-lime text-ink',
                      )}
                    >
                      {isCidr(source.address) ? (
                        <Globe2 className="size-4" strokeWidth={2.4} />
                      ) : (
                        <Monitor className="size-4" strokeWidth={2.4} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate font-mono text-[11px] font-bold">
                        {source.label}
                      </strong>
                      <code className="block truncate font-mono text-[12px]">
                        {source.address}
                      </code>
                    </div>
                    <span className="hidden border border-ink bg-paper px-1 py-px font-mono text-[12px] font-bold uppercase tracking-[0.08em] sm:inline">
                      {isCidr(source.address) ? 'CIDR' : '单个 IP'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="border-ink text-ink hover:bg-hot-pink hover:text-ink"
                      aria-label={`移除 ${source.address}`}
                      onClick={() =>
                        setSources(current =>
                          current.filter(
                            item => item.address !== source.address,
                          ),
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}

                {sources.length === 0 && (
                  <div className="flex items-center gap-2 border-2 border-dashed border-ink bg-paper px-3 py-3 font-mono text-[12px] leading-[1.6]">
                    <ShieldCheck className="size-4 shrink-0" strokeWidth={2.4} />
                    还没有来源地址。保存后，这个端口将拒绝所有外部访问。
                  </div>
                )}
              </div>

              <div className="border-t-2 border-ink p-3.5">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_132px_auto]">
                  <Input
                    ref={addressRef}
                    value={address}
                    onChange={event => {
                      setAddress(event.target.value)
                      setSourceError('')
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addSource()
                      }
                    }}
                    placeholder="IP 或 CIDR，例如 192.168.1.10"
                    aria-label="要添加的 IP 地址或 CIDR"
                    aria-invalid={Boolean(sourceError)}
                    className="h-10 text-[12px]"
                  />
                  <Input
                    value={label}
                    onChange={event => setLabel(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addSource()
                      }
                    }}
                    placeholder="备注（可选）"
                    aria-label="来源备注"
                    maxLength={24}
                    className="h-10 text-[12px]"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-10"
                    onClick={() => addSource()}
                  >
                    <Plus className="size-3.5" strokeWidth={3} />
                    添加
                  </Button>
                </div>
                {sourceError && (
                  <p
                    className="mt-2 border-2 border-ink bg-hot-pink px-2 py-1 font-mono text-[12px] font-bold text-ink"
                    role="alert"
                  >
                    {sourceError}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
                    快速填入
                  </span>
                  {presets.map(preset => (
                    <button
                      key={preset.address}
                      type="button"
                      className="border-2 border-ink bg-paper px-2 py-1 font-mono text-[11px] font-bold transition-colors duration-150 hover:bg-acid-lime"
                      onClick={() => {
                        setAddress(preset.address)
                        setLabel(preset.label)
                        setSourceError('')
                        addressRef.current?.focus()
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between gap-4 border-2 border-ink bg-slab px-3.5 py-3">
              <div>
                <strong className="block font-mono text-[11px] font-bold">
                  启用这条规则
                </strong>
                <p className="mt-1 font-mono text-[12px] leading-[1.5]">
                  停用后恢复系统对该端口的原有策略，规则配置会保留。
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                aria-label="启用这条规则"
              />
            </div>

            {formError && (
              <div
                className="flex gap-3 border-2 border-ink bg-hot-pink p-3.5 text-ink shadow-[4px_4px_0_0_#000]"
                role="alert"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2.6} />
                <span className="font-mono text-[11px] leading-[1.6]">
                  {formError}
                </span>
              </div>
            )}

            <div className="flex items-start gap-2 border-t-2 border-ink pt-4 font-mono text-[12px] leading-[1.6]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
              <span>
                保存后仅更新界面预览。真正写入系统防火墙将在接入后台服务时实现。
              </span>
            </div>
          </div>

          <footer className="flex items-center justify-between gap-3 border-t-4 border-ink bg-paper px-5 py-4 sm:px-6">
            <span className="hidden font-mono text-[11px] font-bold uppercase tracking-[0.1em] sm:block">
              保存只影响本软件规则
            </span>
            <div className="flex w-full gap-3 sm:w-auto">
              <Button
                variant="secondary"
                className="flex-1 sm:flex-none"
                onClick={onClose}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={!canSave}
                className="flex-1 sm:flex-none"
              >
                <Check className="size-4" strokeWidth={3} />
                {mode === 'create' ? '创建规则' : '保存修改'}
              </Button>
            </div>
          </footer>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block font-mono text-[12px] font-bold uppercase tracking-[0.14em]"
    >
      {children}
    </label>
  )
}

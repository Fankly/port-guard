import type { PlatformId } from '../../lib/platform'
import { platformCopy } from '../../lib/platform'

function items(engineName: string) {
  return [
    '本机端口白名单',
    'LOCAL ONLY',
    `${engineName} ENGINE / SAMPLE`,
    '白名单之外 · 一律拒绝',
    '设计预览',
    'PORT GUARD',
    '按端口管理访问',
    'NO CLOUD · NO NOISE',
  ]
}

function Strip({ labels }: { labels: string[] }) {
  return (
    <div className="flex shrink-0 items-center">
      {labels.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="flex items-center gap-4 whitespace-nowrap px-4 font-mono text-[11px] font-bold uppercase tracking-[0.12em]"
        >
          {item}
          <span className="size-1 shrink-0 bg-acid-lime" aria-hidden="true" />
        </span>
      ))}
    </div>
  )
}

export function MarqueeBar({ platform }: { platform: PlatformId }) {
  const labels = items(platformCopy(platform).engineName)
  return (
    <div className="marquee-bar overflow-hidden border-b-2 border-ink bg-ink text-paper">
      <div className="marquee-track flex w-max py-2">
        <Strip labels={labels} />
        <div aria-hidden="true" className="flex shrink-0">
          <Strip labels={labels} />
        </div>
      </div>
      <span className="sr-only">
        Port Guard：本机端口白名单，当前为界面设计预览。
      </span>
    </div>
  )
}

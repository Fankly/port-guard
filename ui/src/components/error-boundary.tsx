import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from './ui/button'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Last line of defence: a render failure should still leave the user with a
 * readable screen and a way back, instead of a blank WebView.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Port Guard UI crashed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="grid min-h-dvh place-items-center bg-slab px-6">
        <div className="w-full max-w-[460px] border-4 border-ink bg-paper p-6 text-center shadow-[10px_10px_0_0_#000]">
          <span className="mx-auto grid size-12 place-items-center border-2 border-ink bg-hot-pink text-ink">
            <TriangleAlert className="size-5" strokeWidth={2.6} />
          </span>
          <h1 className="mt-4 font-sans text-[30px] font-black leading-[0.95] tracking-[-0.02em]">
            界面遇到问题
          </h1>
          <p className="mt-3 font-mono text-[12px] leading-[1.65] text-ink">
            页面渲染失败，规则和系统防火墙没有被修改。重新加载后再试一次。
          </p>
          <Button className="mt-6 w-full" onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </div>
      </div>
    )
  }
}

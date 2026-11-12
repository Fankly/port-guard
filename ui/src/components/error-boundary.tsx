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
      <div className="grid min-h-dvh place-items-center bg-background px-6">
        <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-6 text-center shadow-lift">
          <span className="mx-auto grid size-11 place-items-center rounded-xl bg-destructive-soft text-destructive">
            <TriangleAlert className="size-5" />
          </span>
          <h1 className="mt-4 text-[16px] font-semibold">界面遇到问题</h1>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            页面渲染失败，规则和系统防火墙没有被修改。重新加载后再试一次。
          </p>
          <Button className="mt-5 w-full" onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </div>
      </div>
    )
  }
}

import { useCallback, useRef } from 'react'

/**
 * Radix restores focus to its own trigger, but the app opens dialogs from
 * state (no Dialog.Trigger). Remember the opener explicitly and put focus back
 * once the layer has unmounted.
 */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null)

  const capture = useCallback(() => {
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
  }, [])

  const restore = useCallback(() => {
    const target = opener.current
    opener.current = null
    requestAnimationFrame(() => {
      if (document.activeElement !== document.body && document.activeElement) {
        return
      }
      if (target?.isConnected) {
        target.focus({ preventScroll: true })
        return
      }
      const fallback = document.querySelector<HTMLElement>('#main h1')
      fallback?.focus({ preventScroll: true })
    })
  }, [])

  return { capture, restore }
}

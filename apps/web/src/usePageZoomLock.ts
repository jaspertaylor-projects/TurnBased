import { useEffect } from 'react'

const BLOCKED_ZOOM_KEYS = new Set(['+', '=', '-', '_', '0'])

function preventDefault(event: Event) {
  event.preventDefault()
}

export function usePageZoomLock() {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return
      }

      if (BLOCKED_ZOOM_KEYS.has(event.key)) {
        event.preventDefault()
      }
    }

    // Keep the app on a fixed browser zoom baseline while we tune dense visual layouts.
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('gesturestart', preventDefault, { passive: false })
    document.addEventListener('gesturechange', preventDefault, { passive: false })
    document.addEventListener('gestureend', preventDefault, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('gesturestart', preventDefault)
      document.removeEventListener('gesturechange', preventDefault)
      document.removeEventListener('gestureend', preventDefault)
    }
  }, [])
}

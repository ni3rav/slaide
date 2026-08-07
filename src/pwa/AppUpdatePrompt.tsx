import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

declare global {
  interface Window {
    __slaidePwaTest?: {
      showUpdatePrompt: () => void
    }
  }
}

export function AppUpdatePrompt() {
  const [testPrompt, setTestPrompt] = useState(false)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  })

  useEffect(() => {
    window.__slaidePwaTest = {
      showUpdatePrompt: () => setTestPrompt(true),
    }
    return () => {
      delete window.__slaidePwaTest
    }
  }, [])

  const showPrompt = needRefresh || testPrompt

  if (!showPrompt) {
    return null
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-lg border border-border bg-background p-4 shadow-lg"
      role="status"
      data-testid="app-update-prompt"
    >
      <p className="flex-1 text-sm">A new version of Slaide is ready.</p>
      <Button
        type="button"
        size="sm"
        data-testid="app-update-reload"
        onClick={() => {
          if (testPrompt) {
            window.location.reload()
            return
          }
          void updateServiceWorker(true)
        }}
      >
        Reload
      </Button>
    </div>
  )
}

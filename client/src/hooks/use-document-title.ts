import { useEffect } from 'react'
import { APP_DISPLAY_NAME } from '@/config/env'

export function useDocumentTitle(pageTitle: string | undefined) {
  useEffect(() => {
    if (!pageTitle?.trim()) {
      document.title = APP_DISPLAY_NAME
      return
    }
    document.title = `${pageTitle.trim()} · ${APP_DISPLAY_NAME}`
  }, [pageTitle])
}

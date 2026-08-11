/**
 * Route Focus Manager
 * Handles focus management for accessibility on route changes.
 * WCAG 2.2 AA compliant.
 */

import { useEffect, useRef } from 'react'
import { useLocation } from '@tanstack/react-router'

/**
 * Route Focus Manager Component
 * Wraps content and manages focus on route changes.
 */
export function RouteFocusManager({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const previousPathRef = useRef<string>(location.pathname)

  useEffect(() => {
    const currentPath = location.pathname
    const previousPath = previousPathRef.current

    if (currentPath !== previousPath) {
      requestAnimationFrame(() => {
        const focusTarget = document.querySelector<HTMLElement>(
          '#main-content h1, main h1, h1, #main-content, main',
        )
        if (focusTarget) {
          const hadTabIndex = focusTarget.hasAttribute('tabindex')
          if (!hadTabIndex) focusTarget.setAttribute('tabindex', '-1')
          focusTarget.focus({ preventScroll: false })
          if (!hadTabIndex) {
            focusTarget.addEventListener(
              'blur',
              () => focusTarget.removeAttribute('tabindex'),
              { once: true },
            )
          }
        }

        const pageName =
          document.querySelector<HTMLElement>('h1')?.textContent?.trim() ||
          document.title ||
          'halaman baru'
        const liveRegion = document.getElementById('route-announcer')
        if (liveRegion) {
          liveRegion.textContent = `Berpindah ke halaman ${pageName}`
        }
      })

      previousPathRef.current = currentPath
    }
  }, [location.pathname])

  return (
    <>
      <div
        id="route-announcer"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      <div data-testid="app-content">
        {children}
      </div>
    </>
  )
}

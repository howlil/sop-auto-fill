import * as React from 'react'
import { useCallback, useLayoutEffect, useRef } from 'react'
import { cn } from '@/utils/cn'

const LINE_HEIGHT_PX = 20
const VERTICAL_PADDING_PX = 16

export interface AutoResizeTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> {
  minRows?: number
  maxRows?: number
}

function rowHeightPx(rows: number): number {
  return rows * LINE_HEIGHT_PX + VERTICAL_PADDING_PX
}

/**
 * Textarea yang tingginya mengikuti isi (min/max baris), lalu scroll internal jika melebihi max.
 */
export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ className, minRows = 1, maxRows = 8, value, onChange, onInput, ...props }, forwardedRef) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null)
    const minHeightPx = rowHeightPx(minRows)
    const maxHeightPx = rowHeightPx(maxRows)

    const setRef = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node
        if (typeof forwardedRef === 'function') {
          forwardedRef(node)
        } else if (forwardedRef) {
          forwardedRef.current = node
        }
      },
      [forwardedRef],
    )

    const adjustHeight = useCallback(() => {
      const el = innerRef.current
      if (!el) return
      el.style.height = 'auto'
      const nextHeight = Math.min(Math.max(el.scrollHeight, minHeightPx), maxHeightPx)
      el.style.height = `${nextHeight}px`
      el.style.overflowY = el.scrollHeight > maxHeightPx ? 'auto' : 'hidden'
    }, [minHeightPx, maxHeightPx])

    useLayoutEffect(() => {
      adjustHeight()
    }, [value, adjustHeight])

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e)
      requestAnimationFrame(adjustHeight)
    }

    const handleInput = (e: React.InputEvent<HTMLTextAreaElement>) => {
      adjustHeight()
      onInput?.(e)
    }

    return (
      <textarea
        ref={setRef}
        rows={minRows}
        value={value}
        onChange={handleChange}
        onInput={handleInput}
        className={cn(
          'flex w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-primary',
          'disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-50',
          'resize-none',
          className,
        )}
        style={{ minHeight: minHeightPx, maxHeight: maxHeightPx }}
        {...props}
      />
    )
  },
)
AutoResizeTextarea.displayName = 'AutoResizeTextarea'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUIStore } from '@/stores/uiStore'

describe('uiStore toast queue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useUIStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('menjaga toast dalam antrean sampai presenter menutup toast aktif', () => {
    const { addToast } = useUIStore.getState()

    addToast('Toast pertama', 'success')
    addToast('Toast kedua', 'info')
    vi.advanceTimersByTime(10_000)

    expect(useUIStore.getState().toasts.map((toast) => toast.message)).toEqual([
      'Toast pertama',
      'Toast kedua',
    ])
  })

  it('menghapus hanya toast yang selesai ditampilkan', () => {
    const { addToast, removeToast } = useUIStore.getState()
    addToast('Toast pertama', 'success')
    addToast('Toast kedua', 'error')

    const [firstToast] = useUIStore.getState().toasts
    expect(firstToast).toBeDefined()
    removeToast(firstToast!.id)

    expect(useUIStore.getState().toasts).toHaveLength(1)
    expect(useUIStore.getState().toasts[0]?.message).toBe('Toast kedua')
  })
})

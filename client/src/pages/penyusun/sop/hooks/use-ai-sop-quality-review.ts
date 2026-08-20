import { useCallback, useEffect, useRef, useState } from 'react'
import {
  workspaceSopApi,
  type SopQualityReviewResponse,
} from '@/api/workspace-sops'

export interface UseAiSopQualityReviewOptions {
  detailSopId: string
  isReadOnly: boolean
  flushAllAutosave: () => Promise<boolean>
  contentFingerprint: string
}

export interface UseAiSopQualityReviewResult {
  isAvailable: boolean
  isAvailabilityLoading: boolean
  isRunning: boolean
  review: SopQualityReviewResponse | null
  error: Error | null
  runReview: () => Promise<void>
  clearReview: () => void
}

export function useAiSopQualityReview(
  options: UseAiSopQualityReviewOptions,
): UseAiSopQualityReviewResult {
  const { detailSopId, isReadOnly, flushAllAutosave, contentFingerprint } = options
  const [isAvailable, setIsAvailable] = useState(false)
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [review, setReview] = useState<SopQualityReviewResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const previousFingerprintRef = useRef(contentFingerprint)
  const latestFingerprintRef = useRef(contentFingerprint)
  const latestDetailSopIdRef = useRef(detailSopId)
  latestFingerprintRef.current = contentFingerprint
  latestDetailSopIdRef.current = detailSopId

  useEffect(() => {
    let cancelled = false
    setIsAvailabilityLoading(true)
    void workspaceSopApi
      .aiReviewAvailability()
      .then((response) => {
        if (!cancelled) setIsAvailable(response.data.enabled)
      })
      .catch(() => {
        if (!cancelled) setIsAvailable(false)
      })
      .finally(() => {
        if (!cancelled) setIsAvailabilityLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (previousFingerprintRef.current === contentFingerprint) return
    previousFingerprintRef.current = contentFingerprint
    setReview(null)
    setError(null)
  }, [contentFingerprint])

  const clearReview = useCallback(() => {
    setReview(null)
    setError(null)
  }, [])

  const runReview = useCallback(async () => {
    if (!detailSopId || isReadOnly || !isAvailable || isAvailabilityLoading || isRunning) return

    setIsRunning(true)
    setError(null)
    try {
      const saved = await flushAllAutosave()
      if (!saved) {
        setError(new Error('Simpan perubahan SOP terlebih dahulu sebelum menjalankan review AI.'))
        return
      }

      const requestedFingerprint = latestFingerprintRef.current
      const requestedDetailSopId = detailSopId
      const response = await workspaceSopApi.reviewAiSop(requestedDetailSopId)
      if (
        latestFingerprintRef.current !== requestedFingerprint ||
        latestDetailSopIdRef.current !== requestedDetailSopId
      ) {
        setReview(null)
        setError(new Error('SOP berubah selama review AI. Simpan perubahan lalu jalankan review ulang.'))
        return
      }
      setReview(response.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error('Review AI gagal dijalankan.'))
    } finally {
      setIsRunning(false)
    }
  }, [detailSopId, flushAllAutosave, isAvailable, isAvailabilityLoading, isReadOnly, isRunning])

  return {
    isAvailable,
    isAvailabilityLoading,
    isRunning,
    review,
    error,
    runReview,
    clearReview,
  }
}

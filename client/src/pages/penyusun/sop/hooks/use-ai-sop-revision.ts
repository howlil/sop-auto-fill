import { useCallback, useEffect, useRef, useState } from 'react'
import {
  workspaceSopApi,
  type SopAiRevisionResponse,
  type SopQualityFinding,
} from '@/api/workspace-sops'

export interface UseAiSopRevisionOptions {
  detailSopId: string
  isReadOnly: boolean
  flushAllAutosave: () => Promise<boolean>
  contentFingerprint: string
  reviewFingerprint: string | null
}

export interface UseAiSopRevisionResult {
  isAvailable: boolean
  isAvailabilityLoading: boolean
  isRunning: boolean
  selectedFinding: SopQualityFinding | null
  proposal: SopAiRevisionResponse | null
  error: Error | null
  suggest: (finding: SopQualityFinding) => Promise<void>
  cancel: () => void
  clear: () => void
}

export function useAiSopRevision(options: UseAiSopRevisionOptions): UseAiSopRevisionResult {
  const {
    detailSopId,
    isReadOnly,
    flushAllAutosave,
    contentFingerprint,
    reviewFingerprint,
  } = options
  const [isAvailable, setIsAvailable] = useState(false)
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [selectedFinding, setSelectedFinding] = useState<SopQualityFinding | null>(null)
  const [proposal, setProposal] = useState<SopAiRevisionResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const latestContentRef = useRef(contentFingerprint)
  const latestReviewRef = useRef(reviewFingerprint)
  const latestDetailRef = useRef(detailSopId)
  const previousContentRef = useRef(contentFingerprint)
  const previousReviewRef = useRef(reviewFingerprint)
  const requestSequenceRef = useRef(0)
  latestContentRef.current = contentFingerprint
  latestReviewRef.current = reviewFingerprint
  latestDetailRef.current = detailSopId

  useEffect(() => {
    let cancelled = false
    setIsAvailabilityLoading(true)
    void workspaceSopApi.aiRevisionAvailability()
      .then((response) => {
        if (!cancelled) setIsAvailable(response.data.enabled)
      })
      .catch(() => {
        if (!cancelled) setIsAvailable(false)
      })
      .finally(() => {
        if (!cancelled) setIsAvailabilityLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const invalidateTransientState = useCallback(() => {
    requestSequenceRef.current += 1
    setSelectedFinding(null)
    setProposal(null)
    setError(null)
    setIsRunning(false)
  }, [])

  useEffect(() => {
    if (previousContentRef.current === contentFingerprint) return
    previousContentRef.current = contentFingerprint
    invalidateTransientState()
  }, [contentFingerprint, invalidateTransientState])

  useEffect(() => {
    if (previousReviewRef.current === reviewFingerprint) return
    previousReviewRef.current = reviewFingerprint
    invalidateTransientState()
  }, [reviewFingerprint, invalidateTransientState])

  const clear = useCallback(() => {
    invalidateTransientState()
  }, [invalidateTransientState])

  const cancel = useCallback(() => {
    invalidateTransientState()
  }, [invalidateTransientState])

  const suggest = useCallback(async (finding: SopQualityFinding) => {
    if (!detailSopId || isReadOnly || !isAvailable || isAvailabilityLoading || isRunning) return

    const requestSequence = requestSequenceRef.current + 1
    requestSequenceRef.current = requestSequence
    setIsRunning(true)
    setSelectedFinding(finding)
    setProposal(null)
    setError(null)

    try {
      const saved = await flushAllAutosave()
      if (requestSequenceRef.current !== requestSequence) return
      if (!saved) {
        setError(new Error('Simpan perubahan SOP terlebih dahulu sebelum meminta usulan AI.'))
        return
      }

      const requestedDetail = latestDetailRef.current
      const requestedContent = latestContentRef.current
      const requestedReview = latestReviewRef.current
      const response = await workspaceSopApi.suggestAiRevision(requestedDetail, finding)

      const stale =
        requestSequenceRef.current !== requestSequence ||
        latestDetailRef.current !== requestedDetail ||
        latestContentRef.current !== requestedContent ||
        latestReviewRef.current !== requestedReview
      if (stale) {
        if (requestSequenceRef.current === requestSequence) {
          setProposal(null)
          setError(new Error('SOP atau hasil review berubah. Minta usulan AI ulang.'))
        }
        return
      }
      setProposal(response.data)
    } catch (cause) {
      if (requestSequenceRef.current === requestSequence) {
        setProposal(null)
        setError(cause instanceof Error ? cause : new Error('Usulan AI gagal dibuat.'))
      }
    } finally {
      if (requestSequenceRef.current === requestSequence) setIsRunning(false)
    }
  }, [detailSopId, flushAllAutosave, isAvailable, isAvailabilityLoading, isReadOnly, isRunning])

  return {
    isAvailable,
    isAvailabilityLoading,
    isRunning,
    selectedFinding,
    proposal,
    error,
    suggest,
    cancel,
    clear,
  }
}

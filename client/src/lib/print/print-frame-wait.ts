const FRAME_FALLBACK_TIMEOUT_MS = 120

/** requestAnimationFrame may pause in background tabs; always keep a timer fallback. */
export function waitForAnimationFrameOrTimeout(
  timeoutMs = FRAME_FALLBACK_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      window.clearTimeout(timeoutId)
      resolve()
    }
    const timeoutId = window.setTimeout(finish, timeoutMs)
    requestAnimationFrame(finish)
  })
}

export async function waitForPaintFrames(frames = 2): Promise<void> {
  for (let index = 0; index < frames; index += 1) {
    await waitForAnimationFrameOrTimeout()
  }
}

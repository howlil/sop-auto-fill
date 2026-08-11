import { StrictMode, startTransition } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/react-start/client'
import { removeKnownExtensionAttributes } from './lib/hydration/remove-known-extension-attributes'

startTransition(() => {
  removeKnownExtensionAttributes(document)

  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  )
})

const KNOWN_EXTENSION_ATTRIBUTES = ['bis_skin_checked'] as const

/**
 * Some browser security extensions mutate the server-rendered DOM before React
 * hydrates it. Remove only attributes that are known to be external so genuine
 * application hydration mismatches remain visible.
 */
export function removeKnownExtensionAttributes(
  root: ParentNode = document,
): number {
  let removedAttributeCount = 0

  KNOWN_EXTENSION_ATTRIBUTES.forEach((attribute) => {
    if (root instanceof Element && root.hasAttribute(attribute)) {
      root.removeAttribute(attribute)
      removedAttributeCount += 1
    }

    root.querySelectorAll(`[${attribute}]`).forEach((element) => {
      element.removeAttribute(attribute)
      removedAttributeCount += 1
    })
  })

  return removedAttributeCount
}

import { useState } from "react";

/**
 * State panel kiri/kanan collapsible
 */
export function useCollapsiblePanels(
  initialLeft = false,
  initialRight = false,
) {
  const [leftCollapsed, setLeftCollapsed] = useState(initialLeft);
  const [rightCollapsed, setRightCollapsed] = useState(initialRight);

  return { leftCollapsed, setLeftCollapsed, rightCollapsed, setRightCollapsed };
}

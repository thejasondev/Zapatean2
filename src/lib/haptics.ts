// ============================================
// ZAPATEAN2 — Haptic Feedback
// ============================================

/**
 * Check if the Vibration API is available.
 */
function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Short vibration for confirming an action (e.g., route confirmed).
 */
export function vibrateConfirm(): void {
  if (canVibrate()) {
    navigator.vibrate(50);
  }
}

/**
 * Double-tap vibration pattern for reaching a checkpoint.
 */
export function vibrateCheckpoint(): void {
  if (canVibrate()) {
    navigator.vibrate([40, 60, 40]);
  }
}

/**
 * Light tap for UI interactions (button press, selection change).
 */
export function vibrateTap(): void {
  if (canVibrate()) {
    navigator.vibrate(15);
  }
}

/**
 * Warning vibration for errors or alerts.
 */
export function vibrateWarning(): void {
  if (canVibrate()) {
    navigator.vibrate([100, 50, 100, 50, 100]);
  }
}

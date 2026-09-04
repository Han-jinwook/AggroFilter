/**
 * 📳 Merlin Hub SDK Haptic Feedback Engine (Web Vibration API)
 * 모바일 네이티브 감성의 가벼운 진동 피드백 엔진
 */
export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export const triggerHaptic = (type: HapticType = 'light'): boolean => {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) {
    return false;
  }
  try {
    switch (type) {
      case 'light':
        return navigator.vibrate(10);
      case 'medium':
        return navigator.vibrate(20);
      case 'heavy':
        return navigator.vibrate(35);
      case 'success':
        return navigator.vibrate([15, 40, 25]);
      case 'warning':
        return navigator.vibrate([30, 40, 30]);
      case 'error':
        return navigator.vibrate([40, 60, 40, 60, 40]);
      default:
        return navigator.vibrate(10);
    }
  } catch {
    return false;
  }
};

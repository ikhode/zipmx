/**
 * Utilidad global para feedback háptico (vibración) en dispositivos móviles.
 * Compatible con Capacitor y navegadores modernos.
 */

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export const triggerHaptic = (type: HapticType = 'light') => {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  switch (type) {
    case 'light':
      navigator.vibrate(10);
      break;
    case 'medium':
      navigator.vibrate(25);
      break;
    case 'heavy':
      navigator.vibrate(50);
      break;
    case 'success':
      navigator.vibrate([10, 30, 10]);
      break;
    case 'warning':
      navigator.vibrate([30, 30, 30]);
      break;
    case 'error':
      navigator.vibrate([50, 20, 50, 20, 50]);
      break;
    default:
      navigator.vibrate(10);
  }
};

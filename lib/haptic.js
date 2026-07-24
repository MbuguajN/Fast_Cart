export function haptic(style = 'light') {
  if (typeof window === 'undefined') return;
  if ('vibrate' in navigator) {
    switch (style) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate(40);
        break;
      case 'success':
        navigator.vibrate([10, 50, 10]);
        break;
      default:
        navigator.vibrate(10);
    }
  }
}

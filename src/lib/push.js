import { getVapidPublicKey, subscribePush } from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function enablePush(coupleId) {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;

    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return false;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const { publicKey } = await getVapidPublicKey();
      if (!publicKey) return false;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await subscribePush(coupleId, subscription.toJSON());
    return true;
  } catch {
    return false;
  }
}

import APIClient from './api';

const VAPID_PUBLIC_KEY = 'BAUYCP62A2X6DrcfXh_zYOWNMEG2LlevQ7DTWeh9LbyweeguGn2aRyJkktrc246AprcH7Il-hifvHDM9RGQ578E';

// Helper to convert base64 VAPID to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const requestPushPermission = async (): Promise<boolean> => {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Este navegador no soporta web push completo.');
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Unsubscribe existing ones if necessary (optional), but let's just create a new one safely
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
          subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
      }

      if (subscription) {
        console.log('Web Push pre-suscrito correctamente.');
        // Convert to string and send to backend
        const subJson = JSON.stringify(subscription);
        await APIClient.updateProfile({ pushSubscription: subJson });
        return true;
      }
    } else {
      console.warn('Permiso de notificaciones denegado.');
    }
  } catch (error) {
    console.error('Error al suscribir a web push:', error);
  }
  return false;
};

export const listenForForegroundMessages = () => {
    // Escuchar mensajes provenientes de nuestro propio sw.js
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'PUSH_RECEIVED') {
           console.log('Mensaje Push recibido en primer plano (SW Event):', event.data.payload);
        }
      });
    }
};

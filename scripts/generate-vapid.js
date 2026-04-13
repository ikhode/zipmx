import webpush from 'web-push';
const vapidKeys = webpush.generateVAPIDKeys();
console.log('Public Key:\n' + vapidKeys.publicKey);
console.log('Private Key:\n' + vapidKeys.privateKey);


self.addEventListener('install', ev => {
    console.log('sw installed')
});

self.addEventListener('activate', ev => {
    console.log('sw activated')
});

// Listen for push events, when one is received, notify user
self.addEventListener('push', event => {
    console.log('This push event has data: ', event.data.json());
    let obj = event.data.json();

    let options = {
        body: obj.generated,
        icon: 'images/notification-flat.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now()
          },
          requireInteraction: true,

          // add actions to the notification
          actions: [
            {action: 'explore', title: 'Go to the site',
              icon: 'img/checkmark.png'},
            {action: 'close', title: 'Close the notification',
              icon: 'img/xmark.png'},
          ]
    }

    let title = "Price threshold reached";

    event.waitUntil(
      self.registration.showNotification(title, options)
    )
});


// Handle the notificationclick event
self.addEventListener('notificationclick', e => {
    let notification = e.notification;
    let primaryKey = notification.data.primaryKey;
    let action = e.action;

    if (action === 'close') {
      notification.close();
    } else {
      clients.openWindow('/');
      notification.close();
    }
  })
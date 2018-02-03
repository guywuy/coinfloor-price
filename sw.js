
self.addEventListener('install', ev => {
    console.log('sw installed')
});

self.addEventListener('activate', ev => {
    console.log('sw activated')
});

// Listen for push events, when one is received, notify user
self.addEventListener('push', event => {
    if (!event.data) {
      console.log('No data supplied with the push event.')
      return
    }
    
    console.log('This push event has data: ', event.data.json());
    let obj = event.data.json();

    let options = {
        body: 'Price is ' + obj.xbtPrice + '. Target was ' + obj.target + '. Time: ' + obj.time,
        icon: `public/images/${obj.operator == 'gt' ? 'green' : 'red'}arrow.png`,
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now()
          },
          requireInteraction: true
    }

    let title = "Price threshold reached";

    event.waitUntil(
      self.registration.showNotification(title, options)
    )
});


// Handle the notificationclick event
self.addEventListener('notificationclick', function(event) {
  
    // close the notification
    event.notification.close();
  
    // see if the current is open and if it is focus it
    // otherwise open new tab
    event.waitUntil(
  
      self.clients.matchAll().then(function(clientList) {
    
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
    
        return self.clients.openWindow('/');
      })
    );
  });
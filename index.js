const { URL } = require('url');
const https = require('https');
const http = require('http');
const ejs = require('ejs');
const fs = require('fs');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const webpush = require('web-push');



app.set('views', './views');
app.set('view engine', 'ejs');

app.use(express.static('./'));

app.use(bodyParser.json());


var prices = {
    'xbtLast': '...',
    'xbtLow': '...',
    'xbtHigh': '...',
    'bchLast': '...',
    'bchLow': '...',
    'bchHigh': '...',
    'xbtChange': 0,
    'bchChange': 0,
    'time': Date.now()
}

// Variables for calculating change over time
var xbtPrevious = 0;
var xbtChanges = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var bchPrevious = 0;
var bchChanges = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];


const optionsXBT = {
    hostname: 'webapi.coinfloor.co.uk',
    port: 8090,
    path: '/bist/XBT/GBP/ticker/',
    method: 'GET'
};
const optionsBCH = {
    hostname: 'webapi.coinfloor.co.uk',
    port: 8090,
    path: '/bist/BCH/GBP/ticker/',
    method: 'GET'
};

function updateVals(){

    // GET XBT from coinfloor api
    https.get(optionsXBT, (res) => {
        res.setEncoding('utf8');
        prices.time = res.headers.date; // Get time of response from header
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
            try {
                const parsedData = JSON.parse(rawData);
                prices.xbtLast = parsedData.last;
                prices.xbtLow = parsedData.low;
                prices.xbtHigh = parsedData.high;

                // make sure initial value of xbt is set
                if (xbtPrevious == 0) {
                    xbtPrevious = Math.floor(Number(prices.xbtLast));
                }

                // work out change from previous value
                let xbtLastChange = Math.floor(Number(prices.xbtLast)) - xbtPrevious;
                // add change to array of price changes.
                xbtChanges.shift(); //remove first element
                xbtChanges.push(xbtLastChange);
                // work out average change over last few changes.
                let averageChange = xbtChanges.reduce( (accum, curr) => accum + curr );
                prices.xbtChange = averageChange;
                
                xbtPrevious = Math.floor(Number(prices.xbtLast)) //Set previous xbt to lastprice

            } catch (e) {
                console.error(e.message);
            }
        });
    }).on('error', (e) => {
        console.error(e);
    });

    // GET BCH from coinfloor api
    https.get(optionsBCH, (res) => {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
            try {
                const parsedData = JSON.parse(rawData);
                prices.bchLast = parsedData.last;
                prices.bchLow = parsedData.low;
                prices.bchHigh = parsedData.high;

                // make sure initial value of xbt is set
                if (bchPrevious == 0) {
                    bchPrevious = Math.floor(Number(prices.bchLast));
                }

                // work out change from previous value
                let bchLastChange = Math.floor(Number(prices.bchLast)) - bchPrevious;
                // add change to array of price changes.
                bchChanges.shift(); //remove first element
                bchChanges.push(bchLastChange);
                // work out average change over last few changes.
                let averageChange = bchChanges.reduce( (accum, curr) => accum + curr );
                prices.bchChange = averageChange;
                
                bchPrevious = Math.floor(Number(prices.bchLast)) //Set previous bch to lastprice
            } catch (e) {
                console.error(e.message);
            }
        });
    }).on('error', (e) => {
        console.error(e);
    });
}

// Set a timeout to automatically update the prices ready to send to users.
let inty = setInterval(() => {
    updateVals();
    checkSubscriptions();
}, 8000);

// Update values initially
updateVals();



app.get('/', (req, res) => {

    res.render('index.ejs', {
        prices: prices
    })
})

app.get('/current', (req, res) => {
    res.end(JSON.stringify(prices))    
})

const vapidPublicKey = 'BCWQthp74GCgHRnPB7xv7XWP7XuZ-wkt2JG7DnYfN_68iqO69-UfBVYlSiXSL9gbOWHLzslEf2-_b7LFfBZWFEc';
const vapidPrivateKey = 'Vl_FNpk5zxPu1CawJ-IMxdPhvUWbYB7TXOzMEOdiyYY';

var subscriptions = [];

// If there are any subscriptions, check whether the current price satisfies the target.
// If it does, send a push notification and remove the subscription.
function checkSubscriptions(){
    // console.log('checking subscriptions. subscriptions length is: ' + subscriptions.length)
    if(subscriptions.length<1) return;
    let xbtPrice = prices.xbtLast;

    subscriptions.forEach( (sub, i) => {
        if (sub.operator == 'gt'){
            if (xbtPrice > sub.target){
                console.log('High target matched.');
                let message =  JSON.stringify({
                    'xbtPrice': xbtPrice,
                    'operator' : sub.operator,
                    'target' : sub.target
                });
                
                const options = {
                    TTL: 60,
                    vapidDetails: {
                        subject: 'mailto: pushyman@mailinator.com',
                        publicKey: vapidPublicKey,
                        privateKey: vapidPrivateKey
                    }
                }
                
                webpush.sendNotification(
                    sub.subscription,
                    message,
                    options
                ).then( resp => {
                    console.log('Push notification sent, removing subscription with target: ' + sub.target);
                    removeSubscription(i);
                }).catch( err => {
                    console.log('Error sending push from server, removing subscription.', err)
                    removeSubscription(i);
                })
            }
        } else {
            if (xbtPrice < sub.target){
                console.log('Low target matched');
                let message =  JSON.stringify({
                    'xbtPrice': xbtPrice,
                    'operator' : sub.operator,
                    'target' : sub.target
                });
                
                const options = {
                    TTL: 60,
                    vapidDetails: {
                        subject: 'mailto: pushyman@mailinator.com',
                        publicKey: vapidPublicKey,
                        privateKey: vapidPrivateKey
                    }
                }
                
                webpush.sendNotification(
                    sub.subscription,
                    message,
                    options
                ).then( resp => {
                    console.log('Push notification sent, removing subscription with target: ' + sub.target);
                    removeSubscription(i);
                }).catch( err => {
                    console.log('Error sending push from server, removing subscription.', err)
                    removeSubscription(i);
                })
            }
        }
    })
}


function removeSubscription(index){
    subscriptions.splice(index, 1);
}

// When post is made to subscribe, add the subscription to the array
app.post('/subscribe', (req, res) => {
    subscriptions.push(req.body);
    console.log('POST has been made, with req body: ', req.body);
    res.end();
})

app.listen(8080, () => console.log('Listening on port 8080!'))
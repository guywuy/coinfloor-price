const https = require('https');
const ejs = require('ejs');
const fs = require('fs');
const os = require('os');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const webpush = require('web-push');
const { MONGO_URL } = process.env;

const vapidPublicKey = 'BCWQthp74GCgHRnPB7xv7XWP7XuZ-wkt2JG7DnYfN_68iqO69-UfBVYlSiXSL9gbOWHLzslEf2-_b7LFfBZWFEc';
const vapidPrivateKey = 'Vl_FNpk5zxPu1CawJ-IMxdPhvUWbYB7TXOzMEOdiyYY';

//-----------------------------------DATABASE--------------------------
//lets require/import the mongodb native drivers.
const mongodb = require('mongodb');
//We need to work with "MongoClient" interface in order to connect to a mongodb server.
const MongoClient = mongodb.MongoClient;
// Connection URL. This is where your mongodb server is running.
// Standard URI format: mongodb://[dbuser:dbpassword@]host:port/dbname
const DBURL = MONGO_URL;
const DBNAME = 'cfsubscriptions';
const COLLECTIONNAME = 'subscriptions';

// DB FUNCTIONS
const insertDocument = function(db, document, callback) {
    // Get the documents collection
    const collection = db.collection(COLLECTIONNAME);
    // Insert some documents
    collection.insertOne(document, function(err, result) {
        if (err) console.error(err);
        console.log("Inserted document into the collection");
        callback(result);
    });
}
const findDocuments = function(db, query, callback) {
    // Get the documents collection
    const collection = db.collection(COLLECTIONNAME);
    // Find some documents
    collection.find(query).toArray(function(err, docs) {
        callback(docs, db);
    });
}
const removeDocument = function(db, document, callback) {
    // Get the documents collection
    const collection = db.collection(COLLECTIONNAME);
    // Find some documents
    collection.deleteOne({"_id" : document._id}, function(err, result) {
        console.log("Removed the document with id: " + document._id);
        callback(result);
    });    
}


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
        console.error("Error getting coinfloor XBT", e);
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
        console.error("Error getting coinfloor BCH", e);
    });
}

// Set a timeout to automatically update the prices ready to send to users.
let inty = setInterval(() => {
    updateVals();
    findMatchingSubscriptions();
    // checkSubscriptions();
}, 8000);

// Update values initially
updateVals();



app.get('/', (req, res) => {
    res.render('index.ejs', {
        prices: prices
    }, function(err, html) {
        if (err) console.err('Error getting route of coinfloor price, in res.render');
        res.send(html);
      })
})

app.get('/current', (req, res) => {
    res.json(prices)    
})




function findMatchingSubscriptions(){

    const currPrices = {
        xbt : prices.xbtLast,
        bch : prices.bchLast
    };
    const now = new Date();
    const formattedTime =`${now.getHours()}:${(now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes())}`;


    MongoClient.connect(DBURL, function (err, client) {
        
        if (err) {
            console.log('Unable to connect to the mongoDB server. Error:', err);
        } else {
            console.log('Connection established to', DBURL);

            const db = client.db(DBNAME);

            // Get all subscriptions and if they match target, send push notification and then delete from db
            findDocuments(db, {}, function(docs, db) {

                if (docs.length === 0) return;

                docs.forEach(subscriptionObject => {
                    let subCurrency = subscriptionObject.currency;
                    let currentPrice = parseInt(currPrices[subCurrency], 10);

                    if ((subscriptionObject.operator === 'gt' && currentPrice > parseInt(subscriptionObject.target, 10)) || (subscriptionObject.operator === 'lt' && currentPrice < parseInt(subscriptionObject.target, 10))){
                            let message =  JSON.stringify({
                                'currency' : subCurrency,
                                'price': currentPrice,
                                'operator' : subscriptionObject.operator,
                                'target' : subscriptionObject.target,
                                'time' : formattedTime
                            });

                            const notificationOptions = {
                                TTL: 60,
                                vapidDetails: {
                                    subject: 'mailto: pushyman@mailinator.com',
                                    publicKey: vapidPublicKey,
                                    privateKey: vapidPrivateKey
                                }
                            }

                            webpush.sendNotification(
                                subscriptionObject.subscription,
                                message,
                                notificationOptions
                            ).then( resp => {

                                // Remove the subscription from the db
                                MongoClient.connect(DBURL, function (err, client) {
                                    if (err) {
                                        console.log('Unable to connect to the mongoDB server. Error:', err);
                                    } else {                            
                                        const db = client.db(DBNAME);
                                        removeDocument(db, subscriptionObject, function() {
                                            client.close();
                                        });
                                    }
                                })
                            }).catch( err => {
                                console.error(err);
                            })
                    } 
                })
                client.close();
            });

        }
    });
}



// When post is made to subscribe, add the subscription to the array
app.post('/subscribe', (req, res) => {

    MongoClient.connect(DBURL, function (err, client) {
        
        if (err) {
            console.log('Unable to connect to the mongoDB server. Error:', err);
        } else {

            const db = client.db(DBNAME);

            insertDocument(db, req.body, function() {
                client.close();
            });

        }
    });

    res.end();
})

app.listen(8080, () => console.log('Listening on port 8080! : http://localhost:8080/'));
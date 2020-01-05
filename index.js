const https = require('https');
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
    xbt: {
        last: '...',
        low: '...',
        high: '...',
        change: 0,
    },
    'time': Date.now()
}

// Variables for calculating change over time
var previousValues = {
    xbt: {
        previous: 0,
        changes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
}


function updateVals(){

    let currencies = ['xbt'];
    currencies.forEach(function(currency) {

        let getOptions = {
            hostname: 'webapi.coinfloor.co.uk',
            port: 8090,
            path: `/bist/${currency.toUpperCase()}/GBP/ticker/`,
            method: 'GET'
        };

        // GET Prices from coinfloor api and update local price object
        https.get(getOptions, (res) => {
            res.setEncoding('utf8');
            prices.time = res.headers.date; // Get time of response from header
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(rawData);
                    prices[currency].last = parsedData.last;
                    prices[currency].low = parsedData.low;
                    prices[currency].high = parsedData.high;

                    // make sure initial value of currency is set
                    if (previousValues[currency].previous == 0) {
                        previousValues[currency].previous = Math.floor(Number(prices[currency].last));
                    }

                    // work out change from previous value
                    let lastChange = Math.floor(Number(prices[currency].last)) - previousValues[currency].previous;
                    // add change to array of price changes.
                    previousValues[currency].changes.shift(); //remove first element
                    previousValues[currency].changes.push(lastChange);
                    // work out average change over last few changes.
                    let averageChange = previousValues[currency].changes.reduce( (accum, curr) => accum + curr );
                    prices[currency].change = averageChange;
                    
                    previousValues[currency].previous = Math.floor(Number(prices[currency].last)) //Set previous xbt to lastprice

                } catch (e) {
                    console.error(e.message);
                }
            });
        }).on('error', (e) => {
            console.error("Error getting price from coinfloor", e);
        });
    });

}

// Set a timeout to automatically update the prices ready to send to users.
let inty = setInterval(() => {
    updateVals();
    findMatchingSubscriptions();
}, 8000);

// Update values initially
updateVals();



app.get('/', (req, res) => {
    res.render('index.ejs', {
        prices: prices
    }, function(err, html) {
        if (err) console.error(err);
        res.send(html);
      })
})

app.get('/current', (req, res) => {
    res.json(prices)    
})


function findMatchingSubscriptions(){

    const currPrices = {
        xbt : prices.xbt.last,
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
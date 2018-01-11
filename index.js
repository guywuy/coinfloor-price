const { URL } = require('url');
const https = require('https');
const http = require('http');
const ejs = require('ejs');
const fs = require('fs');



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

var htmlContent = fs.readFileSync(__dirname + '/views/index.ejs', 'utf8');


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
let inty = setInterval(updateVals, 8000);

// Update values initially
updateVals();


var server = http.createServer(handleRequest);
server.listen(8080);

console.log('Server started on port 8080');

function handleRequest(req, res) {
    //Create a basic route for client js to be able to get prices
    if(req.url === '/current'){
        res.end(JSON.stringify(prices))
    }

    var htmlRenderized = ejs.render(htmlContent, {prices: prices});

    res.end(htmlRenderized);
}
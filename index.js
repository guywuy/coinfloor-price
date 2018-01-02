const { URL } = require('url');
const https = require('https');
const http = require('http');

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

function getText(){

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
    <title>XBT and BTC price</title>
    
    <style>
    html {
        background: #c5c5c5;
    }
    body {
        margin: 0 auto;
        padding: 0;
        box-sizing: border-box;
        max-width: 600px;
        color: rgb(231, 231, 231);
        text-shadow: 1px 1px 1px #444;
        font-family: 'Lucida Sans', 'Lucida Sans Regular', 'Lucida Grande', 'Lucida Sans Unicode', Geneva, Verdana, sans-serif;
    }
    section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 80px 80px;
        grid-gap: 8px;
        margin: 46px 0;
    }
    section>*{
        padding: 20px;
        line-height: 40px;
        font-size: 120%;
    }
    section>*:nth-child(4n+1) { background: goldenrod;}
    section>*:nth-child(4n+2) { background: dodgerblue;}
    section>*:nth-child(4n+3) { background: tomato;}
    section>*:nth-child(4n+4) { background: #009900;}
    
    h2 {
        margin: 0;
    }
    .last{
        font-weight: bold;
    }
    #time {
        font-size: 12px;
        color:black;
        text-shadow: none;
    }
    .increase:after{
        content: '▲';
        color: green;
        float: right;
        padding: 0 5% 0 0;
        font-size: 32px;
    }
    .decrease:after{
        content: '▼';
        color: red;
        float: right;
        padding: 0 5% 0 0;
        font-size: 32px;
    }
    </style>    
    </head>
    
    <body>
    
    <section class="xbt">
    <div>
    <h2>X B T</h2>
    </div>
    <div>
    <span>Last: </span>
    <span class="last ${prices.xbtChange}" id="xbt-last">${prices.xbtLast.slice(0, -3)}</span> 
    </div>
    <div>
    <span>Low: </span>
    <span id="xbt-low">${prices.xbtLow.slice(0, -3)}</span> 
    </div>
    <div>
    <span>High: </span>
    <span id="xbt-high">${prices.xbtHigh.slice(0, -3)}</span> 
    </div>
    </section>
    
    <section class="bch">
    <div>
    <h2>B C H</h2>
    </div>
    <div>
    <span>Last: </span>
    <span class="last ${prices.bchChange}" id="bch-last">${prices.bchLast.slice(0, -3)}</span> 
    </div>
    <div>
    <span>Low: </span>
    <span id="bch-low">${prices.bchLow.slice(0, -3)}</span> 
    </div>
    <div>
    <span>High: </span>
    <span id="bch-high">${prices.bchHigh.slice(0, -3)}</span> 
    </div>
    </section>
    <p id="time">${prices.time}</p>

    <script>

    function updatePrices(){

        fetch('/current').then(response => response.json())
        .then( prices => {
            document.querySelector('#xbt-last').innerHTML = prices.xbtLast.slice(0, -3);
            document.querySelector('#xbt-high').innerHTML = prices.xbtHigh.slice(0, -3);
            document.querySelector('#xbt-low').innerHTML = prices.xbtLow.slice(0, -3);
            document.querySelector('#bch-last').innerHTML = prices.bchLast.slice(0, -3);
            document.querySelector('#bch-high').innerHTML = prices.bchHigh.slice(0, -3);
            document.querySelector('#bch-low').innerHTML = prices.bchLow.slice(0, -3);
            document.querySelector('#time').innerHTML = prices.time;

            // Add or remove classes to reflect price change
            document.querySelector('#xbt-last').classList.remove("increase", "decrease");
            document.querySelector('#xbt-last').classList.add(prices.xbtChange);
        })
        .catch(() => console.log("Oops! Can't get current prices"));
                
    }
    let inty = setInterval(updatePrices, 7000);

    </script>
    
    </body>
    </html>
    `
}



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
                console.log('xbtChanges', xbtChanges);
                let averageChange = xbtChanges.reduce( (accum, curr) => accum + curr );
                console.log('average xbt change', averageChange);
                
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
                console.log('bchChanges', bchChanges);
                let averageChange = bchChanges.reduce( (accum, curr) => accum + curr );
                console.log('average bch change', averageChange);
                
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
let inty = setInterval(updateVals, 7000);

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

    res.end(getText());
}
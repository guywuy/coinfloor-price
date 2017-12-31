const { URL } = require('url');
const https = require('https');
const http = require('http');

var prices = {
    'xbtLast': '...',
    'xbtLow': '...',
    'xbtHigh': '...',
    'bchLast': '...',
    'bchLow': '...',
    'bchHigh': '...'
}

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
        text-shadow: 2px 1px 1px #444;
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
    </style>    
    </head>
    
    <body>
    
    <section class="xbt">
    <div>
    <h2>XBT</h2>
    </div>
    <div>
    <span>Last: </span>
    <span class="last" id="xbt-last">${prices.xbtLast}</span> 
    </div>
    <div>
    <span>Low: </span>
    <span id="xbt-low">${prices.xbtLow}</span> 
    </div>
    <div>
    <span>High: </span>
    <span id="xbt-high">${prices.xbtHigh}</span> 
    </div>
    </section>
    
    <section class="bch">
    <div>
    <h2>BCH</h2>
    </div>
    <div>
    <span>Last: </span>
    <span class="last" id="bch-last">${prices.bchLast}</span> 
    </div>
    <div>
    <span>Low: </span>
    <span id="bch-low">${prices.bchLow}</span> 
    </div>
    <div>
    <span>High: </span>
    <span id="bch-high">${prices.bchHigh}</span> 
    </div>
    </section>
    <script>

    function updatePrices(){
        document.querySelector('#xbt-last').innerHTML = '...';
        document.querySelector('#xbt-high').innerHTML = '...';
        document.querySelector('#xbt-low').innerHTML = '...';
        document.querySelector('#bch-last').innerHTML = '...';
        document.querySelector('#bch-high').innerHTML = '...';
        document.querySelector('#bch-low').innerHTML = '...';

        fetch('/current').then(response => response.json())
        .then( contents => {
            document.querySelector('#xbt-last').innerHTML = Math.floor(Number(contents.xbtLast));
            document.querySelector('#xbt-high').innerHTML = Math.floor(Number(contents.xbtHigh));
            document.querySelector('#xbt-low').innerHTML = Math.floor(Number(contents.xbtLow));
            document.querySelector('#bch-last').innerHTML = Math.floor(Number(contents.bchLast));
            document.querySelector('#bch-high').innerHTML = Math.floor(Number(contents.bchHigh));
            document.querySelector('#bch-low').innerHTML = Math.floor(Number(contents.bchLow));
        })
        .catch(() => console.log("Oops! Can't get current prices"));
                
    }
    let inty = setInterval(updatePrices, 5000);

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
    https.get(optionsXBT, (res) => {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
            try {
                const parsedData = JSON.parse(rawData);
                prices.xbtLast = parsedData.last;
                prices.xbtLow = parsedData.low;
                prices.xbtHigh = parsedData.high;
            } catch (e) {
                console.error(e.message);
            }
        });
    }).on('error', (e) => {
        console.error(e);
    });
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
            } catch (e) {
                console.error(e.message);
            }
        });
    }).on('error', (e) => {
        console.error(e);
    });
}

// Set a timeout to automatically update the prices ready to send to users.
let inty = setInterval(updateVals, 5000);

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
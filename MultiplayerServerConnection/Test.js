var ws = require('ws');
var os = require('os');

var wsaddresses = process.argv.slice(2);
if (wsaddresses.length === 0){
    console.log("Usage: node ws-client.js <ws_address>");
    return;
}

var client = new ws(wsaddresses[0]);
 
client.on('open', function open() {
    console.log('WebSocket client connected to ' + wsaddresses[0]);
});

client.on('message', function incoming(data) {
    console.log(data.toString());
});

client.on('error', function error(error) {
    console.error('WebSocket error: %s', error);
});
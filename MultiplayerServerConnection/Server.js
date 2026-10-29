const express = require('express');
const app = express();
const server = require('http').Server(app);
const url = require('url');
const path = require('path');

const WebSocket = require('ws');

const port = parseInt(process.argv[2] || process.env.PORT || '8080', 10);
const buildDirectory = path.join(__dirname, 'FightingBuild');

const wss1 = new WebSocket.Server({ noServer: true });
const wss2 = new WebSocket.Server({ noServer: true });



// camera websocket
wss1.on('connection', function connection(ws) {

  if (ws._socket.setNoDelay) {
    ws._socket.setNoDelay(true);
  }

  ws.on('message', function incoming(message) {
    //console.log('received '+ new Date());
    wss2.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});


// webbrowser websocket
wss2.on('connection', function connection(ws) {
  if (ws._socket.setNoDelay) {
    ws._socket.setNoDelay(true);
  }
  ws.on('message', function incoming(message) {
  	// nothing here should be received
    console.log('received wss2: %s', message);
  });
});

server.on('upgrade', function upgrade(request, socket, head) {
  const pathname = url.parse(request.url).pathname;

  if (pathname === '/server') {
    wss1.handleUpgrade(request, socket, head, function done(ws) {
      wss1.emit('connection', ws, request);
    });
  } else if (pathname === '/client') {
    wss2.handleUpgrade(request, socket, head, function done(ws) {
      wss2.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

app.get("/numberofclients", function (req, res) {
    var numberofclient = wss2.clients.size;
    res.writeHead(200, {'Content-Type': 'text/plain'}); // send response header
   res.end(numberofclient.toString()); // send response body
});
// cors
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get("/", function (req, res) {
  res.sendFile(path.join(buildDirectory, 'index.html'));
});

app.use(express.static(buildDirectory, {
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('.br')) {
      const originalExtension = path.extname(filePath.slice(0, -3));
      const contentType = {
        '.js': 'application/javascript',
        '.wasm': 'application/wasm'
      }[originalExtension] || 'application/octet-stream';

      res.setHeader('Content-Encoding', 'br');
      res.setHeader('Content-Type', contentType);
    }
  }
}));

server.listen(port, () => {
	console.log(`App listening at http://localhost:${port}`)
})
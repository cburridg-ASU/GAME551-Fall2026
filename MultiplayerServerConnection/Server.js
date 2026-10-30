const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const port = parseInt(process.argv[2] || process.env.PORT || '8080', 10);
const maxRooms = parseInt(process.env.MAX_ROOMS || '20', 10);
const buildDirectory = path.join(__dirname, 'FightingBuild');
const lobbyDirectory = path.join(__dirname, 'public');
const webAssetsDirectory = path.join(__dirname, 'WebAssets');
const rooms = new Map();
const reservationTimeoutMs = 5 * 60 * 1000;

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port.');
}

if (!Number.isInteger(maxRooms) || maxRooms < 1) {
  throw new Error('MAX_ROOMS must be a positive integer.');
}

function staticOptions() {
  return {
    setHeaders: function (res, filePath) {
      const compressionExtension = path.extname(filePath);
      if (compressionExtension === '.br' || compressionExtension === '.gz') {
        const originalExtension = path.extname(filePath.slice(0, -compressionExtension.length));
        const contentType = {
          '.js': 'application/javascript',
          '.wasm': 'application/wasm'
        }[originalExtension] || 'application/octet-stream';

        res.setHeader('Content-Encoding', compressionExtension === '.br' ? 'br' : 'gzip');
        res.setHeader('Content-Type', contentType);
      }
    }
  };
}

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function createRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function sendToRoom(room, message) {
  const payload = JSON.stringify(message);
  room.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

function closeRoom(room, reason) {
  if (room.closed) {
    return;
  }

  room.closed = true;
  clearTimeout(room.expirationTimer);
  rooms.delete(room.code);

  sendToRoom(room, { type: 'roomClosed', reason, lobbyPort: port });

  room.clients.forEach((client) => {
    client.close(1000, 'Room closed');
  });

  console.log(`Room ${room.code} closed`);
}

function makeRoomUrl(req, room, token) {
  const lobbyUrl = new URL(`${req.protocol}://${req.get('host')}`);
  const roomUrl = new URL(lobbyUrl);
  roomUrl.port = port;
  roomUrl.pathname = '/index.html';
  roomUrl.searchParams.set('seat', token);
  roomUrl.searchParams.set('lobbyPort', port);

  return roomUrl.toString();
}

function allocateRoom() {
  if (rooms.size >= maxRooms) {
    throw new Error('No room slots are available. Close an active room or try again later.');
  }

  const room = {
    code: createRoomCode(),
    createdAt: Date.now(),
    seats: new Map(),
    connectedPlayers: new Set(),
    clients: new Map(),
    inputRates: new Map(),
    closed: false,
    expirationTimer: null
  };

  while (rooms.has(room.code)) {
    room.code = createRoomCode();
  }

  room.seats.set(createToken(), 1);
  const creatorToken = room.seats.keys().next().value;
  rooms.set(room.code, room);
  room.expirationTimer = setTimeout(() => {
    closeRoom(room, 'roomExpired');
  }, reservationTimeoutMs);
  room.expirationTimer.unref();
  console.log(`Room ${room.code} created`);

  return { room, creatorToken };
}

function attachRoomClient(room, client, playerNumber) {
  room.connectedPlayers.add(playerNumber);
  room.clients.set(playerNumber, client);
  client._socket.setNoDelay(true);

  client.send(JSON.stringify({
    type: 'joined',
    roomCode: room.code,
    playerNumber,
    playerCount: room.connectedPlayers.size
  }));

  if (room.connectedPlayers.size === 2) {
    clearTimeout(room.expirationTimer);
  }
  sendToRoom(room, { type: 'playerJoined', playerCount: room.connectedPlayers.size });

  client.on('message', (message) => {
    try {
      const request = JSON.parse(message.toString());
      if (request.type === 'leave') {
        closeRoom(room, 'playerLeft');
      } else if (
        request.type === 'input' &&
        request.input &&
        typeof request.input === 'object' &&
        !Array.isArray(request.input)
      ) {
        const inputSize = Buffer.byteLength(JSON.stringify(request.input), 'utf8');
        if (inputSize > 2048) {
          client.send(JSON.stringify({ type: 'error', message: 'Input payload is too large.' }));
          return;
        }

        const now = Date.now();
        let rate = room.inputRates.get(playerNumber);
        if (!rate || now - rate.startedAt >= 1000) {
          rate = { startedAt: now, count: 0 };
          room.inputRates.set(playerNumber, rate);
        }
        if (rate.count >= 120) {
          client.send(JSON.stringify({ type: 'error', message: 'Input message rate exceeded.' }));
          return;
        }
        rate.count += 1;

        const opponent = room.clients.get(playerNumber === 1 ? 2 : 1);
        if (opponent && opponent.readyState === WebSocket.OPEN) {
          opponent.send(JSON.stringify({
            type: 'remoteInput',
            playerNumber,
            input: request.input
          }));
        }
      }
    } catch (error) {
      console.error(`Invalid room message in ${room.code}:`, error.message);
    }
  });

  client.on('error', (error) => {
    console.error(`Room ${room.code} WebSocket error:`, error.message);
  });

  client.on('close', () => {
    if (!room.closed) {
      closeRoom(room, 'playerDisconnected');
    }
  });
}

const cameraSockets = new WebSocket.Server({ noServer: true });
const browserSockets = new WebSocket.Server({ noServer: true });
const roomSockets = new WebSocket.Server({ noServer: true, maxPayload: 4096 });

cameraSockets.on('connection', (ws) => {
  ws._socket.setNoDelay(true);
  ws.on('message', (message) => {
    browserSockets.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});

browserSockets.on('connection', (ws) => {
  ws._socket.setNoDelay(true);
  ws.on('message', (message) => {
    console.log('received wss2: %s', message);
  });
});

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url, 'http://localhost');
  const pathname = requestUrl.pathname;

  if (pathname === '/room') {
    const token = requestUrl.searchParams.get('seat');
    const room = [...rooms.values()].find((candidate) => candidate.seats.has(token));
    const playerNumber = room && room.seats.get(token);

    if (!room || room.closed || room.connectedPlayers.has(playerNumber)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    roomSockets.handleUpgrade(request, socket, head, (client) => {
      attachRoomClient(room, client, playerNumber);
    });
  } else if (pathname === '/server') {
    cameraSockets.handleUpgrade(request, socket, head, (ws) => {
      cameraSockets.emit('connection', ws, request);
    });
  } else if (pathname === '/client') {
    browserSockets.handleUpgrade(request, socket, head, (ws) => {
      browserSockets.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/api/rooms', (req, res) => {
  const availableRooms = [...rooms.values()]
    .filter((room) => !room.closed && room.seats.size === 1)
    .map((room) => ({
      code: room.code,
      createdAt: room.createdAt
    }));
  res.json(availableRooms);
});

app.post('/api/rooms', async (req, res) => {
  try {
    const { room, creatorToken } = await allocateRoom();
    res.status(201).json({
      code: room.code,
      playerNumber: 1,
      url: makeRoomUrl(req, room, creatorToken)
    });
  } catch (error) {
    console.error('Could not create room:', error.message);
    res.status(503).json({ error: error.message });
  }
});

app.post('/api/rooms/:code/join', (req, res) => {
  const room = rooms.get(String(req.params.code).toUpperCase());
  if (!room || room.closed || room.seats.size !== 1) {
    res.status(404).json({ error: 'That room is not available.' });
    return;
  }

  const playerToken = createToken();
  room.seats.set(playerToken, 2);
  res.json({
    code: room.code,
    playerNumber: 2,
    url: makeRoomUrl(req, room, playerToken)
  });
});

app.get('/numberofclients', (req, res) => {
  res.type('text/plain').send(browserSockets.clients.size.toString());
});

app.get('/', (req, res) => {
  res.sendFile(path.join(lobbyDirectory, 'start.html'));
});

app.get('/multiplayer', (req, res) => {
  res.sendFile(path.join(lobbyDirectory, 'lobby.html'));
});

app.get('/game', (req, res) => {
  res.redirect(302, '/index.html?local=1');
});

app.use('/WebAssets', express.static(webAssetsDirectory));
app.use(express.static(buildDirectory, staticOptions()));

server.listen(port, '0.0.0.0', () => {
  console.log(`Lobby listening on port ${port}`);
  console.log(`Maximum active rooms: ${maxRooms}`);
});

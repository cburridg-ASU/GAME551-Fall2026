# Multiplayer server

## Run the server

```bash
npm install
npm start
```

The lobby and all multiplayer rooms share one listener on `PORT` (default
`8080`). Room pages and WebSocket traffic are routed by seat token on that same
port. `MAX_ROOMS` (default `20`) sets the maximum number of active rooms.

## AWS network setup

The EC2 security group only needs inbound TCP `8080` (or the configured
`PORT`). If the instance uses UFW, allow that port too:

```bash
sudo ufw allow 8080/tcp
sudo ufw status
```

Only allow these from `0.0.0.0/0` if the game should be public; otherwise use
the players' source IP ranges. Check any network ACLs as well. If `PORT` is
changed, update both the security group and host firewall to match. If a
reverse proxy is in front of Node, it must forward WebSocket upgrades for
`/room` as well as normal HTTP requests.

To diagnose a room that times out:

1. On the EC2 instance, confirm the server log says `Room <code> created`.
2. Confirm Node is listening on `0.0.0.0:8080` with `sudo ss -ltnp`.
3. Check `curl -I http://127.0.0.1:8080/` locally and test the public lobby.
   The same host and port carry game pages and room WebSockets.

Rooms do not open or reserve separate TCP ports. An unfilled room expires
after five minutes. Room state is in memory, so restarting the Node server
closes every active room.

## Unity WebGL input integration

The room server currently assigns Player 1 and Player 2 and relays small input
messages. The WebGL page exposes this JavaScript API:

```javascript
CWOWDRoom.getPlayerNumber()
CWOWDRoom.sendInput({ moveX: 0.5, moveY: 0, buttons: ["attack"] })
CWOWDRoom.onInput((playerNumber, input) => {
  // Apply this remote player's input to the matching in-game character.
})
```

`sendInput` sends the local player's controls to the other client. The receiver
gets the sender's assigned player number with the input. Messages are limited
to 2 KB and 120 per second per player. The updated WebGL framework includes
Unity `OnlineBridge` hooks for checking bridge availability, reading the
assigned player number, sending local input, and polling remote input. The
browser wrapper provides the `CWOWDRoom` API those hooks call. In local mode,
the room API is intentionally absent so the Unity bridge reports offline.

The compiled build contains these integration hooks, but this repository does
not include the Unity project source. Verify in-game that the Unity controller
uses the received state for the opponent, assigns the correct player controls,
and handles disconnects, reconnects, simultaneous input, keyboard, and USB
controllers. Having the bridge and room transport present does not by itself
prove that every control mapping behaves as intended.

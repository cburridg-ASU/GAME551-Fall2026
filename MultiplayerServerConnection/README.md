# Multiplayer server

## Run the server

```bash
npm install
npm start
```

The lobby listens on `PORT` (default `8080`). Each room gets a dedicated TCP
port from `ROOM_PORT_START` (default `8100`) through the configured count
(default `ROOM_PORT_COUNT=20`, ending at `8119`).

## AWS network setup

The lobby works on port `8080`, but each player is redirected to a separate
room port. The EC2 security group must allow inbound TCP `8080` **and**
`8100-8119`. If the instance uses UFW, allow those ports there too:

```bash
sudo ufw allow 8080/tcp
sudo ufw allow 8100:8119/tcp
sudo ufw status
```

Only allow these from `0.0.0.0/0` if the game should be public; otherwise use
the players' source IP ranges. Check any network ACLs as well. If the port
range is changed with `ROOM_PORT_START` or `ROOM_PORT_COUNT`, update both the
security group and host firewall to match.

To diagnose a room that times out:

1. On the EC2 instance, confirm the server log says `Room <code> created on port <port>`.
2. On the instance, run `sudo ss -ltnp` and confirm Node is listening on that
   room port on `0.0.0.0`, not just `127.0.0.1`.
3. From a different computer, run `nc -vz ec2-107-23-134-213.compute-1.amazonaws.com <room-port>`.
   A timeout usually means the security group, network ACL, or host firewall is
   dropping the connection. `ECONNREFUSED` usually means nothing is listening
   on that port or the room has closed.
4. Confirm players use the public hostname and the exact port from the room
   URL, not `localhost`.

The room ports are released when a player leaves or disconnects. An unfilled
room expires after five minutes. Room state is in memory, so restarting the
Node server closes every active room.

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

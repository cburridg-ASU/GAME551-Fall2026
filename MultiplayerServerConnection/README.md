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
to 2 KB and 120 per second per player. This transport does **not** make the
game react to remote controls by itself; the Unity project must read the local
controls, call the API, and apply remote controls to the correct character.

To finish the WebGL integration:

1. Open the Unity project that produces this build and add a persistent
   `NetworkInputBridge` GameObject/script.
2. In a WebGL `.jslib` plugin, call `window.CWOWDRoom.sendInput(...)` for
   local keyboard/controller state and subscribe with
   `window.CWOWDRoom.onInput(...)` for remote input. Pass messages between
   the plugin and C# with Unity's `SendMessage` or a supported callback
   mechanism.
3. Have the bridge query `getPlayerNumber()` and assign local and remote
   controls to the correct player objects. Keep the existing USB/controller
   input local to each player's browser; transmit normalized button/axis
   state, not hardware device objects.
4. Test disconnects, reconnects, simultaneous controls, and both keyboard and
   USB controllers. Then rebuild WebGL and replace `FightingBuild`.

The Unity project source is not in this repository, so the bridge cannot be
completed or compiled here. Until that build-side work is done, both browsers
load their own game instance and remote input messages are not applied to
gameplay.

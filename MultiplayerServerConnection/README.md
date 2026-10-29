# Multiplayer server

Start the lobby and room server with:

```bash
npm install
npm start
```

The lobby listens on `PORT` (default `8080`). Each room gets its own TCP port.
The default range is `8100`-`8119`, allowing up to 20 simultaneous rooms.
Configure another range with `ROOM_PORT_START` and `ROOM_PORT_COUNT`.

In the EC2 security group, allow inbound TCP traffic to port `8080` and the
entire configured room-port range. Players open the lobby at the server's
public hostname and port. Room ports are released when a player leaves or
disconnects; an unfilled room expires after five minutes.

The current WebGL build supports room pairing and Player 1/Player 2 assignment
only. It does not synchronize game state or forward keyboard/controller input
between players. That requires Unity-side networking and a rebuilt WebGL
player.

# GoStyle MMO on AWS

This app is a static web page served by a small, dependency-free Node.js server.

## Quick test on an EC2 instance

1. Install Node.js 18 or newer if it is not already installed. For example:
   - Amazon Linux 2023: `sudo dnf install -y nodejs`
   - Ubuntu: `sudo apt update && sudo apt install -y nodejs npm`
2. Copy or clone this repository onto the instance, then enter this folder:

   ```sh
   cd GAME551-Fall2026/GoStyleMMO
   ```

3. Start the app:

   ```sh
   npm start
   ```

4. In the EC2 security group, temporarily allow inbound TCP port `3000` from
   your IP address. Visit `http://<EC2-public-IPv4>:3000` in a browser. Keep
   the SSH session open while testing; press Ctrl+C to stop the server.

The server also provides `http://<EC2-public-IPv4>:3000/health`, which returns
`ok` when it is running. No `npm install` is needed.

## GPS and HTTPS

Browsers only allow geolocation on a secure origin (HTTPS, or localhost).
The HTTP quick test can load the app, but GPS will be unavailable from the
instance's public IP address. The app's developer movement controls can still
be used for a basic test.

For GPS testing, use a domain whose DNS points to the EC2 instance, allow
inbound TCP ports `80` and `443` in the security group, and [install Caddy](https://caddyserver.com/docs/install).
Replace `your-domain.example` in [Caddyfile](./Caddyfile) with that domain,
then start each service in its own SSH session from this folder:

Node.js session:

```sh
HOST=127.0.0.1 npm start
```

Caddy session:

```sh
caddy run --config Caddyfile
```

Caddy will obtain and renew the HTTPS certificate automatically when the
domain resolves to the instance and ports `80` and `443` are reachable. Open
`https://your-domain.example` on the phone and allow location access.

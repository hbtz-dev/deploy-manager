# deploy-manager

mini continuous deployment and reverse proxy + virtual host

aka: get the most out of your free cloud vm instance

## Usage:
-   clone the repo
-   `npm install`, `npm build`
-   `npm run init` to generate `manageconfig.json`, workspace, and password info
-   `npm run start` to start the server. Must be in same directory as `manageconfig.json`.

The server exposes a _secure_ websocket endpoint on the active port (default 8080). It will clone, install, and build projects as specified in `data.json` in the workspace folder. If `proxy: true` is set in configuration, it also acts as a reverse proxy and redirects incoming traffic to local ports based on the hostname being accessed. This allows different projects to use the same public IP, and provides SSL encryption to projects being accessed in this way.

## Demo configuration:
Using `npm run init` with all default values will create a demo configuration that demonstrates the features. To test that everything is working:
- Run `npm run start` to start the server.
- - The server will listen and proxy traffic on port 8080 will download and launch three demo HTTP services on port 8000, 8001, and 8002.
- Navigate to `https://127.0.0.2:8080`. Because the SSL certificate is invalid, your browser will display a warning. Navigate past the warning and you will see your service saying hi through HTTPS from port 8000.
- Do the same for `https://127.0.0.3:8080` and `https://127.0.0.4:8080`.

## Customization:
- Configure your DNS records to direct your domain names to the server IP. 
- Replace the certificate paths with real certificate paths for your domain.
- Use port `443` to serve HTTPS web traffic.
- Remove the demo projects and replace them with your own projects.
- Reverse proxy from hosts such as `sub1.mydomain.com`, `sub2.mydomain.com` to your local projects.

## TODO:
-   tests
-   config file validation
-   automatic restarts / serverless mode
-   crash recovery
-   modify data remotely via client with atomic filewrite
-   init script taking args
-   use graphql
-   better incoming message validation (length)
-   cleaner server code
-   less mean socket handling (maybe)
-   meaner socket handling for invalid dispatch (maybe)
-   enable detach and if the manager restarts, reattach to orphaned children?
-   exec() refactor
-   find a way to graceful kill on windows (tree-kill can't send POSIX signals
    on windows)
-   webhooks
-   staging builds and tests

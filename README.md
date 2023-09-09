# deploy-manager

mini continuous deployment

aka: get the most out of your free cloud vm instance

## Usage:
-   clone the repo
-   `npm install`, `npm build`
-   `npm run init` to generate configuration file, workspace, and password info
-   `npm run start` to start the server. Must be in same directory as
    configuration file.

The server will automatically clone projects as specified in the workspace data
file, then run install and build scripts if they exist, then run the projects
and child processes. All child stdout/err is piped to the main process
stdout/err.

The server exposes a websocket endpoint at the config port (default: `8080`) to
remotely terminate running projects. Restarting a project will automatically
check for updates with `git pull`.

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
-   find a way to graceful kill on windows (tree-kill can't send POXIX signals
    on windows)
-   webhooks
-   staging builds and tests

import * as ws from "ws";
import { ManageConfig } from "./config";
import { Manager, ManagerReport } from "./manager";
import * as bcrypt from "bcrypt";

import https from "https";
import httpProxy from "http-proxy";
import { log } from "./log";

type AuthSchema = { type: "auth"; pw: string };

export const ACTIONS = {
    start: true,
    stop: true,
    restart: true,
    eradicate: true,
    kill: true
};
type Action = keyof typeof ACTIONS;
type ActionSchema = { type: Action; which: string };
type MessageSchema = AuthSchema | ActionSchema;

function decode(s: string) {
    try {
        const x = JSON.parse(s) as MessageSchema;
        if (x.type === "auth") {
            if (typeof x.pw !== "string") {
                return null;
            } else {
                return x;
            }
        } else if (ACTIONS[x.type]) {
            if (typeof x.which !== "string") {
                return null;
            } else {
                return x;
            }
        } else {
            return null;
        }
    } catch {
        return null;
    }
}

function tryAuth(s: string, hash: string) {
    return bcrypt.compare(s, hash);
}

export class Server {
    static MAX = 10;
    clients: Map<ws.WebSocket, boolean> = new Map();
    managers: Manager[];
    private passHash: string;
    server: https.Server;
    proxy: httpProxy;
    wss: ws.Server;
    sendReport(o: ManagerReport) {
        const s = JSON.stringify(o);
        for (const [ws, auth] of this.clients) {
            auth && ws.send(s);
        }
    }
    dispatch(o: ActionSchema) {
        const m = this.managers.find((m) => m.item.name === o.which);
        if (!m) {
            return false;
        }
        m[o.type]();
        return true;
    }
    onConnect(ws: ws.WebSocket) {
        log("client connected");
        if (this.clients.size >= Server.MAX) {
            ws.terminate();
            return;
        }
        this.clients.set(ws, false);
        const destroy = (reason: string = "") => {
            ws.terminate();
            this.clients.delete(ws);
            log(`destroyed connection - ${reason}`);
        };
        const doom = setTimeout(() => {
            this.clients.get(ws) == false && destroy("auth timeout");
        }, 5000);
        ws.on("message", async (data) => {
            const o = decode(data.toString());
            const authed = this.clients.get(ws);
            if (!o || (!authed && o.type !== "auth")) {
                destroy("invalid message/auth");
            } else if (o.type === "auth") {
                if (!authed && (await tryAuth(o.pw, this.passHash))) {
                    this.clients.set(ws, true);
                    clearTimeout(doom);
                    ws.send(
                        JSON.stringify(
                            this.managers.map((m) => m.generateReport(true))
                        )
                    );
                    this.clients.set(ws, true);
                } else {
                    destroy("bad auth");
                }
            } else {
                if (!this.dispatch(o)) {
                    destroy("bad dispatch");
                }
            }
        });
        ws.on("close", destroy);
    }
    constructor(
        config: ManageConfig,
        managers: Manager[],
        certinfo: { cert: string; key: string },
        passHash: string
    ) {
        this.passHash = passHash;
        this.managers = managers;

        const proxymap = {} as Record<string, number>;
        if (config.proxy) {
            for (const man of managers) {
                const p = man.item.proxy;
                if (p) {
                    proxymap[p.fromHost] = p.toPort;
                }
            }
        }

        this.proxy = httpProxy.createProxyServer();
        this.wss = new ws.Server({ noServer: true });
        this.server = https.createServer(certinfo, (req, res) => {
            // Get the subdomain from the host header
            const host = req.headers.host;

            if (host && host in proxymap) {
                //log(`https proxy hit ${host}`, "PROXY");
                const target = `http://localhost:${proxymap[host]}`;
                this.proxy.web(req, res, { target }, () => {
                    res.writeHead(503, { "Content-Type": "text/plain" });
                    res.end();
                });
            } else {
                //log(`https proxy missed ${host}`, "PROXY");
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end();
            }
        });

        this.server.on("upgrade", (req, socket, head) => {
            console.log();
            const host = req.headers.host;
            if (host && host in proxymap) {
                //log(`wss proxy hit ${host}`, "PROXY");
                const target = `http://localhost:${proxymap[host]}`;
                this.proxy.ws(req, socket, head, { target }, () => {
                    socket.destroy();
                });
            } else {
                if (this.clients.size >= Server.MAX) {
                    socket.destroy();
                } else {
                    //log(`wss proxy missed ${host}`, "PROXY");
                    this.wss.handleUpgrade(req, socket, head, (ws) =>
                        this.onConnect(ws)
                    );
                }
            }
        });
    }
}

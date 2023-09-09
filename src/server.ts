import { WebSocketServer, WebSocket } from "ws";
import { ManageConfig } from "./config";
import { Manager, ManagerReport } from "./manager";
import * as bcrypt from "bcrypt";
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
    wss: WebSocketServer;
    clients: Map<WebSocket, boolean> = new Map();
    managers: Manager[];
    private passHash: string;
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
    kill() {
        this.wss.close();
    }
    constructor(config: ManageConfig, managers: Manager[], passHash: string) {
        this.passHash = passHash;
        this.wss = new WebSocketServer({ port: config.port });
        this.managers = managers;
        this.wss.on("connection", (ws) => {
            if (this.clients.size >= Server.MAX) {
                ws.terminate();
            } else {
                this.clients.set(ws, false);
                const destroy = () => {
                    ws.terminate();
                    this.clients.delete(ws);
                };
                const doom = setTimeout(() => {
                    this.clients.get(ws) == false && destroy();
                });
                ws.on("message", async (data) => {
                    const o = decode(data.toString());
                    const authed = this.clients.get(ws);
                    if (!o || (!authed && o.type !== "auth")) {
                        destroy();
                    } else if (o.type === "auth") {
                        if (!authed && (await tryAuth(o.pw, this.passHash))) {
                            this.clients.set(ws, true);
                            clearTimeout(doom);
                            ws.send(
                                JSON.stringify({
                                    items: managers.map((m) => m.item.name),
                                    data: managers.map((m) =>
                                        m.generateReport()
                                    )
                                })
                            );
                            this.clients.set(ws, true);
                        } else {
                            destroy();
                        }
                    } else {
                        if (!this.dispatch(o)) {
                            destroy();
                        }
                    }
                });
                ws.on("close", destroy);
            }
        });
        log(`listening on ${config.port}`);
    }
}

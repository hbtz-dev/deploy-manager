import { ManagedItem } from "./config";
import { exec } from "./util";
import { prepareProject } from ".";
import * as fs from "fs/promises";
import * as path from "path";

export type ProjectStatus =
    | "ok"
    | "terminated"
    | "starting"
    | "stopping"
    | "failed"
    | "crashed"
    | "killed";
export type ManagerReport = {
    name: string;
    status: ProjectStatus;
    detail: string;
};
export class Manager {
    item: ManagedItem;
    workspacePath: string;
    detail: string = "";
    result: [string | number, string] = [0, "not started"];
    lock: boolean = false;
    runtime: {
        stdin: (s: string) => void;
        kill: (s: NodeJS.Signals) => void;
    } | null = null;
    tryAgain: boolean = false;

    report: (r: ManagerReport) => void = () => {};
    get stopped() {
        return (
            this.status === "terminated" ||
            this.status === "crashed" ||
            this.status === "failed" ||
            this.status === "killed"
        );
    }
    get status(): ProjectStatus {
        if (this.runtime) {
            return this.lock ? "stopping" : "ok";
        } else {
            if (this.lock) {
                return "starting";
            } else {
                const code = this.result[0];
                if (typeof code === "number") {
                    return code === 0 ? "terminated" : "crashed";
                } else {
                    return code === "failed" ? "failed" : "killed";
                }
            }
        }
    }
    generateReport() {
        return {
            name: this.item.name,
            status: this.status,
            detail: this.detail
        };
    }
    signalUpdate(newDetail?: string, newCode?: string | number) {
        if (newDetail) {
            this.detail = newDetail;
        }
        if (newCode !== undefined) {
            this.result[0] = newCode;
        }
        this.report(this.generateReport());
    }
    async handleStop(arg: [string | number, string]) {
        this.runtime = null;
        this.lock = false;
        this.result = arg;
        this.signalUpdate(`${arg[0]} | ${arg[1]}`);
        if (this.tryAgain) {
            this.tryAgain = false;
            this.start();
        }
    }

    async eradicate() {
        if (this.stopped) {
            this.lock = true;
            await fs.rm(path.join(this.workspacePath, this.item.name), {
                recursive: true,
                force: true
            });
            this.lock = false;
        }
    }

    restart() {
        this.tryAgain = true;
        this.stop();
    }
    kill() {
        this.stop(true);
    }
    stop(force = false) {
        if (this.runtime) {
            if (force) {
                this.lock = true;
                this.runtime.kill("SIGKILL");
                this.signalUpdate("sent SIGKILL, waiting for forced shutdown");
                return true;
            } else if (!this.lock) {
                this.lock = true;
                this.runtime.kill("SIGTERM");
                this.signalUpdate(
                    "sent SIGTERM, waiting for graceful shutdown"
                );
                return true;
            }
            return false;
        } else {
            return false;
        }
    }

    async start() {
        if (this.stopped) {
            this.lock = true;
            let fail = "";
            const projPath = await prepareProject(
                this.item,
                this.workspacePath,
                (s) => this.signalUpdate(s)
            ).catch((e) => ((fail = `${e}`), null));
            if (!projPath) {
                this.lock = false;
                this.signalUpdate(fail, "failed");
                return false;
            }
            const proc = exec(
                this.item.start,
                { cwd: projPath, env: { ...process.env, ...this.item.env } },
                this.item.name
            );
            this.runtime = proc;
            if (!proc) {
                this.lock = false;
                this.signalUpdate("process failed to start", "failed");
                return false;
            } else {
                proc.then((v) => this.handleStop(v));
                this.lock = false;
                this.signalUpdate("running");
                return true;
            }
        } else {
            return false;
        }
    }
    constructor(item: ManagedItem, workspacePath: string) {
        this.item = item;
        this.workspacePath = workspacePath;
    }
}

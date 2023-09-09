import { SpawnOptionsWithoutStdio, spawn } from "child_process";
import { log } from "./log";
import * as fs from "fs/promises";
import pkill from "tree-kill";

export function exec(
    s: string,
    opts: SpawnOptionsWithoutStdio = {},
    logPrefix: string = ""
):
    | null
    | (Promise<[string | number, string]> & {
          stdin: (s: string) => void;
          kill: (s?: NodeJS.Signals) => void;
      }) {
    const proc = spawn(s, [], {
        ...opts,
        ...{ /**stdio: 'ignore',**/ shell: true, detached: false }
    });
    const pid = proc.pid;
    if (!pid) {
        return null;
    }
    return Object.assign(
        new Promise(
            (resolve: (value: [number | string, string]) => void, reject) => {
                let comment = "";
                proc.stdout.on("data", (data) => {
                    data = `${data}`.trim();
                    log(`stdout: ${data}`, logPrefix);
                    comment = `${data}`;
                });

                proc.stderr.on("data", (data) => {
                    data = `${data}`.trim();
                    log(`stderr: ${data}`, logPrefix);
                    comment = `${data}`;
                });
                proc.on("close", (code, sig) => {
                    if (code !== null) {
                        log(`exited with code ${code}`, logPrefix);
                        resolve([code, comment]);
                    } else if (sig !== null) {
                        log(`killed by signal ${sig}`, logPrefix);
                        resolve([sig, comment]);
                    } else {
                        reject(
                            new Error(
                                "exec terminated without code OR signal... what?"
                            )
                        );
                    }
                });
            }
        ),
        {
            stdin: (s: string) => proc.stdin.emit("data", s),
            kill: (s: NodeJS.Signals = "SIGTERM") => pkill(pid, s)
        }
    );
}

export async function checkExistsDir(dir: string) {
    const projdir = await fs.opendir(dir).catch(() => null);
    if (projdir) {
        await projdir.close();
        return true;
    } else {
        return false;
    }
}
export async function readFileOrWriteDefault(path: string, data: string = "") {
    const ret = await fs.readFile(path, "utf-8").catch(() => null);
    if (!ret) {
        await fs.writeFile(path, data);
        return data;
    }
    return ret;
}

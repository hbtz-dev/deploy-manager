import * as fs from "fs/promises";
import * as path from "path";
import { ManageConfig, ManageData, ManagedItem } from "./config";
import { exec, checkExistsDir, readFileOrWriteDefault } from "./util";
import { log } from "./log";
import { Server } from "./server";
import { Manager } from "./manager";

export async function prepareProject(
    item: ManagedItem,
    workspacePath: string = ".",
    signal: (s: string) => void = () => {}
) {
    const projPath = path.join(workspacePath, item.name);
    let needsClone: boolean = !(await checkExistsDir(projPath));
    let needsInstall: boolean = true;
    if (!needsClone) {
        //project already exists; pull.
        signal("updating...");
        log(`checking for updates on project ${item.name}`);
        const res = await exec(`git pull`, { cwd: projPath }, item.name);
        if (!res) {
            throw new Error(`git clone err: could not execute`);
        }
        const [err, comment] = res;
        if (err) {
            log(
                `git pull failed; destroying project ${item.name} and recloning`
            );
            await fs.rm(projPath, { recursive: true, force: true });
            needsClone = true;
        } else {
            if (comment.includes("Already up to date.")) {
                log(`project ${item.name} is up to date; skipping reinstall`);
                needsInstall = false;
            } else {
                log(`${item.name} updated`);
            }
        }
    }
    if (needsClone) {
        //project doesnt exist yet; clone.
        log(`cloning project ${item.name}`);
        const res = await exec(
            `git clone ${item.repo} ${item.name}`,
            { cwd: workspacePath },
            item.name
        );
        if (!res) {
            throw new Error(`git clone err: could not execute`);
        } else if (res[0]) {
            throw new Error(`git clone err: ${res[0]} ${res[1]}`);
        }
    }
    if (needsInstall) {
        if (item.install) {
            signal("installing...");
            log(`installing project ${item.name}`);
            const res = await exec(item.install, { cwd: projPath }, item.name);
            if (!res) {
                throw new Error(`install err: could not execute`);
            } else if (res[0]) {
                throw new Error(`install err: ${res[0]} ${res[1]}`);
            }
        }
        if (item.build) {
            signal("building...");
            log(`building project ${item.name}`);
            const res = await exec(item.build, { cwd: projPath }, item.name);
            if (!res) {
                throw new Error(`build err: could not execute`);
            } else if (res[0]) {
                throw new Error(`build err: ${res[0]} ${res[1]}`);
            }
        }
    }
    log(`project ${item.name} is ready`);

    return projPath;
}

async function readAndValidateConfig(
    path: string
): Promise<ManageConfig | null> {
    //TODO: implement the validation part
    return JSON.parse(await fs.readFile(path, { encoding: "utf-8" }));
}

async function startUp() {
    const config = await readAndValidateConfig("manageconfig.json").catch(
        () => {
            throw Error(
                "could not find manageconfig.json file; try npm run init"
            );
        }
    );
    if (!config) {
        throw Error("could not parse config file");
    }
    if (!(await checkExistsDir(config.workspacePath))) {
        log("creating workspace folder");
        await fs.mkdir(config.workspacePath);
    }

    const dataJSON = await readFileOrWriteDefault(
        path.join(config.workspacePath, "data.json"),
        "[]"
    );
    //TODO: sanitize this
    const data = JSON.parse(dataJSON) as ManageData;
    const managers = data.map(
        (datum) => new Manager(datum, config.workspacePath)
    );

    for (const man of managers) {
        man.report = (o) => console.log(o);
    }
    if (config.autostart) {
        for (const man of managers) {
            man.start();
        }
    }
    const passHash = (
        await fs.readFile(config.passHashPath).catch(() => null)
    )?.toString();
    if (passHash) {
        const serv = new Server(config, managers, passHash);
        const report = serv.sendReport.bind(serv);
        for (const man of managers) {
            man.report = report;
        }
    } else {
        log("WARNING: password hash not found, server not started");
    }
    // process.on("SIGINT", () => {
    //     serv.kill();
    // });
    // process.on("SIGTERM", () => {
    //     serv.kill();
    // })
}

startUp();

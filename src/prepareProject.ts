import * as fs from "fs/promises";
import * as path from "path";
import { ManagedItem } from "./config";
import { exec, checkExistsDir } from "./util";
import { log } from "./log";

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
            const res = await exec(
                item.install,
                { cwd: projPath, env: { ...process.env, ...item.env } },
                item.name
            );
            if (!res) {
                throw new Error(`install err: could not execute`);
            } else if (res[0]) {
                throw new Error(`install err: ${res[0]} ${res[1]}`);
            }
        }
        if (item.build) {
            signal("building...");
            log(`building project ${item.name}`);
            const res = await exec(
                item.build,
                { cwd: projPath, env: { ...process.env, ...item.env } },
                item.name
            );
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

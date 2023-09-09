import * as fs from "fs/promises";
import * as readline from "readline";
import { Writable } from "stream";
import path from "path";
import { hash } from "bcrypt";
import js_beautify from "js-beautify";

import { ManageConfig } from "./config";
import { checkExistsDir } from "./util";

const SAMPLE_DATA = JSON.stringify([
    {
        name: "sample",
        repo: "https://github.com/hbtz-dev/demo-server",
        install: "npm install",
        build: "npm run build",
        start: "npm run start",
        env: {
            PORT: "8000"
        }
    }
]);

let SUPPRESS_ECHO = false;
const rl = readline.createInterface({
    input: process.stdin,
    output: new Writable({
        write: function (chunk, encoding, cb) {
            if (!SUPPRESS_ECHO) {
                process.stdout.write(chunk, encoding);
            }
            cb();
        }
    }),
    terminal: true
});

function input(
    query: string,
    def: string = "",
    password: boolean = false
): Promise<string> {
    return new Promise((resolve) => {
        SUPPRESS_ECHO = password;
        rl.question(`${query} `, (response) => {
            SUPPRESS_ECHO = false;
            if (!password) {
                response = response.trim();
            }
            resolve(response.length ? response : def);
        });
    });
}

async function main() {
    const passHashPath = await input(
        "password info path: (./.managepass)",
        "./.managepass"
    );
    const workspacePath = await input(
        "workspace path: (./workspace)",
        "./workspace"
    );
    const autostart = (await input("run everything on start? (yes)", "yes"))
        .toLowerCase()
        .startsWith("y");
    let port = NaN;
    while (Number.isNaN(port)) {
        port = parseInt(await input("socket port? (8080)", "8080"));
    }
    const config: ManageConfig = {
        passHashPath,
        workspacePath,
        autostart,
        port
    };
    const json = JSON.stringify(config);
    console.log(json);
    const ok = (await input("is this OK? (yes)", "yes"))
        .toLowerCase()
        .startsWith("y");
    if (!ok) {
        console.log("aborted");
        return;
    }

    await fs.writeFile("manageconfig.json", js_beautify(json));

    if (!(await checkExistsDir(config.workspacePath))) {
        const ok = (
            await input(
                "workspace doesn't exist, create sample data? (yes)",
                "yes"
            )
        )
            .toLowerCase()
            .startsWith("y");
        if (ok) {
            await fs.mkdir(config.workspacePath);
            await fs.writeFile(
                path.join(config.workspacePath, "data.json"),
                js_beautify(SAMPLE_DATA)
            );
        }
    }

    let pw = "";
    // eslint-disable-next-line no-constant-condition
    while (true) {
        console.log("set password:");
        pw = await input("", "", true);
        if (pw.length < 8) {
            console.log("password must be 8 digits or more");
            continue;
        }
        console.log("confirm password:");
        if ((await input("", "", true)) === pw) {
            break;
        }
        console.log("passwords do not match");
    }
    const pwhash = await hash(pw, 10);
    await fs.writeFile(passHashPath, pwhash);
    rl.close();
}
main();

import * as fs from "fs/promises";
import * as readline from "readline";
import { Writable } from "stream";
import path from "path";
import { hash } from "bcrypt";
import js_beautify from "js-beautify";

import { ManageConfig, ManageData } from "./config";
import { readFileOrWriteDefault } from "./util";

const SAMPLE_DATA = JSON.stringify([
    {
        name: "sample1",
        repo: "https://github.com/hbtz-dev/demo-server",
        install: "npm install",
        build: "npm run build",
        start: "npm run start",
        env: {
            PORT: "8000",
            MESSAGE: "Hello 127.0.0.2:8080 from port 8000!"
        },
        proxy: {
            fromHost: "127.0.0.2:8080",
            toPort: 8000
        }
    },
    {
        name: "sample2",
        repo: "https://github.com/hbtz-dev/demo-server",
        install: "npm install",
        build: "npm run build",
        start: "npm run start",
        env: {
            PORT: "8001",
            MESSAGE: "Hello 127.0.0.3:8080 from port 8001!"
        },
        proxy: {
            fromHost: "127.0.0.3:8080",
            toPort: 8001
        }
    },
    {
        name: "sample3",
        repo: "https://github.com/hbtz-dev/demo-server",
        install: "npm install",
        build: "npm run build",
        start: "npm run start",
        env: {
            PORT: "8002",
            MESSAGE: "Hello 127.0.0.4:8080 from port 8002!"
        },
        proxy: {
            fromHost: "127.0.0.4:8080",
            toPort: 8002
        }
    }
] as ManageData);

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
    const cert = {
        cert: await input(
            "ssl certificate .pem? (dummy/cert.pem)",
            "dummy/cert.pem"
        ),
        key: await input(
            "ssl certificate .key? (dummy/cert.key)",
            "dummy/cert.key"
        )
    };
    let port = NaN;
    while (Number.isNaN(port)) {
        port = parseInt(await input("socket port? (8080)", "8080"));
    }
    const proxy = (await input("act as reverse proxy? (yes)", "yes"))
        .toLowerCase()
        .startsWith("y");
    const workspacePath = await input(
        "workspace path: (./workspace)",
        "./workspace"
    );
    const autostart = (await input("run everything on start? (yes)", "yes"))
        .toLowerCase()
        .startsWith("y");

    const config: ManageConfig = {
        cert,
        port,
        proxy,
        workspacePath,
        autostart
    };
    const json = js_beautify(JSON.stringify(config));
    console.log(json);
    const ok = (await input("is this OK? (yes)", "yes"))
        .toLowerCase()
        .startsWith("y");
    if (!ok) {
        console.log("aborted");
        return;
    }

    await fs.writeFile("manageconfig.json", json);
    await fs.mkdir(config.workspacePath, { recursive: true });

    await readFileOrWriteDefault(
        path.join(config.workspacePath, "data.json"),
        js_beautify(SAMPLE_DATA)
    );

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
    await fs.writeFile(path.join(workspacePath, ".passhash"), pwhash);
    rl.close();
}
main();

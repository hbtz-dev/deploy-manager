import * as fs from "fs/promises";
import * as path from "path";
import { ManageConfig, ManageData } from "./config";
import { checkExistsDir, readFileOrWriteDefault } from "./util";
import { log } from "./log";
import { Server } from "./server";
import { Manager } from "./manager";
import { DUMMY_CERT } from "./dummycert";

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
    const cert = await fs.readFile(config.cert.cert, "utf8").catch(() => null);
    const key = await fs.readFile(config.cert.key, "utf8").catch(() => null);

    const certinfo = cert && key ? { cert, key } : DUMMY_CERT;
    if (certinfo === DUMMY_CERT) {
        log(
            "WARN: SSL certificates not found, using dummy certs. Add the correct certificate paths to manageconfig.json"
        );
    }
    const passHash = await fs.readFile(
        path.join(config.workspacePath, ".passhash"),
        "utf8"
    );

    const serv = new Server(config, managers, certinfo, passHash);
    const report = serv.sendReport.bind(serv);
    for (const man of managers) {
        man.report = report;
    }
    serv.server.listen(config.port);
    log(`listening on ${config.port}`);
    if (config.autostart) {
        for (const man of managers) {
            man.start();
        }
    }
}

startUp();

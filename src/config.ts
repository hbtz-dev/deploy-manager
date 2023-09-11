export type ManagedItem = {
    name: string;
    repo: string;
    install?: string;
    build?: string;
    start: string;
    env?: Record<string, string>;
    proxy?: { fromHost: string; toPort: number };
};

export type ManageData = ManagedItem[];

export type ManageConfig = {
    cert: { cert: string; key: string };
    port: number;
    proxy: boolean;
    workspacePath: string;
    autostart: boolean;
};

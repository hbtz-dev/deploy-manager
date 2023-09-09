export type ManagedItem = {
    name: string;
    repo: string;
    install?: string;
    build?: string;
    start: string;
    env?: Record<string, string>;
};

export type ManageData = ManagedItem[];

export type ManageConfig = {
    passHashPath: string;
    port: number;
    workspacePath: string;
    autostart: boolean;
};

declare const Hooks: {
    on: (hook: string, callback: (...args: any[]) => unknown) => number;
    once: (hook: string, callback: (...args: any[]) => unknown) => number;
};

declare const game: {
    user: {
        isGM: boolean;
    };
    i18n: {
        localize: (key: string) => string;
    };
    settings: {
        get: (namespace: string, key: string) => unknown;
        register: (namespace: string, key: string, data: Record<string, unknown>) => void;
    };
};

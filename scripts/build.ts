import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(projectRoot, "src");
const distRoot = resolve(projectRoot, "dist", "encounter-visibility");
const tscPath = resolve(projectRoot, "node_modules", "typescript", "bin", "tsc");
const staticEntries = [
    "module.json",
    "templates",
    "styles",
    "languages",
    "images",
];

assertDependency("typescript", tscPath);
clean();
compileScripts();
copyStaticAssets();

function clean(): void {
    rmSync(distRoot, { recursive: true, force: true });
    mkdirSync(distRoot, { recursive: true });
}

function compileScripts(): void {
    execFileSync(process.execPath, [tscPath, "--project", resolve(projectRoot, "tsconfig.build.json")], {
        cwd: projectRoot,
        stdio: "inherit",
    });
}

function copyStaticAssets(): void {
    for (const entry of staticEntries) {
        const source = resolve(sourceRoot, entry);
        if (!existsSync(source)) throw new Error(`Missing required source asset: ${entry}`);
        cpSync(source, resolve(distRoot, entry), { recursive: true });
    }
}

function assertDependency(name: string, binPath: string): void {
    if (existsSync(binPath)) return;
    throw new Error(`Build dependency "${name}" is missing. Run npm install, then npm run build.`);
}

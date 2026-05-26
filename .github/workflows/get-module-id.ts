/// <reference types="node" />

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readModuleId(moduleJsonPath: string): string {
  const moduleJson = JSON.parse(readFileSync(moduleJsonPath, "utf8")) as {
    id?: unknown;
  };

  if (typeof moduleJson.id !== "string" || moduleJson.id.length === 0) {
    throw new Error(`${moduleJsonPath} is missing a valid id string.`);
  }

  return moduleJson.id;
}

const moduleJsonPath = process.argv[2] ? resolve(process.argv[2]) : resolve("src/module.json");
console.log(readModuleId(moduleJsonPath));

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, test, vi } from "vitest";

type HookCallback = (...args: any[]) => unknown;

const runtime = globalThis as typeof globalThis & {
  Hooks?: {
    on: (hook: string, callback: HookCallback) => number;
    once: (hook: string, callback: HookCallback) => number;
  };
  game?: {
    user: { isGM: boolean };
    i18n: {
      localize: (key: string) => string;
    };
    settings: {
      get: (namespace: string, key: string) => unknown;
      register: (namespace: string, key: string, data: Record<string, unknown>) => void;
    };
  };
  document?: {
    createTextNode: (value: string) => { textContent: string };
  };
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  Reflect.deleteProperty(runtime, "Hooks");
  Reflect.deleteProperty(runtime, "game");
  Reflect.deleteProperty(runtime, "document");
});

function installFoundryMocks(isGM = true): {
  hookCallbacks: Map<string, HookCallback>;
  onceCallbacks: Map<string, HookCallback>;
  settingRegistrations: Array<{ namespace: string; key: string; data: Record<string, unknown> }>;
  settingValues: Map<string, unknown>;
} {
  const hookCallbacks = new Map<string, HookCallback>();
  const onceCallbacks = new Map<string, HookCallback>();
  const settingRegistrations: Array<{ namespace: string; key: string; data: Record<string, unknown> }> = [];
  const settingValues = new Map<string, unknown>();

  runtime.Hooks = {
    on: (hook: string, callback: HookCallback) => {
      hookCallbacks.set(hook, callback);
      return hookCallbacks.size;
    },
    once: (hook: string, callback: HookCallback) => {
      onceCallbacks.set(hook, callback);
      return onceCallbacks.size;
    }
  };

  runtime.game = {
    user: { isGM },
    i18n: {
      localize: (key: string) => key
    },
    settings: {
      get: (namespace: string, key: string) => settingValues.get(`${namespace}.${key}`),
      register: (namespace: string, key: string, data: Record<string, unknown>) => {
        settingRegistrations.push({ namespace, key, data });
      }
    }
  };

  runtime.document = {
    createTextNode: (value: string) => ({ textContent: value })
  };

  return { hookCallbacks, onceCallbacks, settingRegistrations, settingValues };
}

test("registers expected hooks and module settings", async () => {
  const mocks = installFoundryMocks(true);
  await import("../src/scripts/inverted-encounter-visibility.ts");

  assert.equal(typeof mocks.hookCallbacks.get("getCombatContextOptions"), "function");
  assert.equal(typeof mocks.hookCallbacks.get("getDocumentContextOptions"), "function");
  assert.equal(typeof mocks.hookCallbacks.get("combatStart"), "function");
  assert.equal(typeof mocks.hookCallbacks.get("renderApplicationV2"), "function");

  const initCallback = mocks.onceCallbacks.get("init");
  assert.equal(typeof initCallback, "function");
  initCallback?.();

  assert.equal(mocks.settingRegistrations.length, 2);
  assert.deepEqual(
    mocks.settingRegistrations.map((entry) => entry.key),
    ["encounterTitleGm", "encounterTitlePlayer"]
  );
});

test("adds show and hide options for combat tracker context menu", async () => {
  const mocks = installFoundryMocks(true);
  await import("../src/scripts/inverted-encounter-visibility.ts");

  const getCombatContextOptions = mocks.hookCallbacks.get("getCombatContextOptions");
  if (!getCombatContextOptions) throw new Error("Expected getCombatContextOptions hook callback");

  let visibilityFlag = false;
  const encounter = {
    getFlag: () => visibilityFlag,
    setFlag: (_scope: string, _key: string, value: unknown) => {
      visibilityFlag = Boolean(value);
    }
  };
  const application = {
    constructor: { name: "CombatTracker" },
    viewed: encounter
  };
  const options: Array<{ name: string; condition: () => boolean; callback: () => unknown }> = [];

  getCombatContextOptions(application, options);

  assert.equal(options.length, 2);
  const optionNames = options.map((option) => option.name);
  assert.deepEqual(optionNames, ["Show Encounter to Players", "Hide Encounter from Players"]);
  assert.equal(options[0]?.condition(), true);
  assert.equal(options[1]?.condition(), false);

  options[0]?.callback();
  assert.equal(visibilityFlag, true);
  assert.equal(options[0]?.condition(), false);
  assert.equal(options[1]?.condition(), true);
});

test("does not duplicate context options when both hooks fire", async () => {
  const mocks = installFoundryMocks(true);
  await import("../src/scripts/inverted-encounter-visibility.ts");

  const getCombatContextOptions = mocks.hookCallbacks.get("getCombatContextOptions");
  const getDocumentContextOptions = mocks.hookCallbacks.get("getDocumentContextOptions");
  if (!getCombatContextOptions || !getDocumentContextOptions) {
    throw new Error("Expected context option hook callbacks");
  }

  const encounter = {
    getFlag: () => false,
    setFlag: () => undefined
  };
  const application = {
    constructor: { name: "CombatTracker" },
    viewed: encounter
  };
  const options: Array<{ name: string; condition: () => boolean; callback: () => unknown }> = [];

  getCombatContextOptions(application, options);
  getDocumentContextOptions(application, options);

  assert.equal(options.length, 2);
  assert.deepEqual(
    options.map((option) => option.name),
    ["Show Encounter to Players", "Hide Encounter from Players"]
  );
});

test("hides encounter details for players on render when encounter is hidden", async () => {
  const mocks = installFoundryMocks(false);
  await import("../src/scripts/inverted-encounter-visibility.ts");

  mocks.settingValues.set("inverted-encounter-visibility.encounterTitlePlayer", "No Encounter");

  const renderApplication = mocks.hookCallbacks.get("renderApplicationV2");
  if (!renderApplication) throw new Error("Expected renderApplicationV2 hook callback");

  const encounterTitle = { textContent: "Original" };
  const encounterList = { innerHTML: "<li>combatant</li>" };
  const rootElement = {
    querySelector: (selector: string) => {
      if (selector === ".encounter-title") return encounterTitle;
      if (selector === "#combat-tracker") return encounterList;
      return null;
    }
  };
  const application = {
    constructor: { name: "CombatTracker" },
    viewed: { getFlag: () => false, setFlag: () => undefined }
  };

  renderApplication(application, rootElement);

  assert.equal(encounterTitle.textContent, "No Encounter");
  assert.equal(encounterList.innerHTML, "");
});

test("forces hidden encounters visible on combat start for GM", async () => {
  const mocks = installFoundryMocks(true);
  await import("../src/scripts/inverted-encounter-visibility.ts");

  const combatStart = mocks.hookCallbacks.get("combatStart");
  if (!combatStart) throw new Error("Expected combatStart hook callback");

  let finalFlag: unknown = false;
  const combat = {
    getFlag: () => false,
    setFlag: (_scope: string, _key: string, value: unknown) => {
      finalFlag = value;
      return undefined;
    }
  };

  combatStart(combat);

  assert.equal(finalFlag, true);
});

test("uses the same module id for flags as module.json", async () => {
  installFoundryMocks(true);
  const { EncounterVisibility } = await import("../src/scripts/inverted-encounter-visibility.ts");
  const moduleJsonPath = resolve(process.cwd(), "src", "module.json");
  const moduleJson = JSON.parse(readFileSync(moduleJsonPath, "utf8")) as { id?: unknown };

  assert.equal(typeof moduleJson.id, "string");
  assert.equal(EncounterVisibility.Id, moduleJson.id);
});

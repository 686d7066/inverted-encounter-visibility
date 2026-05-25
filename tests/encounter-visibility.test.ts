import assert from "node:assert/strict";
import { afterEach, beforeEach, test, vi } from "vitest";

type HookCallback = (...args: any[]) => unknown;

const runtime = globalThis as typeof globalThis & {
  Hooks?: {
    on: (hook: string, callback: HookCallback) => number;
    once: (hook: string, callback: HookCallback) => number;
  };
  game?: {
    user: { isGM: boolean };
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
  await import("../src/scripts/encounter-visibility.ts");

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
  await import("../src/scripts/encounter-visibility.ts");

  const getContextOptions = mocks.hookCallbacks.get("getDocumentContextOptions");
  if (!getContextOptions) throw new Error("Expected getDocumentContextOptions hook callback");

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

  getContextOptions(application, options);

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

test("hides encounter details for players on render when encounter is hidden", async () => {
  const mocks = installFoundryMocks(false);
  await import("../src/scripts/encounter-visibility.ts");

  mocks.settingValues.set("encounter-visibility.encounterTitlePlayer", "No Encounter");

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
  await import("../src/scripts/encounter-visibility.ts");

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

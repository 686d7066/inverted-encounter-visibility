import { EncounterVisibilitySettings } from "./settings.js";

type Encounter = {
    getFlag: (scope: string, key: string) => unknown;
    setFlag: (scope: string, key: string, value: unknown) => unknown;
};

type CombatTrackerApplication = {
    constructor?: { name?: string };
    tabName?: string;
    viewed?: Encounter | null;
};

type ContextMenuEntry = {
    callback: () => unknown;
    condition: () => boolean;
    icon: string;
    name: string;
};

export class EncounterVisibility {
    static Id = "inverted-encounter-visibility";
    static IsVisibleFlag = "isVisible";

    static log(...args: unknown[]): void {
        console.log(this.Id, "|", ...args);
    }
}

class EncounterVisibilityData {
    static setEncounterVisibility(encounter: Encounter | null, isVisible: boolean): unknown {
        return encounter?.setFlag(EncounterVisibility.Id, EncounterVisibility.IsVisibleFlag, isVisible);
    }

    static encounterIsVisible(encounter: Encounter | null): boolean {
        const isVisible = encounter?.getFlag(EncounterVisibility.Id, EncounterVisibility.IsVisibleFlag);
        return isVisible === true;
    }
}

function isCombatTrackerApplication(application: unknown): application is CombatTrackerApplication {
    const app = application as CombatTrackerApplication;
    return app?.constructor?.name === "CombatTracker" || app?.tabName === "combat";
}

function getViewedEncounter(application: CombatTrackerApplication): Encounter | null {
    return application.viewed ?? null;
}

function getEncounterTitleElement(element: Element): HTMLElement | null {
    return (
        element.querySelector(".encounter-title") ??
        element.querySelector(".encounter-controls h3") ??
        element.querySelector("h3.noborder")
    ) as HTMLElement | null;
}

function getEncounterListElement(element: Element): HTMLElement | null {
    return (
        element.querySelector("#combat-tracker") ??
        element.querySelector(".combat-tracker") ??
        element.querySelector(".directory-list")
    ) as HTMLElement | null;
}

Hooks.on("getDocumentContextOptions", (application: unknown, options: ContextMenuEntry[]) => {
    if (!isCombatTrackerApplication(application)) return;

    const showEncounterToPlayers: ContextMenuEntry = {
        callback: () => EncounterVisibilityData.setEncounterVisibility(getViewedEncounter(application), true),
        condition: () => {
            const encounter = getViewedEncounter(application);
            return game.user.isGM && !!encounter && !EncounterVisibilityData.encounterIsVisible(encounter);
        },
        icon: '<i class="fa-solid fa-eye"></i>',
        name: "Show Encounter to Players",
    };

    const hideEncounterFromPlayers: ContextMenuEntry = {
        callback: () => EncounterVisibilityData.setEncounterVisibility(getViewedEncounter(application), false),
        condition: () => {
            const encounter = getViewedEncounter(application);
            return game.user.isGM && !!encounter && EncounterVisibilityData.encounterIsVisible(encounter);
        },
        icon: '<i class="fa-solid fa-eye-slash"></i>',
        name: "Hide Encounter from Players",
    };

    options.unshift(hideEncounterFromPlayers);
    options.unshift(showEncounterToPlayers);
});

Hooks.on("combatStart", (combat: Encounter | null) => {
    if (!game.user.isGM || !combat) return;

    if (EncounterVisibilityData.encounterIsVisible(combat)) return;
    EncounterVisibilityData.setEncounterVisibility(combat, true);
});

Hooks.on("renderApplicationV2", (application: unknown, element: Element) => {
    if (!isCombatTrackerApplication(application)) return;

    const viewedEncounter = getViewedEncounter(application);
    if (!viewedEncounter) return;

    const shouldBeVisible = EncounterVisibilityData.encounterIsVisible(viewedEncounter);
    if (shouldBeVisible) return;

    const encounterTitle = getEncounterTitleElement(element);
    if (!encounterTitle) return;

    if (game.user.isGM) {
        const textToAppend = game.settings.get(EncounterVisibility.Id, EncounterVisibilitySettings.encounterTitleGmId);
        const hiddenFromPlayers = document.createTextNode(String(textToAppend));
        encounterTitle.appendChild(hiddenFromPlayers);
    } else {
        encounterTitle.textContent = String(game.settings.get(EncounterVisibility.Id, EncounterVisibilitySettings.encounterTitlePlayerId));
        const encounterList = getEncounterListElement(element);
        if (encounterList) encounterList.innerHTML = "";
    }
});

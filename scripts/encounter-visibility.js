import { EncounterVisibilitySettings } from "./settings.js";

export class EncounterVisibility {
    static Id = "encounter-visibility";
    static IsVisibleFlag = "isVisible";

    static log(...args) {
        console.log(this.Id, "|", ...args);
    }
}

class EncounterVisibilityData {
    static setEncounterVisibility(encounter, isVisible) {
        encounter?.setFlag(EncounterVisibility.Id, EncounterVisibility.IsVisibleFlag, isVisible);
    }

    static encounterIsVisible(encounter) {
        const isVisible = encounter.getFlag(EncounterVisibility.Id, EncounterVisibility.IsVisibleFlag);
        return isVisible == true || isVisible == undefined;
    }
}

Hooks.on("getCombatContextOptions", (combatTracker, options) => {
    const showEncounterToPlayers = {
        callback: () => EncounterVisibilityData.setEncounterVisibility(combatTracker.viewed, true),
        condition: () => game.user.isGM && !EncounterVisibilityData.encounterIsVisible(combatTracker.viewed),
        icon: '<i class="fa-solid fa-eye"></i>',
        name: "Show Encounter to Players",
    };

    const hideEncounterFromPlayers = {
        callback: () => EncounterVisibilityData.setEncounterVisibility(combatTracker.viewed, false),
        condition: () => game.user.isGM && EncounterVisibilityData.encounterIsVisible(combatTracker.viewed),
        icon: '<i class="fa-solid fa-eye-slash"></i>',
        name: "Hide Encounter from Players",
    };

    options.unshift(hideEncounterFromPlayers);
    options.unshift(showEncounterToPlayers);
});

Hooks.on("renderCombatTracker", (combatTracker, html, combatTrackerOptions, renderOptions) => {
    var shouldBeVisible = EncounterVisibilityData.encounterIsVisible(combatTracker.viewed);
    if (shouldBeVisible) return;

    const encounterTitle = html.querySelector(".encounter-title");

    if (game.user.isGM) {
        const textToAppend = game.settings.get(EncounterVisibility.Id, EncounterVisibilitySettings.encounterTitleGmId);
        const hiddenFromPlayers = document.createTextNode(textToAppend);
        encounterTitle.appendChild(hiddenFromPlayers);
    } else {
        encounterTitle.textContent = game.settings.get(EncounterVisibility.Id, EncounterVisibilitySettings.encounterTitlePlayerId);
        const encounterList = html.querySelector(".combat-tracker");
        encounterList.innerHTML = "";
    }
});

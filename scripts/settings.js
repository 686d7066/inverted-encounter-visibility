import { EncounterVisibility } from "./encounter-visibility.js";

export class EncounterVisibilitySettings {
    static encounterTitleGmId = "encounterTitleGm";
    static encounterTitlePlayerId = "encounterTitlePlayer";
}

Hooks.once("init", () => {
    game.settings.register(EncounterVisibility.Id, EncounterVisibilitySettings.encounterTitleGmId, {
        name: "Hidden Encounter Title append (for GM)",
        hint: "Text to append to the Encounter Title for the GM to show them an encounter is hidden.",
        scope: "world",
        config: true,
        requiresReload: false,
        type: String,
        default: "(Hidden)",
    });

    game.settings.register(EncounterVisibility.Id, EncounterVisibilitySettings.encounterTitlePlayerId, {
        name: "Hidden Encounter Title (for Players)",
        hint: "Text to show as the Encounter Title for players when the encounter is hidden from them.",
        scope: "world",
        config: true,
        requiresReload: false,
        type: String,
        default: "No Encounter",
    });
});

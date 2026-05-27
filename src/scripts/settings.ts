import { EncounterVisibility } from "./inverted-encounter-visibility.js";

export class EncounterVisibilitySettings {
    static encounterTitleGmId = "encounterTitleGm";
    static encounterTitlePlayerId = "encounterTitlePlayer";
}

function localize(key: string, fallback: string): string {
    const localized = game.i18n?.localize?.(key);
    if (typeof localized !== "string" || localized.length === 0 || localized === key) return fallback;
    return localized;
}

Hooks.once("init", () => {
    game.settings.register(EncounterVisibility.Id, EncounterVisibilitySettings.encounterTitleGmId, {
        name: localize(
            "INVERTED-ENCOUNTER-VISIBILITY.Settings.EncounterTitleGm.Name",
            "Hidden Encounter Title append (for GM)",
        ),
        hint: localize(
            "INVERTED-ENCOUNTER-VISIBILITY.Settings.EncounterTitleGm.Hint",
            "Text to append to the Encounter Title for the GM to show them an encounter is hidden.",
        ),
        scope: "world",
        config: true,
        requiresReload: false,
        type: String,
        default: "(Hidden)",
    });

    game.settings.register(EncounterVisibility.Id, EncounterVisibilitySettings.encounterTitlePlayerId, {
        name: localize(
            "INVERTED-ENCOUNTER-VISIBILITY.Settings.EncounterTitlePlayer.Name",
            "Hidden Encounter Title (for Players)",
        ),
        hint: localize(
            "INVERTED-ENCOUNTER-VISIBILITY.Settings.EncounterTitlePlayer.Hint",
            "Text to show as the Encounter Title for players when the encounter is hidden from them.",
        ),
        scope: "world",
        config: true,
        requiresReload: false,
        type: String,
        default: "No Encounter",
    });
});

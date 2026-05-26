# Inverted Encounter Visibility

Ever needed to pre-build an encounter, but also needed your players to be able to explore the same scene before it comes up?
Well, sadly Foundry only allows you to switch between different encounters, but one of them always has to be visible. No more!

Encounters are hidden from players by default.
The module adds `Show Encounter to Players` and `Hide Encounter from Players` buttons to the Encounter Context menu.
Starting combat as a GM also automatically makes that encounter visible to players.

## For the Game Master

Text will appear beside the encounter title showing it's been hidden from the players. The button will then change to a `Show Encounter to Players` button, so the visibility can be reversed.
![Inverted Encounter Visibility example in Foundry](images/inverted-encounter-visibility-example.png)

## For Players

All actors in the encounter will disappear, and the encounter title will change to `No Encounter`, the same as it is before any encounters are added.

## For Other Modules

Use `inverted-encounter-visibility` as the module id/scope and `isVisible` as the encounter flag key.

```ts
const MODULE_ID = "inverted-encounter-visibility";
const FLAG_KEY = "isVisible";

const isModuleActive = game.modules.get(MODULE_ID)?.active === true;

if (isModuleActive) {
    const flagValue = combat.getFlag(MODULE_ID, FLAG_KEY);
    const isVisibleToPlayers = flagValue === true;
    const isHiddenForPlayers = flagValue !== true;
    const isExplicitlyMarkedHidden = flagValue === false;
}
```

Always check module activation first. Calling `getFlag` with an inactive scope can throw in Foundry.

## Credits

This module is based on [fvtt-encounter-visibility](https://github.com/Rkfmckee/fvtt-encounter-visibility)

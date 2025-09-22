# Token Damage
- ![](https://img.shields.io/badge/Foundry-v12-informational)![](https://img.shields.io/badge/Foundry-v13-informational)
- ![Latest Release Download Count](https://img.shields.io/github/downloads/gioppoluca/token-damage/latest/module.zip)
- ![Total Download Count](https://img.shields.io/github/downloads/gioppoluca/token-damage/total?color=d1b124&label=Total%20Download)
- ![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Ftoken-damage&colorB=4aa94a)

Recreate that whiteboad feeling in your favourite VTT!!!
This module shows the **current damage** next to tokens, based on enabling settings.
Compatible with Foundry **V12** and **V13**. System: **D&D5e**.


## What it shows
- Damage = `HP.max - HP.value` (never below 0)

## Settings
- **Enable Mode**: Off / Hostile Only / Non-Allies (Hostile+Neutral) / All
- **X Offset** (pixels): default 4
- **Y Offset** (pixels): default 2
- **Font Size %** (of min token dimension): default 25 (%)

## Notes
- Requires **libWrapper**.
- Label is a `PIXI.Text` child of each Token; added/removed after bar draws and relevant updates.

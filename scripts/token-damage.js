// token-damage.js v1.1.0
// Foundry VTT V12/V13. Requires libWrapper. D&D5e system.
// Shows damage near tokens with Bar 2 visibility and configurable offsets/font size.

const MODULE_ID = "token-damage";

const DEBUG = true;

// Enable modes
const EnableMode = {
  OFF: "off",
  HOSTILE: "hostile",
  NON_ALLIES: "nonAllies",
  ALL: "all"
};

Hooks.once("init", () => {
  // Settings
  game.settings.register(MODULE_ID, "enableMode", {
    name: game.i18n.localize("TOKEN_DAMAGE.settings.enableMode.name"),
    hint: game.i18n.localize("TOKEN_DAMAGE.settings.enableMode.hint"),
    scope: "world",
    config: true,
    type: String,
    default: EnableMode.HOSTILE,
    choices: {
      [EnableMode.OFF]: game.i18n.localize("TOKEN_DAMAGE.settings.enableMode.choices.off"),
      [EnableMode.HOSTILE]: game.i18n.localize("TOKEN_DAMAGE.settings.enableMode.choices.hostile"),
      [EnableMode.NON_ALLIES]: game.i18n.localize("TOKEN_DAMAGE.settings.enableMode.choices.nonAllies"),
      [EnableMode.ALL]: game.i18n.localize("TOKEN_DAMAGE.settings.enableMode.choices.all")
    },
    onChange: () => refreshAllTokens()
  });

  game.settings.register(MODULE_ID, "offsetX", {
    name: game.i18n.localize("TOKEN_DAMAGE.settings.offsetX.name"),
    hint: game.i18n.localize("TOKEN_DAMAGE.settings.offsetX.hint"),
    scope: "client",
    config: true,
    type: Number,
    default: 4,
    onChange: () => refreshAllTokens()
  });

  game.settings.register(MODULE_ID, "offsetY", {
    name: game.i18n.localize("TOKEN_DAMAGE.settings.offsetY.name"),
    hint: game.i18n.localize("TOKEN_DAMAGE.settings.offsetY.hint"),
    scope: "client",
    config: true,
    type: Number,
    default: 2,
    onChange: () => refreshAllTokens()
  });

  game.settings.register(MODULE_ID, "fontPct", {
    name: game.i18n.localize("TOKEN_DAMAGE.settings.fontPct.name"),
    hint: game.i18n.localize("TOKEN_DAMAGE.settings.fontPct.hint"),
    scope: "client",
    config: true,
    type: Number,
    default: 25,
    onChange: () => refreshAllTokens()
  });

  // libWrapper wrappers
  if (globalThis.libWrapper) {
    tryWrap("Token.prototype.drawBars");
//    tryWrap("Token.prototype._drawBar");
  } else {
    console.warn(`${MODULE_ID}: libWrapper not found. Falling back to Hooks only.`);
  }
});

Hooks.once("ready", () => {
  // When an Actor changes, only update tokens of that actor
  Hooks.on("updateActor", (actor, _data) => {
    refreshTokensByActor(actor?.id);
  });

  // When a TokenDocument changes, update just that token (if on this canvas)
  Hooks.on("updateToken", (doc, _data) => {
    refreshTokenByDoc(doc);
  });

  // Control / hover should only affect that token
  Hooks.on("controlToken", (token) => {
    refreshToken(token);
  });
  Hooks.on("hoverToken", (token) => {
    refreshToken(token);
  });

  // Canvas lifecycle + token creation/deletion
  Hooks.on("canvasReady", () => refreshAllTokens());
  Hooks.on("createToken", (doc) => refreshTokenByDoc(doc));
  Hooks.on("deleteToken", (doc) => {
    const t = doc?.object;
    if (t) cleanupLabel(t);
  });
});

function tryWrap(targetPath) {
  try {
    libWrapper.register(MODULE_ID, targetPath, function (wrapped, ...args) {
      try { updateDamageLabel(this); } catch (e) { console.error(`${MODULE_ID} label update error`, e); }
      return wrapped(...args);
    }, "WRAPPER");
    console.log(`${MODULE_ID}: wrapped ${targetPath}`);
  } catch (e) {
    console.debug(`${MODULE_ID}: could not wrap ${targetPath}`, e);
  }
}


/* ---------- Refresh helpers ---------- */

function refreshAllTokens() {
  if (!canvas?.ready) return;
  if (DEBUG) console.log(`${MODULE_ID}: refreshAllTokens`);
  for (const t of canvas.tokens.placeables) {
    try { updateDamageLabel(t); } catch (e) { console.error(`${MODULE_ID} refresh error`, e); }
  }
}

function refreshTokensByActor(actorId) {
  if (!canvas?.ready || !actorId) return;
  if (DEBUG) console.log(`${MODULE_ID}: refreshTokensByActor ${actorId}`);
  for (const t of canvas.tokens.placeables) {
    if (t?.document?.actorId === actorId) {
      try { updateDamageLabel(t); } catch (e) { console.error(`${MODULE_ID} refresh error`, e); }
    }
  }
}

function refreshTokenByDoc(doc) {
  if (!doc) return;
  const t = doc.object; // rendered Token (if on this scene & visible)
  if (t) refreshToken(t);
}

function refreshToken(token) {
  if (!token) return;
  if (!canvas?.ready) return;
  try { updateDamageLabel(token); } catch (e) { console.error(`${MODULE_ID} refresh error`, e); }
}

function shouldDisplayForToken(token) {
  console.log(`${MODULE_ID}: checking token ${token.id}`);
  const mode = game.settings.get(MODULE_ID, "enableMode");
  console.log(`${MODULE_ID}: enable mode is ${mode}`);
  if (mode === EnableMode.OFF) return false;

  const disp = token.document.disposition; // -1 hostile, 0 neutral, 1 friendly
  const isHostile = disp === -1;
  const isNeutral = disp === 0;
  const isFriendly = disp === 1;

  if (mode === EnableMode.HOSTILE && !isHostile) return false;
  if (mode === EnableMode.NON_ALLIES && isFriendly) return false;
  console.log(`${MODULE_ID}: token disposition is ${disp}`);
  const damage = getDamageValue(token);
  console.log(`${MODULE_ID}: token damage is ${damage}`);
  if (damage <= 0) return false;

  return token.visible && token.renderable;
}

function getDamageValue(token) {
  const actor = token.actor;
  if (!actor) return 0;
  if (game.system?.id !== "dnd5e") return 0;
  const hp = foundry.utils.getProperty(actor, "system.attributes.hp");
  if (!hp) return 0;

  // Prefer hp.damage if present; otherwise max - value
  const explicitDamage = typeof hp.damage === "number"
    ? hp.damage
    : (typeof hp.damage?.value === "number" ? hp.damage.value : null);
  if (explicitDamage != null && !Number.isNaN(explicitDamage)) return Math.max(0, explicitDamage);

  const max = Number(hp.max) || 0;
  const val = Number(hp.value) || 0;
  return Math.max(0, max - val);
}

function ensureLabel(token) {
  if (token._tokenDamageLabel && !token._tokenDamageLabel.destroyed) return token._tokenDamageLabel;

  const pct = Math.max(8, Number(game.settings.get(MODULE_ID, "fontPct")) || 25);
  const base = Math.min(token.w, token.h);
  const px = Math.max(10, Math.round(base * (pct / 100)));

  const style = new PIXI.TextStyle({
    fontFamily: "Signika, sans-serif",
    fontSize: px,
    fontWeight: "700",
    fill: 0xff0000,           // red
    stroke: 0x000000,
    strokeThickness: 4,
    align: "center",
    dropShadow: true,
    dropShadowDistance: 2,
    dropShadowAngle: Math.PI / 4,
    dropShadowBlur: 2
  });
  const label = new PIXI.Text("", style);
  // Bottom-right anchor so position is the label's bottom-right corner
  label.anchor.set(1, 1);
  label.name = "token-damage-label";
  label.zIndex = 1000;

  token.addChild(label);
  token._tokenDamageLabel = label;
  return label;
}

function updateDamageLabel(token) {
  console.log(`${MODULE_ID}: updating token ${token.id}`);
  const label = token._tokenDamageLabel;

  if (!shouldDisplayForToken(token)) {
    if (label && !label.destroyed) {
      token.removeChild(label);
      label.destroy();
      token._tokenDamageLabel = null;
    }
    return;
  }

  console.log(`${MODULE_ID}: showing damage for token ${token.id}`);
  const dmg = getDamageValue(token);
  const lbl = ensureLabel(token);
  console.log(`${MODULE_ID}: damage value is ${dmg} for token ${token.id}`, lbl);
  lbl.text = `-${dmg}`;

  const xOff = Number(game.settings.get(MODULE_ID, "offsetX")) || 0;
  const yOff = Number(game.settings.get(MODULE_ID, "offsetY")) || 0;

  // Place bottom-right of label slightly outside top-right corner
  lbl.x = token.w - xOff;
  lbl.y = -yOff;
  lbl.visible = true;
}

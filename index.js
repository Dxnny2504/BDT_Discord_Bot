console.log("");
console.log("========================================");
console.log("        AFK MINECRAFT TEST");
console.log("========================================");
console.log("");

console.log("[MC] index.js gestartet.");
console.log("[MC] Schritt 1");

console.log(
  "[MC] Node Version:",
  process.version
);

console.log("[MC] Schritt 2");

console.log(
  "[MC] Arbeitsverzeichnis:",
  process.cwd()
);

console.log("[MC] Schritt 3");

console.log(
  "[MC] MC_USERNAME:",
  process.env.MC_USERNAME
    ? "gesetzt"
    : "NICHT GESETZT"
);

console.log("[MC] Schritt 4");

console.log(
  "[MC] Lade Mineflayer..."
);

const mineflayer =
  require("mineflayer");

console.log(
  "[MC] Mineflayer erfolgreich geladen."
);

console.log(
  "[MC] Lade Pathfinder..."
);

const {
  pathfinder,
  Movements,
  goals
} = require(
  "mineflayer-pathfinder"
);

console.log(
  "[MC] Pathfinder erfolgreich geladen."
);

console.log("");
console.log("========================================");
console.log("        TEST ABGESCHLOSSEN");
console.log("========================================");
console.log("");

process.stdin.resume();

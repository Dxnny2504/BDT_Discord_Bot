console.log("");
console.log("========================================");
console.log("        GRIEFERGAMES AFK BOT");
console.log("========================================");
console.log("");

console.log("[MC] index.js wurde gestartet.");
console.log("[MC] Schritt 1 erreicht.");
console.log("[MC] Node Version:", process.version);
console.log("[MC] Schritt 2 erreicht.");
console.log("[MC] Arbeitsverzeichnis:", process.cwd());
console.log("[MC] Schritt 3 erreicht.");

console.log("");
console.log("[MC] Testprozess läuft.");
console.log("[MC] Warte 5 Sekunden...");
console.log("");

setTimeout(() => {

    console.log("[MC] 5 Sekunden vergangen.");
    console.log("[MC] index.js läuft weiterhin.");
    console.log("[MC] Schritt 4 erreicht.");

}, 5000);

setInterval(() => {

    console.log(
        "[MC] Prozess läuft:",
        new Date().toISOString()
    );

}, 10000);

console.log("");
console.log("========================================");
console.log("        AFK MINECRAFT TEST");
console.log("========================================");
console.log("");
console.log("[MC] index.js wurde gestartet.");
console.log("[MC] Node Version:", process.version);
console.log("[MC] Arbeitsverzeichnis:", process.cwd());

const mineflayer = require("mineflayer");

console.log("[MC] Mineflayer wurde geladen.");

const {
  pathfinder,
  Movements,
  goals
} = require("mineflayer-pathfinder");

console.log("[MC] Pathfinder wurde geladen.");

const bot = mineflayer.createBot({
  host: "griefergames.net",
  port: 25565,
  username: "r.guse858@gmail.com",
  auth: "microsoft",
  version: "1.8.9",
  profilesFolder: "./minecraft-auth"
});

console.log("[MC] Minecraft Bot Objekt wurde erstellt.");

bot.loadPlugin(pathfinder);

console.log("[MC] Pathfinder Plugin geladen.");

bot.once("login", () => {
  console.log("");
  console.log("========================================");
  console.log("        MINECRAFT LOGIN");
  console.log("========================================");
  console.log("");

  console.log("[MC] Login erfolgreich.");
});

bot.once("spawn", () => {
  console.log("");
  console.log("========================================");
  console.log("        MINECRAFT SPAWN");
  console.log("========================================");
  console.log("");

  console.log(
    "[MC] Position:",
    bot.entity.position
  );

  console.log(
    "[MC] AFK Test erfolgreich."
  );
});

bot.on("messagestr", message => {
  console.log(
    "[CHAT]",
    message
  );
});

bot.on("kicked", reason => {
  console.log(
    "[MC] Gekickt:",
    reason
  );
});

bot.on("error", error => {
  console.log(
    "[MC] FEHLER:"
  );

  console.log(
    error
  );
});

bot.on("end", () => {
  console.log(
    "[MC] Verbindung beendet."
  );
});

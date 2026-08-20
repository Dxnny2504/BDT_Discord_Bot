const mineflayer = require("mineflayer");

const {
  pathfinder,
  Movements,
  goals
} = require("mineflayer-pathfinder");

console.log("");
console.log("========================================");
console.log("        GRIEFERGAMES AFK BOT");
console.log("========================================");
console.log("");

console.log("[MC] Node Version:", process.version);
console.log("[MC] Starte Mineflayer...");
console.log("[MC] Server: griefergames.net");
console.log("[MC] Version: 1.8.9");
console.log("[MC] Benutzer:", process.env.MC_USERNAME || "nicht gesetzt");
console.log("");

let bot;

try {
  console.log("[MC] Erstelle Minecraft Bot...");

  bot = mineflayer.createBot({
    host: "griefergames.net",
    port: 25565,

    username:
      process.env.MC_USERNAME ||
      "r.guse858@gmail.com",

    auth: "microsoft",

    version: "1.8.9",

    profilesFolder:
      "./minecraft-auth"
  });

  console.log(
    "[MC] createBot() wurde erfolgreich ausgeführt."
  );

} catch (error) {

  console.log("");
  console.log("========================================");
  console.log("        CREATE BOT FEHLER");
  console.log("========================================");
  console.log("");

  console.error(error);

  process.exit(1);
}

console.log(
  "[MC] Registriere Minecraft Events..."
);

bot.loadPlugin(
  pathfinder
);

console.log(
  "[MC] Pathfinder Plugin geladen."
);

console.log(
  "[MC] Warte auf Minecraft Login..."
);

bot.once(
  "login",
  () => {

    console.log("");
    console.log("========================================");
    console.log("        MINECRAFT LOGIN");
    console.log("========================================");
    console.log("");

    console.log(
      "[MC] Login erfolgreich."
    );

    console.log(
      "[MC] Username:",
      bot.username
    );

    console.log(
      "[MC] Version:",
      bot.version
    );
  }
);

bot.once(
  "spawn",
  () => {

    console.log("");
    console.log("========================================");
    console.log("        MINECRAFT SPAWN");
    console.log("========================================");
    console.log("");

    console.log(
      "[MC] Minecraft Welt geladen."
    );

    if (
      bot.entity &&
      bot.entity.position
    ) {

      console.log(
        "[MC] Position:",
        bot.entity.position
      );
    }

    console.log(
      "[MC] AFK Bot kann jetzt weiterarbeiten."
    );
  }
);

bot.on(
  "messagestr",
  message => {

    console.log(
      "[CHAT] " + message
    );
  }
);

bot.on(
  "kicked",
  reason => {

    console.log("");
    console.log("========================================");
    console.log("        MINECRAFT GEKICKT");
    console.log("========================================");
    console.log("");

    console.log(
      reason
    );
  }
);

bot.on(
  "error",
  error => {

    console.log("");
    console.log("========================================");
    console.log("        MINECRAFT FEHLER");
    console.log("========================================");
    console.log("");

    console.error(
      error
    );
  }
);

bot.on(
  "end",
  () => {

    console.log("");
    console.log("========================================");
    console.log("        MINECRAFT VERBINDUNG ENDE");
    console.log("========================================");
    console.log("");

    console.log(
      "[MC] Die Verbindung wurde beendet."
    );
  }
);

bot.on(
  "death",
  () => {

    console.log(
      "[MC] Bot ist gestorben."
    );
  }
);

bot.on(
  "health",
  () => {

    if (
      bot.health !== undefined &&
      bot.food !== undefined
    ) {

      console.log(
        "[MC] Leben:",
        bot.health,
        "| Essen:",
        bot.food
      );
    }
  }
);

process.on(
  "uncaughtException",
  error => {

    console.log("");
    console.log("========================================");
    console.log("        UNCAUGHT EXCEPTION");
    console.log("========================================");
    console.log("");

    console.error(
      error
    );
  }
);

process.on(
  "unhandledRejection",
  error => {

    console.log("");
    console.log("========================================");
    console.log("        UNHANDLED REJECTION");
    console.log("========================================");
    console.log("");

    console.error(
      error
    );
  }
);

process.on(
  "SIGTERM",
  () => {

    console.log(
      "[MC] SIGTERM erhalten."
    );

    try {

      if (
        bot
      ) {

        bot.quit(
          "AFK Bot wird beendet"
        );
      }

    } catch (
      error
    ) {

      console.error(
        error
      );
    }

    setTimeout(
      () => {
        process.exit(0);
      },
      1000
    );
  }
);

process.on(
  "SIGINT",
  () => {

    console.log(
      "[MC] SIGINT erhalten."
    );

    try {

      if (
        bot
      ) {

        bot.quit(
          "AFK Bot wird beendet"
        );
      }

    } catch (
      error
    ) {

      console.error(
        error
      );
    }

    setTimeout(
      () => {
        process.exit(0);
      },
      1000
    );
  }
);

const mineflayer = require("mineflayer");
const fs = require("fs");
const path = require("path");

const AUTH_DIR = path.join(__dirname, "minecraft-auth");

if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

console.log("");
console.log("========================================");
console.log("        GRIEFERGAMES AFK BOT");
console.log("========================================");
console.log("");

console.log("[MC] index.js gestartet.");
console.log("[MC] Node:", process.version);
console.log("[MC] Auth Ordner:", AUTH_DIR);

const username = process.env.MC_USERNAME;

if (!username) {
    console.error("");
    console.error("========================================");
    console.error("        MC_USERNAME FEHLT");
    console.error("========================================");
    console.error("");
    console.error(
        "[MC] Bitte MC_USERNAME in Railway Variables setzen."
    );

    process.exit(1);
}

console.log("[MC] Minecraft Account:", username);
console.log("[MC] Erstelle Verbindung zu GrieferGames...");
console.log("");

let bot = null;
let reconnecting = false;

function startMinecraft() {

    if (bot) {
        try {
            bot.quit("Neue Verbindung");
        } catch (error) {
            console.log("[MC] Alte Verbindung konnte nicht beendet werden.");
        }

        bot = null;
    }

    console.log("");
    console.log("========================================");
    console.log("        MINECRAFT VERBINDUNG");
    console.log("========================================");
    console.log("");

    console.log("[MC] Server: griefergames.net");
    console.log("[MC] Version: 1.8.9");
    console.log("[MC] Account:", username);
    console.log("");

    try {

        bot = mineflayer.createBot({
            host: "griefergames.net",
            port: 25565,

            username: username,

            auth: "microsoft",

            version: "1.8.9",

            profilesFolder: AUTH_DIR,

            hideErrors: false
        });

        console.log(
            "[MC] Minecraft Bot wurde erstellt."
        );

    } catch (error) {

        console.error("");
        console.error(
            "[MC] FEHLER BEIM ERSTELLEN DES BOTS:"
        );
        console.error(error);

        scheduleReconnect();

        return;
    }

    bot.once("login", () => {

        console.log("");
        console.log("========================================");
        console.log("        MINECRAFT LOGIN ERFOLGREICH");
        console.log("========================================");
        console.log("");

        console.log(
            "[MC] Username:",
            bot.username
        );

        console.log(
            "[MC] Version:",
            bot.version
        );
    });

    bot.once("spawn", () => {

        console.log("");
        console.log("========================================");
        console.log("        MINECRAFT SPAWN");
        console.log("========================================");
        console.log("");

        if (bot.entity && bot.entity.position) {

            console.log(
                "[MC] Position:",
                bot.entity.position
            );
        }

        console.log(
            "[MC] Der Minecraft Bot ist jetzt ONLINE."
        );

        console.log(
            "[MC] AFK System kann gestartet werden."
        );
    });

    bot.on("messagestr", message => {

        console.log(
            "[CHAT] " + message
        );
    });

    bot.on("kicked", reason => {

        console.log("");
        console.log("========================================");
        console.log("        MINECRAFT GEKICKT");
        console.log("========================================");
        console.log("");

        console.log(
            "[MC] Grund:"
        );

        console.log(
            reason
        );
    });

    bot.on("error", error => {

        console.log("");
        console.log("========================================");
        console.log("        MINECRAFT FEHLER");
        console.log("========================================");
        console.log("");

        console.error(error);
    });

    bot.on("end", () => {

        console.log("");
        console.log("========================================");
        console.log("        MINECRAFT VERBINDUNG ENDE");
        console.log("========================================");
        console.log("");

        bot = null;

        scheduleReconnect();
    });
}

function scheduleReconnect() {

    if (reconnecting) {
        return;
    }

    reconnecting = true;

    console.log(
        "[MC] Neuer Verbindungsversuch in 10 Sekunden..."
    );

    setTimeout(() => {

        reconnecting = false;

        startMinecraft();

    }, 10000);
}

startMinecraft();

process.on("uncaughtException", error => {

    console.error("");
    console.error("========================================");
    console.error("        UNCAUGHT EXCEPTION");
    console.error("========================================");
    console.error("");

    console.error(error);
});

process.on("unhandledRejection", error => {

    console.error("");
    console.error("========================================");
    console.error("        UNHANDLED REJECTION");
    console.error("========================================");
    console.error("");

    console.error(error);
});

process.on("SIGTERM", () => {

    console.log(
        "[MC] SIGTERM erhalten. Beende Minecraft..."
    );

    if (bot) {

        try {
            bot.quit("Railway Shutdown");
        } catch (error) {
            console.error(error);
        }
    }

    process.exit(0);
});

process.on("SIGINT", () => {

    console.log(
        "[MC] SIGINT erhalten. Beende Minecraft..."
    );

    if (bot) {

        try {
            bot.quit("Shutdown");
        } catch (error) {
            console.error(error);
        }
    }

    process.exit(0);
});

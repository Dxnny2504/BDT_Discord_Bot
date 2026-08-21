require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mineflayer = require("mineflayer");

const {
    Client,
    GatewayIntentBits
} = require("discord.js");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const MC_EMAIL =
    process.env.MC_EMAIL || "r.guse858@gmail.com";

const MC_HOST =
    process.env.MC_HOST || "play.griefergames.net";

const MC_PORT =
    Number(process.env.MC_PORT || 25565);

const MC_AUTH_DIR =
    path.join(process.cwd(), "minecraft-auth");

let bot = null;
let starting = false;


// ============================================================
// SYSTEM
// ============================================================

console.log("========================================");
console.log("        GRIEFERGAMES AFK BOT");
console.log("========================================");

console.log("[SYSTEM] Node: " + process.version);
console.log("[SYSTEM] Prozess: " + process.pid);
console.log("[SYSTEM] Minecraft Host: " + MC_HOST);
console.log("[SYSTEM] Minecraft Port: " + MC_PORT);
console.log("[SYSTEM] Minecraft Version: automatisch");


// ============================================================
// AUTH ORDNER
// ============================================================

try {

    fs.mkdirSync(
        MC_AUTH_DIR,
        {
            recursive: true
        }
    );

    console.log(
        "[MC] Microsoft Auth Speicher: " +
        MC_AUTH_DIR
    );

} catch (error) {

    console.error(
        "[AUTH ERROR] Auth Ordner konnte nicht erstellt werden."
    );

    console.error(error);

}


// ============================================================
// DISCORD
// ============================================================

const discordClient =
    new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });


discordClient.once(
    "clientReady",
    () => {

        console.log(
            "[DISCORD] Bot online: " +
            discordClient.user.tag
        );

        console.log(
            "[DISCORD] Schreibe !afk"
        );

        console.log(
            "[SYSTEM] Discord Verbindung aktiv."
        );

        console.log(
            "[SYSTEM] Prozess bleibt aktiv."
        );

    }
);


// ============================================================
// MINECRAFT START
// ============================================================

function startMinecraft() {

    if (starting) {

        console.log(
            "[MC] Minecraft startet bereits."
        );

        return;

    }

    if (bot) {

        console.log(
            "[MC] Minecraft läuft bereits."
        );

        return;

    }

    starting = true;

    console.log("");
    console.log("========================================");
    console.log("        AFK SESSION START");
    console.log("========================================");

    console.log(
        "[MC] Starte Minecraft Bot..."
    );

    console.log(
        "[MC] Account: " +
        MC_EMAIL
    );

    console.log(
        "[MC] Host: " +
        MC_HOST
    );

    console.log(
        "[MC] Port: " +
        MC_PORT
    );

    console.log(
        "[MC] Auth: microsoft"
    );

    console.log(
        "[MC] Auth Speicher: " +
        MC_AUTH_DIR
    );

    try {

        bot =
            mineflayer.createBot({

                host: MC_HOST,

                port: MC_PORT,

                username: MC_EMAIL,

                auth: "microsoft",

                profilesFolder:
                    MC_AUTH_DIR

            });

        bot.once(
            "login",
            () => {

                starting = false;

                console.log(
                    "[MC] Minecraft Login erfolgreich."
                );

            }
        );


        bot.once(
            "spawn",
            () => {

                console.log(
                    "[MC] Minecraft Spawn erfolgreich."
                );

                console.log(
                    "[MC] Minecraft Bot ist jetzt auf dem Server."
                );

            }
        );


        bot.on(
            "messagestr",
            message => {

                console.log(
                    "[MC CHAT] " +
                    message
                );

            }
        );


        bot.on(
            "kicked",
            reason => {

                console.log(
                    "[MC] Bot wurde gekickt."
                );

                console.log(
                    "[MC] Grund:"
                );

                console.log(
                    reason
                );

            }
        );


        bot.on(
            "error",
            error => {

                console.error(
                    "[MC ERROR]"
                );

                console.error(
                    error
                );

            }
        );


        bot.on(
            "end",
            () => {

                console.log(
                    "[MC] Minecraft Verbindung beendet."
                );

                bot = null;
                starting = false;

            }
        );

    } catch (error) {

        console.error(
            "[MC ERROR] Minecraft konnte nicht gestartet werden."
        );

        console.error(error);

        bot = null;
        starting = false;

    }

}


// ============================================================
// DISCORD !AFK
// ============================================================

discordClient.on(
    "messageCreate",
    message => {

        if (message.author.bot) {
            return;
        }

        if (
            message.content
                .trim()
                .toLowerCase() !== "!afk"
        ) {
            return;
        }

        console.log(
            "[DISCORD] !afk empfangen."
        );

        message.reply(
            "AFK Bot wird gestartet."
        );

        startMinecraft();

    }
);


// ============================================================
// DISCORD LOGIN
// ============================================================

console.log(
    "[SYSTEM] Starte Discord Login..."
);

discordClient
    .login(DISCORD_TOKEN)
    .catch(
        error => {

            console.error(
                "[DISCORD ERROR] Login fehlgeschlagen."
            );

            console.error(error);

            process.exit(1);

        }
    );


// ============================================================
// SYSTEM FEHLER
// ============================================================

process.on(
    "uncaughtException",
    error => {

        console.error(
            "[SYSTEM ERROR] Uncaught Exception:"
        );

        console.error(error);

    }
);


process.on(
    "unhandledRejection",
    error => {

        console.error(
            "[SYSTEM ERROR] Unhandled Rejection:"
        );

        console.error(error);

    }
);

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mineflayer = require("mineflayer");

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const DISCORD_TOKEN =
    process.env.DISCORD_TOKEN;

const DISCORD_OWNER_ID =
    process.env.DISCORD_OWNER_ID;

const MC_EMAIL =
    process.env.MC_EMAIL ||
    "r.guse858@gmail.com";

const MC_HOST =
    process.env.MC_HOST ||
    "play.griefergames.net";

const MC_PORT =
    Number(
        process.env.MC_PORT ||
        25565
    );

const MC_AUTH_DIR =
    path.join(
        process.cwd(),
        "minecraft-auth"
    );

let bot = null;
let starting = false;
let afkRunning = false;
let routeRunning = false;
let panelMessage = null;

let startedAt = null;


// ============================================================
// SYSTEM
// ============================================================

console.log("========================================");
console.log("        GRIEFERGAMES AFK BOT");
console.log("========================================");

console.log(
    "[SYSTEM] Node: " +
    process.version
);

console.log(
    "[SYSTEM] Prozess: " +
    process.pid
);

console.log(
    "[SYSTEM] Minecraft Host: " +
    MC_HOST
);

console.log(
    "[SYSTEM] Minecraft Port: " +
    MC_PORT
);

console.log(
    "[SYSTEM] Minecraft Version: automatisch"
);


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
// HILFSFUNKTION
// ============================================================

function sleep(ms) {

    return new Promise(
        resolve => setTimeout(
            resolve,
            ms
        )
    );

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


// ============================================================
// POSITION
// ============================================================

function getPosition() {

    if (
        !bot ||
        !bot.entity
    ) {

        return "Unbekannt";

    }

    const position =
        bot.entity.position;

    return (
        "X: " +
        position.x.toFixed(2) +
        " | Y: " +
        position.y.toFixed(2) +
        " | Z: " +
        position.z.toFixed(2)
    );

}


// ============================================================
// LAUFZEIT
// ============================================================

function getRuntime() {

    if (!startedAt) {

        return "00:00:00";

    }

    const seconds =
        Math.floor(
            (
                Date.now() -
                startedAt
            ) / 1000
        );

    const hours =
        Math.floor(
            seconds / 3600
        );

    const minutes =
        Math.floor(
            (
                seconds % 3600
            ) / 60
        );

    const secs =
        seconds % 60;

    return (
        String(hours).padStart(2, "0") +
        ":" +
        String(minutes).padStart(2, "0") +
        ":" +
        String(secs).padStart(2, "0")
    );

}


// ============================================================
// PANEL
// ============================================================

function createPanel() {

    const online =
        !!(
            bot &&
            bot.entity
        );

    const embed =
        new EmbedBuilder()

            .setTitle(
                "GRIEFERGAMES AFK BOT"
            )

            .setDescription(
                "Steuerung für deinen Minecraft AFK Bot"
            )

            .addFields(

                {
                    name: "Status",
                    value:
                        online
                            ? "Online"
                            : "Offline",
                    inline: true
                },

                {
                    name: "Server",
                    value:
                        MC_HOST,
                    inline: true
                },

                {
                    name: "Position",
                    value:
                        getPosition(),
                    inline: false
                },

                {
                    name: "Laufzeit",
                    value:
                        getRuntime(),
                    inline: true
                },

                {
                    name: "Route",
                    value:
                        routeRunning
                            ? "CB6 Route läuft"
                            : "Keine Route",
                    inline: true
                }

            )

            .setTimestamp();

    const row =
        new ActionRowBuilder()

            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        "afk_start"
                    )
                    .setLabel(
                        "AFK Start"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "afk_stop"
                    )
                    .setLabel(
                        "AFK Stopp"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "afk_position"
                    )
                    .setLabel(
                        "Position"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "afk_refresh"
                    )
                    .setLabel(
                        "Aktualisieren"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    )

            );

    return {

        embeds: [
            embed
        ],

        components: [
            row
        ]

    };

}


// ============================================================
// PANEL AKTUALISIEREN
// ============================================================

async function updatePanel() {

    if (!panelMessage) {

        return;

    }

    try {

        await panelMessage.edit(
            createPanel()
        );

    } catch {}

}


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
    afkRunning = true;

    if (!startedAt) {

        startedAt =
            Date.now();

    }

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

                host:
                    MC_HOST,

                port:
                    MC_PORT,

                username:
                    MC_EMAIL,

                auth:
                    "microsoft",

                profilesFolder:
                    MC_AUTH_DIR

            });


        // ====================================================
        // LOGIN
        // ====================================================

        bot.once(
            "login",
            () => {

                starting = false;

                console.log(
                    "[MC] Minecraft Login erfolgreich."
                );

                updatePanel();

            }
        );


        // ====================================================
        // SPAWN
        // ====================================================

        bot.once(
            "spawn",
            async () => {

                console.log(
                    "[MC] Minecraft Spawn erfolgreich."
                );

                console.log(
                    "[MC] Minecraft Bot ist jetzt auf dem Server."
                );

                updatePanel();

                await sleep(3000);

                if (
                    bot &&
                    afkRunning
                ) {

                    startCB6Route();

                }

            }
        );


        // ====================================================
        // CHAT
        // ====================================================

        bot.on(
            "messagestr",
            message => {

                console.log(
                    "[MC CHAT] " +
                    message
                );

            }
        );


        // ====================================================
        // KICK
        // ====================================================

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

                updatePanel();

            }
        );


        // ====================================================
        // ERROR
        // ====================================================

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


        // ====================================================
        // END
        // ====================================================

        bot.on(
            "end",
            () => {

                console.log(
                    "[MC] Minecraft Verbindung beendet."
                );

                bot = null;

                starting = false;

                routeRunning = false;

                updatePanel();

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
// NACH NORDEN DREHEN
// ============================================================

async function lookNorth() {

    if (!bot) {

        return;

    }

    console.log(
        "[ROUTE] Drehe nach Norden."
    );

    await bot.look(
        0,
        0,
        true
    );

    await sleep(500);

    console.log(
        "[ROUTE] Blickrichtung gesetzt."
    );

}


// ============================================================
// VORWÄRTS LAUFEN
// ============================================================

async function moveForward(duration) {

    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }

    bot.setControlState(
        "forward",
        true
    );

    bot.setControlState(
        "sprint",
        true
    );

    const start =
        Date.now();

    while (
        bot &&
        routeRunning &&
        Date.now() - start < duration
    ) {

        await sleep(50);

    }

    if (bot) {

        bot.setControlState(
            "forward",
            false
        );

        bot.setControlState(
            "sprint",
            false
        );

    }

}


// ============================================================
// SPRINGEN
// ============================================================

async function jump() {

    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }

    console.log(
        "[ROUTE] Springe über die Kante..."
    );

    bot.setControlState(
        "jump",
        true
    );

    await sleep(350);

    if (bot) {

        bot.setControlState(
            "jump",
            false
        );

    }

}


// ============================================================
// CB6 ROUTE
// ============================================================

async function startCB6Route() {

    if (
        !bot ||
        routeRunning
    ) {

        return;

    }

    routeRunning = true;

    console.log("");
    console.log("========================================");
    console.log("        CB6 ROUTE");
    console.log("========================================");


    // ========================================================
    // /PORTAL
    // ========================================================

    console.log(
        "[ROUTE] Sende /portal..."
    );

    bot.chat(
        "/portal"
    );

    await sleep(4000);


    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }


    console.log(
        "[ROUTE] Portalbereich erreicht."
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );


    // ========================================================
    // NORDEN
    // ========================================================

    await lookNorth();


    // ========================================================
    // FESTER WEG
    // ========================================================

    console.log(
        "[ROUTE] Starte festen Weg über die Kante."
    );


    await moveForward(
        900
    );


    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }


    console.log(
        "[ROUTE] Kante erreicht."
    );


    // ========================================================
    // SPRUNG
    // ========================================================

    await jump();


    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }


    // ========================================================
    // WEITERLAUFEN
    // ========================================================

    await moveForward(
        850
    );


    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }


    console.log(
        "[ROUTE] Kante überquert."
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );


    await sleep(500);


    await moveForward(
        900
    );


    if (bot) {

        bot.setControlState(
            "forward",
            false
        );

        bot.setControlState(
            "sprint",
            false
        );

    }


    // ========================================================
    // CB6 PORTAL
    // ========================================================

    console.log("");
    console.log(
        "[ROUTE] CB6 Portal erreicht."
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );

    updatePanel();


    // ========================================================
    // 12 SEKUNDEN WARTEN
    // ========================================================

    console.log(
        "[ROUTE] Warte 12 Sekunden..."
    );

    await sleep(
        12000
    );


    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }


    // ========================================================
    // /HOME 55
    // ========================================================

    console.log(
        "[ROUTE] Sende /home 55..."
    );

    bot.chat(
        "/home 55"
    );


    console.log(
        "[ROUTE] /home 55 gesendet."
    );


    routeRunning = false;

    updatePanel();

}


// ============================================================
// STOPP
// ============================================================

function stopMinecraft() {

    afkRunning = false;

    routeRunning = false;

    startedAt = null;

    if (bot) {

        try {

            bot.clearControlStates();

            bot.quit(
                "AFK Bot gestoppt"
            );

        } catch {}

    }

    bot = null;

    starting = false;

    console.log(
        "[MC] AFK Bot gestoppt."
    );

    updatePanel();

}


// ============================================================
// READY
// ============================================================

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
// !AFK
// ============================================================

discordClient.on(
    "messageCreate",
    async message => {

        if (
            message.author.bot
        ) {

            return;

        }

        if (
            message.content
                .trim()
                .toLowerCase() !==
            "!afk"
        ) {

            return;

        }

        if (
            DISCORD_OWNER_ID &&
            message.author.id !==
            DISCORD_OWNER_ID
        ) {

            return;

        }

        console.log(
            "[DISCORD] !afk empfangen."
        );

        try {

            panelMessage =
                await message.channel.send(
                    createPanel()
                );

            console.log(
                "[DISCORD] AFK Panel erstellt."
            );

        } catch (error) {

            console.error(
                "[DISCORD ERROR]"
            );

            console.error(error);

        }

    }
);


// ============================================================
// BUTTONS
// ============================================================

discordClient.on(
    "interactionCreate",
    async interaction => {

        if (
            !interaction.isButton()
        ) {

            return;

        }

        if (
            DISCORD_OWNER_ID &&
            interaction.user.id !==
            DISCORD_OWNER_ID
        ) {

            await interaction.reply({

                content:
                    "Keine Berechtigung.",

                ephemeral:
                    true

            });

            return;

        }


        console.log(
            "[DISCORD] Button: " +
            interaction.customId
        );


        // ====================================================
        // START
        // ====================================================

        if (
            interaction.customId ===
            "afk_start"
        ) {

            console.log(
                "[DISCORD] AFK Start gedrückt."
            );

            await interaction.reply({

                content:
                    "Minecraft Bot wird gestartet.",

                ephemeral:
                    true

            });

            startMinecraft();

            return;

        }


        // ====================================================
        // STOPP
        // ====================================================

        if (
            interaction.customId ===
            "afk_stop"
        ) {

            console.log(
                "[DISCORD] AFK Stopp gedrückt."
            );

            stopMinecraft();

            await interaction.reply({

                content:
                    "AFK Bot wurde gestoppt.",

                ephemeral:
                    true

            });

            return;

        }


        // ====================================================
        // POSITION
        // ====================================================

        if (
            interaction.customId ===
            "afk_position"
        ) {

            await interaction.reply({

                content:
                    "Aktuelle Position:\n" +
                    getPosition(),

                ephemeral:
                    true

            });

            return;

        }


        // ====================================================
        // REFRESH
        // ====================================================

        if (
            interaction.customId ===
            "afk_refresh"
        ) {

            await interaction.update(
                createPanel()
            );

            return;

        }

    }
);


// ============================================================
// DISCORD LOGIN
// ============================================================

console.log(
    "[SYSTEM] Starte Discord Login..."
);

discordClient
    .login(
        DISCORD_TOKEN
    )
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
// PANEL AUTO UPDATE
// ============================================================

setInterval(
    () => {

        if (panelMessage) {

            updatePanel();

        }

    },
    5000
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


// ============================================================
// SHUTDOWN
// ============================================================

process.on(
    "SIGTERM",
    () => {

        stopMinecraft();

        discordClient.destroy();

        process.exit(0);

    }
);


process.on(
    "SIGINT",
    () => {

        stopMinecraft();

        discordClient.destroy();

        process.exit(0);

    }
);

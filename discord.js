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

// ============================================================
// KONFIGURATION
// ============================================================

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

const MC_VERSION =
    "1.8.9";

const MC_AUTH =
    "microsoft";

// Temporärer Cache innerhalb des Containers
const MC_AUTH_DIR =
    path.join(
        process.cwd(),
        "minecraft-auth"
    );

// Railway Variable
const MC_AUTH_CACHE =
    process.env.MC_AUTH_CACHE || "";

// ============================================================
// STATUS
// ============================================================

let mcBot = null;
let panelMessage = null;

let mcStarting = false;
let afkRunning = false;
let portalRouteRunning = false;

let afkStartedAt = null;

let reconnectTimer = null;

let lastAction = "Noch keine";

let movements = 0;
let jumps = 0;
let reconnects = 0;
let disconnects = 0;

// ============================================================
// HILFSFUNKTION
// ============================================================

function sleep(ms) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}

// ============================================================
// AUTH CACHE
// ============================================================

function restoreAuthCache() {

    try {

        if (!MC_AUTH_CACHE) {

            console.log(
                "[AUTH] Kein MC_AUTH_CACHE vorhanden."
            );

            return;

        }

        fs.mkdirSync(
            MC_AUTH_DIR,
            {
                recursive: true
            }
        );

        const decoded =
            Buffer
                .from(
                    MC_AUTH_CACHE,
                    "base64"
                )
                .toString("utf8");

        const cache =
            JSON.parse(
                decoded
            );

        for (
            const [fileName, content]
            of Object.entries(cache)
        ) {

            const filePath =
                path.join(
                    MC_AUTH_DIR,
                    fileName
                );

            fs.writeFileSync(
                filePath,
                content
            );

        }

        console.log(
            "[AUTH] Microsoft Auth Cache aus Railway Variable wiederhergestellt."
        );

    } catch (error) {

        console.error(
            "[AUTH ERROR] Auth Cache konnte nicht wiederhergestellt werden."
        );

        console.error(
            error
        );

    }

}

// ============================================================
// AUTH CACHE EXPORT
// ============================================================

function exportAuthCache() {

    try {

        if (
            !fs.existsSync(
                MC_AUTH_DIR
            )
        ) {

            return;

        }

        const files =
            fs.readdirSync(
                MC_AUTH_DIR
            );

        const cache = {};

        for (
            const fileName
            of files
        ) {

            const filePath =
                path.join(
                    MC_AUTH_DIR,
                    fileName
                );

            if (
                fs.statSync(
                    filePath
                ).isFile()
            ) {

                cache[fileName] =
                    fs.readFileSync(
                        filePath,
                        "utf8"
                    );

            }

        }

        const encoded =
            Buffer
                .from(
                    JSON.stringify(cache)
                )
                .toString("base64");

        console.log(
            ""
        );

        console.log(
            "================================================"
        );

        console.log(
            "[AUTH] NEUER MC_AUTH_CACHE"
        );

        console.log(
            "================================================"
        );

        console.log(
            encoded
        );

        console.log(
            "================================================"
        );

        console.log(
            "[AUTH] Diesen Wert in Railway als"
        );

        console.log(
            "[AUTH] MC_AUTH_CACHE speichern."
        );

        console.log(
            "================================================"
        );

    } catch (error) {

        console.error(
            "[AUTH ERROR] Auth Cache konnte nicht exportiert werden."
        );

        console.error(
            error
        );

    }

}

// ============================================================
// POSITION
// ============================================================

function getPosition() {

    if (
        !mcBot ||
        !mcBot.entity
    ) {

        return "Unbekannt";

    }

    const p =
        mcBot.entity.position;

    return (
        "X " +
        p.x.toFixed(2) +
        " Y " +
        p.y.toFixed(2) +
        " Z " +
        p.z.toFixed(2)
    );

}

// ============================================================
// DISTANZ
// ============================================================

const TARGET_X = 309.35;
const TARGET_Z = 276.60;

function distanceToCB6() {

    if (
        !mcBot ||
        !mcBot.entity
    ) {

        return 999;

    }

    const p =
        mcBot.entity.position;

    return Math.sqrt(
        Math.pow(
            p.x - TARGET_X,
            2
        ) +
        Math.pow(
            p.z - TARGET_Z,
            2
        )
    );

}

// ============================================================
// LETZTE AKTION
// ============================================================

function setLastAction(action) {

    lastAction = action;

    console.log(
        "[MC] Aktion: " +
        action
    );

    updatePanel();

}

// ============================================================
// LAUFZEIT
// ============================================================

function getRuntime() {

    if (!afkStartedAt) {

        return "00:00:00";

    }

    const seconds =
        Math.floor(
            (
                Date.now() -
                afkStartedAt
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
// BEWEGUNG STOPPEN
// ============================================================

function stopMovement() {

    if (!mcBot) {
        return;
    }

    try {

        mcBot.clearControlStates();

        mcBot.setControlState(
            "forward",
            false
        );

        mcBot.setControlState(
            "back",
            false
        );

        mcBot.setControlState(
            "left",
            false
        );

        mcBot.setControlState(
            "right",
            false
        );

        mcBot.setControlState(
            "jump",
            false
        );

        mcBot.setControlState(
            "sprint",
            false
        );

    } catch {}

}

// ============================================================
// NORDEN
// ============================================================

async function lookNorth() {

    if (!mcBot) {
        return;
    }

    console.log(
        "[ROUTE] Drehe nach Norden."
    );

    await mcBot.look(
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
// VORWÄRTS
// ============================================================

async function moveForward(milliseconds) {

    if (
        !mcBot ||
        !portalRouteRunning
    ) {

        return;

    }

    mcBot.setControlState(
        "forward",
        true
    );

    mcBot.setControlState(
        "sprint",
        true
    );

    const start =
        Date.now();

    while (
        mcBot &&
        portalRouteRunning &&
        Date.now() - start < milliseconds
    ) {

        movements++;

        await sleep(50);

    }

    stopMovement();

}

// ============================================================
// SPRUNG
// ============================================================

async function jump() {

    if (
        !mcBot ||
        !portalRouteRunning
    ) {

        return;

    }

    console.log(
        "[ROUTE] Springe über die Kante..."
    );

    jumps++;

    mcBot.setControlState(
        "jump",
        true
    );

    await sleep(350);

    if (mcBot) {

        mcBot.setControlState(
            "jump",
            false
        );

    }

}

// ============================================================
// DISCORD PANEL
// ============================================================

function createPanel() {

    const online =
        !!(
            mcBot &&
            mcBot.player
        );

    const embed =
        new EmbedBuilder()
            .setTitle(
                "AFK Bot"
            )
            .setDescription(
                "GrieferGames AFK Kontrollzentrum"
            )
            .addFields(

                {
                    name: "Status",
                    value: online
                        ? "ONLINE"
                        : "OFFLINE",
                    inline: true
                },

                {
                    name: "Server",
                    value: MC_HOST,
                    inline: true
                },

                {
                    name: "Version",
                    value: MC_VERSION,
                    inline: true
                },

                {
                    name: "Position",
                    value: getPosition(),
                    inline: false
                },

                {
                    name: "Entfernung CB6",
                    value:
                        distanceToCB6().toFixed(2),
                    inline: true
                },

                {
                    name: "Laufzeit",
                    value: getRuntime(),
                    inline: true
                },

                {
                    name: "Letzte Aktion",
                    value: lastAction,
                    inline: false
                },

                {
                    name: "Statistik",
                    value:
                        "Bewegungen: " +
                        movements +
                        "\nSprünge: " +
                        jumps +
                        "\nReconnects: " +
                        reconnects +
                        "\nDisconnects: " +
                        disconnects,
                    inline: false
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
                        "afk_reconnect"
                    )
                    .setLabel(
                        "Reconnect"
                    )
                    .setStyle(
                        ButtonStyle.Primary
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

async function startMinecraft() {

    if (mcStarting) {

        console.log(
            "[MC] Minecraft startet bereits."
        );

        return;

    }

    if (mcBot) {

        console.log(
            "[MC] Minecraft läuft bereits."
        );

        return;

    }

    mcStarting = true;
    afkRunning = true;
    portalRouteRunning = false;

    if (!afkStartedAt) {

        afkStartedAt =
            Date.now();

    }

    restoreAuthCache();

    console.log(
        "========================================"
    );

    console.log(
        "        AFK SESSION START"
    );

    console.log(
        "========================================"
    );

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
        "[MC] Auth: " +
        MC_AUTH
    );

    console.log(
        "[MC] Version: " +
        MC_VERSION
    );

    console.log(
        "[MC] Auth Speicher: " +
        MC_AUTH_DIR
    );

    try {

        mcBot =
            mineflayer.createBot({

                host:
                    MC_HOST,

                port:
                    MC_PORT,

                username:
                    MC_EMAIL,

                auth:
                    MC_AUTH,

                version:
                    MC_VERSION,

                profilesFolder:
                    MC_AUTH_DIR

            });

        setupMinecraftEvents();

    } catch (error) {

        console.error(
            "[MC ERROR] Minecraft konnte nicht gestartet werden."
        );

        console.error(
            error
        );

        mcBot = null;
        mcStarting = false;

    }

}

// ============================================================
// MINECRAFT EVENTS
// ============================================================

function setupMinecraftEvents() {

    mcBot.once(
        "login",
        () => {

            mcStarting = false;

            console.log(
                "[MC] Minecraft Login erfolgreich."
            );

            setLastAction(
                "Minecraft Login erfolgreich"
            );

            exportAuthCache();

        }
    );

    mcBot.once(
        "spawn",
        async () => {

            console.log(
                "[MC] Minecraft Spawn erfolgreich."
            );

            console.log(
                "[MC] Position: " +
                getPosition()
            );

            setLastAction(
                "Minecraft Spawn erfolgreich"
            );

            await sleep(3000);

            if (
                mcBot &&
                afkRunning
            ) {

                await startCB6Route();

            }

        }
    );

    mcBot.on(
        "messagestr",
        message => {

            console.log(
                "[MC CHAT] " +
                message
            );

        }
    );

    mcBot.on(
        "error",
        error => {

            console.error(
                "[MC ERROR]"
            );

            console.error(
                error
            );

            setLastAction(
                "Minecraft Fehler"
            );

        }
    );

    mcBot.on(
        "kicked",
        reason => {

            console.log(
                "[MC] Bot wurde gekickt."
            );

            console.log(
                reason
            );

            disconnects++;

            setLastAction(
                "Minecraft gekickt"
            );

        }
    );

    mcBot.on(
        "end",
        () => {

            console.log(
                "[MC] Minecraft Verbindung beendet."
            );

            disconnects++;

            stopMovement();

            mcBot = null;
            mcStarting = false;
            portalRouteRunning = false;

            setLastAction(
                "Minecraft Verbindung beendet"
            );

            if (
                afkRunning &&
                !reconnectTimer
            ) {

                reconnects++;

                reconnectTimer =
                    setTimeout(
                        () => {

                            reconnectTimer =
                                null;

                            if (
                                afkRunning &&
                                !mcBot
                            ) {

                                startMinecraft();

                            }

                        },
                        5000
                    );

            }

        }
    );

}

// ============================================================
// CB6 ROUTE
// ============================================================

async function startCB6Route() {

    if (
        !mcBot ||
        portalRouteRunning
    ) {

        return;

    }

    portalRouteRunning = true;

    console.log(
        "========================================"
    );

    console.log(
        "        CB6 ROUTE"
    );

    console.log(
        "========================================"
    );

    // --------------------------------------------------------
    // /portal
    // --------------------------------------------------------

    console.log(
        "[PORTAL] Sende /portal..."
    );

    setLastAction(
        "/portal"
    );

    mcBot.chat(
        "/portal"
    );

    await sleep(4000);

    if (
        !mcBot ||
        !portalRouteRunning
    ) {

        return;

    }

    console.log(
        "[PORTAL] Portalraum geladen."
    );

    console.log(
        "[PORTAL] Position: " +
        getPosition()
    );

    // --------------------------------------------------------
    // NORDEN
    // --------------------------------------------------------

    await lookNorth();

    // --------------------------------------------------------
    // FESTER WEG
    // --------------------------------------------------------

    console.log(
        "[ROUTE] Starte festen Weg zum CB6 Portal."
    );

    setLastAction(
        "Laufe zum CB6 Portal"
    );

    await moveForward(900);

    if (
        !mcBot ||
        !portalRouteRunning
    ) {

        return;

    }

    console.log(
        "[ROUTE] Kante erreicht."
    );

    await jump();

    if (
        !mcBot ||
        !portalRouteRunning
    ) {

        return;

    }

    await moveForward(850);

    if (
        !mcBot ||
        !portalRouteRunning
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

    await moveForward(900);

    stopMovement();

    if (
        !mcBot ||
        !portalRouteRunning
    ) {

        return;

    }

    // --------------------------------------------------------
    // CB6 PORTAL
    // --------------------------------------------------------

    console.log(
        "========================================"
    );

    console.log(
        "        CB6 PORTAL ERREICHT"
    );

    console.log(
        "========================================"
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );

    setLastAction(
        "CB6 Portal erreicht"
    );

    // --------------------------------------------------------
    // 12 SEKUNDEN
    // --------------------------------------------------------

    console.log(
        "[ROUTE] Warte 12 Sekunden..."
    );

    setLastAction(
        "Warte 12 Sekunden"
    );

    for (
        let i = 12;
        i >= 1;
        i--
    ) {

        console.log(
            "[ROUTE] Noch " +
            i +
            " Sekunden."
        );

        await sleep(1000);

        if (
            !mcBot ||
            !portalRouteRunning
        ) {

            return;

        }

    }

    // --------------------------------------------------------
    // /home 55
    // --------------------------------------------------------

    console.log(
        "[CB6] Sende /home 55..."
    );

    setLastAction(
        "/home 55"
    );

    mcBot.chat(
        "/home 55"
    );

    portalRouteRunning = false;

    console.log(
        "[CB6] /home 55 gesendet."
    );

    setLastAction(
        "/home 55 gesendet"
    );

}

// ============================================================
// STOPP
// ============================================================

function stopMinecraft() {

    afkRunning = false;
    portalRouteRunning = false;

    if (reconnectTimer) {

        clearTimeout(
            reconnectTimer
        );

        reconnectTimer = null;

    }

    stopMovement();

    if (mcBot) {

        try {

            mcBot.quit(
                "AFK Bot gestoppt"
            );

        } catch {}

    }

    mcBot = null;
    mcStarting = false;
    afkStartedAt = null;

    setLastAction(
        "AFK gestoppt"
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

            console.error(
                error
            );

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

        // ----------------------------------------------------
        // START
        // ----------------------------------------------------

        if (
            interaction.customId ===
            "afk_start"
        ) {

            console.log(
                "[DISCORD] AFK Start gedrückt."
            );

            afkRunning = true;

            if (!afkStartedAt) {

                afkStartedAt =
                    Date.now();

            }

            await interaction.reply({

                content:
                    "AFK Bot wird gestartet.",

                ephemeral:
                    true

            });

            updatePanel();

            if (
                !mcBot &&
                !mcStarting
            ) {

                startMinecraft();

            }

            return;

        }

        // ----------------------------------------------------
        // STOPP
        // ----------------------------------------------------

        if (
            interaction.customId ===
            "afk_stop"
        ) {

            stopMinecraft();

            await interaction.reply({

                content:
                    "AFK Bot wurde gestoppt.",

                ephemeral:
                    true

            });

            return;

        }

        // ----------------------------------------------------
        // RECONNECT
        // ----------------------------------------------------

        if (
            interaction.customId ===
            "afk_reconnect"
        ) {

            stopMinecraft();

            afkRunning = true;

            afkStartedAt =
                Date.now();

            await interaction.reply({

                content:
                    "Minecraft wird neu verbunden.",

                ephemeral:
                    true

            });

            await sleep(1000);

            startMinecraft();

            return;

        }

        // ----------------------------------------------------
        // POSITION
        // ----------------------------------------------------

        if (
            interaction.customId ===
            "afk_position"
        ) {

            await interaction.reply({

                content:
                    "Position: " +
                    getPosition(),

                ephemeral:
                    true

            });

            return;

        }

        // ----------------------------------------------------
        // REFRESH
        // ----------------------------------------------------

        if (
            interaction.customId ===
            "afk_refresh"
        ) {

            await interaction.update(
                createPanel()
            );

        }

    }
);

// ============================================================
// START
// ============================================================

console.log(
    "========================================"
);

console.log(
    "        GRIEFERGAMES AFK BOT"
);

console.log(
    "========================================"
);

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
    "[SYSTEM] Minecraft Version: " +
    MC_VERSION
);

console.log(
    "[SYSTEM] Minecraft Auth: " +
    MC_AUTH
);

console.log(
    "[SYSTEM] Auth Cache: " +
    (
        MC_AUTH_CACHE
            ? "vorhanden"
            : "nicht vorhanden"
    )
);

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

            console.error(
                error
            );

            process.exit(1);

        }
    );

// ============================================================
// PANEL TIMER
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
// FEHLER
// ============================================================

process.on(
    "uncaughtException",
    error => {

        console.error(
            "[SYSTEM ERROR] Uncaught Exception:"
        );

        console.error(
            error
        );

    }
);

process.on(
    "unhandledRejection",
    error => {

        console.error(
            "[SYSTEM ERROR] Unhandled Rejection:"
        );

        console.error(
            error
        );

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

require("dotenv").config();

const mineflayer = require("mineflayer");

const {
    pathfinder
} = require("mineflayer-pathfinder");

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
    process.env.MC_USERNAME ||
    "r.guse858@gmail.com";

const MC_HOST =
    process.env.MC_HOST ||
    "griefergames.net";

const MC_PORT =
    Number(
        process.env.MC_PORT ||
        25565
    );

const MC_AUTH =
    "microsoft";

// WICHTIG
// Genau wie beim alten BDT Bot

const MC_VERSION =
    "1.8.9";

const MC_AUTH_DIR =
    "./minecraft-auth";

// ============================================================
// STATUS
// ============================================================

let mcBot =
    null;

let discordClient =
    null;

let mcStarting =
    false;

let afkRunning =
    false;

let portalRouteRunning =
    false;

let panelMessage =
    null;

let afkStartedAt =
    null;

let reconnectTimer =
    null;

let lastAction =
    "Noch keine";

let movements =
    0;

let jumps =
    0;

let reconnects =
    0;

let disconnects =
    0;

// ============================================================
// ROUTEN STATUS
// ============================================================

let portalSent =
    false;

let portalReached =
    false;

let homeSent =
    false;

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

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
// DISTANZ CB6
// ============================================================

const TARGET_X =
    309.35;

const TARGET_Z =
    276.60;

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

function setLastAction(
    action
) {

    lastAction =
        action;

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
        String(hours).padStart(
            2,
            "0"
        ) +
        ":" +
        String(minutes).padStart(
            2,
            "0"
        ) +
        ":" +
        String(secs).padStart(
            2,
            "0"
        )
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
// BLICKRICHTUNG NORDEN
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

    await sleep(
        500
    );

    console.log(
        "[ROUTE] Blickrichtung gesetzt."
    );

}

// ============================================================
// VORWÄRTS LAUFEN
// ============================================================

async function moveForward(
    milliseconds
) {

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

        Date.now() -
        start <
        milliseconds

    ) {

        movements++;

        await sleep(
            50
        );

    }

    stopMovement();

}

// ============================================================
// SPRINGEN
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

    await sleep(
        350
    );

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
                    name:
                        "Status",

                    value:
                        online
                            ? "ONLINE"
                            : "OFFLINE",

                    inline:
                        true
                },

                {
                    name:
                        "Server",

                    value:
                        MC_HOST,

                    inline:
                        true
                },

                {
                    name:
                        "Version",

                    value:
                        MC_VERSION,

                    inline:
                        true
                },

                {
                    name:
                        "Position",

                    value:
                        getPosition(),

                    inline:
                        false
                },

                {
                    name:
                        "Entfernung CB6",

                    value:
                        distanceToCB6()
                            .toFixed(2),

                    inline:
                        true
                },

                {
                    name:
                        "Laufzeit",

                    value:
                        getRuntime(),

                    inline:
                        true
                },

                {
                    name:
                        "Letzte Aktion",

                    value:
                        lastAction,

                    inline:
                        false
                },

                {
                    name:
                        "Statistik",

                    value:
                        "Bewegungen: " +
                        movements +
                        "\nSprünge: " +
                        jumps +
                        "\nReconnects: " +
                        reconnects +
                        "\nDisconnects: " +
                        disconnects,

                    inline:
                        false
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

        embeds:
            [
                embed
            ],

        components:
            [
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
            "[MC] Minecraft Bot startet bereits."
        );

        return;

    }

    if (mcBot) {

        console.log(
            "[MC] Minecraft Bot läuft bereits."
        );

        return;

    }

    mcStarting =
        true;

    afkRunning =
        true;

    portalRouteRunning =
        false;

    portalSent =
        false;

    portalReached =
        false;

    homeSent =
        false;

    if (!afkStartedAt) {

        afkStartedAt =
            Date.now();

    }

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

        mcBot.loadPlugin(
            pathfinder
        );

        setupMinecraftEvents();

    } catch (error) {

        console.error(
            "[MC ERROR] Minecraft konnte nicht gestartet werden."
        );

        console.error(
            error
        );

        mcBot =
            null;

        mcStarting =
            false;

    }

}

// ============================================================
// MINECRAFT EVENTS
// ============================================================

function setupMinecraftEvents() {

    mcBot.once(
        "login",
        () => {

            mcStarting =
                false;

            console.log(
                "[MC] Minecraft Login erfolgreich."
            );

            console.log(
                "[MC] GrieferGames Verbindung hergestellt."
            );

            setLastAction(
                "Minecraft Login erfolgreich"
            );

        }
    );

    mcBot.once(
        "spawn",
        async () => {

            console.log(
                "========================================"
            );

            console.log(
                "        BOT IM HUB"
            );

            console.log(
                "========================================"
            );

            console.log(
                "[MC] Position: " +
                getPosition()
            );

            setLastAction(
                "Minecraft Spawn erfolgreich"
            );

            if (!afkRunning) {

                return;

            }

            await sleep(
                3000
            );

            if (!mcBot) {

                return;

            }

            await startCB6Route();

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
        "move",
        () => {

            movements++;

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
        "end",
        () => {

            console.log(
                "[MC] Minecraft Verbindung beendet."
            );

            disconnects++;

            stopMovement();

            mcBot =
                null;

            mcStarting =
                false;

            portalRouteRunning =
                false;

            setLastAction(
                "Minecraft Verbindung beendet"
            );

            if (
                afkRunning &&
                !reconnectTimer
            ) {

                reconnects++;

                console.log(
                    "[MC] Reconnect in 5 Sekunden."
                );

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

    if (!mcBot) {

        return;

    }

    if (portalRouteRunning) {

        return;

    }

    portalRouteRunning =
        true;

    console.log(
        ""
    );

    console.log(
        "========================================"
    );

    console.log(
        "        CB6 ROUTE"
    );

    console.log(
        "========================================"
    );

    console.log(
        "[ROUTE] Aktuelle Position:"
    );

    console.log(
        "[ROUTE] " +
        getPosition()
    );

    // ========================================================
    // /PORTAL
    // ========================================================

    console.log(
        ""
    );

    console.log(
        "[PORTAL] Sende /portal..."
    );

    setLastAction(
        "/portal"
    );

    portalSent =
        true;

    mcBot.chat(
        "/portal"
    );

    await sleep(
        4000
    );

    if (
        !mcBot ||
        !portalRouteRunning
    ) {

        return;

    }

    console.log(
        "[PORTAL] Portalraum sollte jetzt geladen sein."
    );

    console.log(
        "[PORTAL] Position: " +
        getPosition()
    );

    // ========================================================
    // NORDEN
    // ========================================================

    await lookNorth();

    if (
        !mcBot ||
        !portalRouteRunning
    ) {

        return;

    }

    console.log(
        "[ROUTE] Starte den festen Weg über die Kante."
    );

    setLastAction(
        "Laufe zum CB6 Portal"
    );

    // ========================================================
    // ERSTER ABSCHNITT
    // ========================================================

    console.log(
        "[ROUTE] Laufe nach Norden..."
    );

    await moveForward(
        900
    );

    if (
        !mcBot ||
        !portalRouteRunning
    ) {

        return;

    }

    // ========================================================
    // KANTE
    // ========================================================

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

    // ========================================================
    // ÜBER DIE KANTE
    // ========================================================

    console.log(
        "[ROUTE] Laufe über die Kante..."
    );

    await moveForward(
        850
    );

    if (
        !mcBot ||
        !portalRouteRunning
    ) {

        return;

    }

    stopMovement();

    console.log(
        "[ROUTE] Kante überquert."
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );

    await sleep(
        500
    );

    // ========================================================
    // ENDSPRINT
    // ========================================================

    console.log(
        "[ROUTE] Laufe weiter zum CB6 Portal..."
    );

    await moveForward(
        900
    );

    stopMovement();

    if (
        !mcBot ||
        !portalRouteRunning
    ) {

        return;

    }

    // ========================================================
    // PORTAL ERREICHT
    // ========================================================

    portalReached =
        true;

    console.log(
        ""
    );

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

    console.log(
        "[ROUTE] Entfernung zum Ziel: " +
        distanceToCB6().toFixed(2)
    );

    setLastAction(
        "CB6 Portal erreicht"
    );

    // ========================================================
    // 12 SEKUNDEN WARTEN
    // ========================================================

    console.log(
        ""
    );

    console.log(
        "[ROUTE] Warte 12 Sekunden..."
    );

    setLastAction(
        "Warte 12 Sekunden am CB6 Portal"
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

        await sleep(
            1000
        );

        if (
            !mcBot ||
            !portalRouteRunning
        ) {

            return;

        }

    }

    console.log(
        "[ROUTE] 12 Sekunden vorbei."
    );

    // ========================================================
    // /HOME 55
    // ========================================================

    console.log(
        ""
    );

    console.log(
        "[CB6] Sende /home 55..."
    );

    setLastAction(
        "/home 55"
    );

    mcBot.chat(
        "/home 55"
    );

    homeSent =
        true;

    portalRouteRunning =
        false;

    console.log(
        "[CB6] /home 55 gesendet."
    );

    console.log(
        "[CB6] Ablauf abgeschlossen."
    );

    await sleep(
        3000
    );

    updatePanel();

}

// ============================================================
// MINECRAFT STOPP
// ============================================================

function stopMinecraft() {

    console.log(
        "[MC] Stoppe Minecraft Bot..."
    );

    afkRunning =
        false;

    portalRouteRunning =
        false;

    portalSent =
        false;

    portalReached =
        false;

    homeSent =
        false;

    afkStartedAt =
        null;

    stopMovement();

    if (reconnectTimer) {

        clearTimeout(
            reconnectTimer
        );

        reconnectTimer =
            null;

    }

    if (mcBot) {

        try {

            mcBot.quit(
                "AFK Bot gestoppt"
            );

        } catch {}

    }

    mcBot =
        null;

    mcStarting =
        false;

    setLastAction(
        "AFK gestoppt"
    );

    updatePanel();

}

// ============================================================
// DISCORD CLIENT
// ============================================================

discordClient =
    new Client({

        intents: [

            GatewayIntentBits.Guilds,

            GatewayIntentBits.GuildMessages,

            GatewayIntentBits.MessageContent

        ]

    });

// ============================================================
// DISCORD READY
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
                "[DISCORD ERROR] Panel konnte nicht erstellt werden."
            );

            console.error(
                error
            );

        }

    }
);

// ============================================================
// DISCORD BUTTONS
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

                flags:
                    64

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

            afkRunning =
                true;

            if (!afkStartedAt) {

                afkStartedAt =
                    Date.now();

            }

            await interaction.reply({

                content:
                    "AFK Bot wird gestartet.",

                flags:
                    64

            });

            updatePanel();

            if (
                !mcBot &&
                !mcStarting
            ) {

                await startMinecraft();

            } else if (
                mcBot &&
                mcBot.entity &&
                !portalRouteRunning
            ) {

                await startCB6Route();

            }

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

                flags:
                    64

            });

            return;

        }

        // ====================================================
        // RECONNECT
        // ====================================================

        if (
            interaction.customId ===
            "afk_reconnect"
        ) {

            console.log(
                "[DISCORD] Reconnect gedrückt."
            );

            stopMinecraft();

            afkRunning =
                true;

            afkStartedAt =
                Date.now();

            await interaction.reply({

                content:
                    "Minecraft wird neu verbunden.",

                flags:
                    64

            });

            await sleep(
                1000
            );

            startMinecraft();

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
                    "Position: " +
                    getPosition(),

                flags:
                    64

            });

            return;

        }

        // ====================================================
        // AKTUALISIEREN
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
    "[SYSTEM] Microsoft Auth Speicher: " +
    MC_AUTH_DIR
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

            process.exit(
                1
            );

        }
    );

// ============================================================
// PANEL AKTUALISIEREN
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

        console.log(
            "[SYSTEM] SIGTERM erhalten."

        );

        stopMinecraft();

        if (discordClient) {

            discordClient.destroy();

        }

        process.exit(
            0
        );

    }
);

process.on(
    "SIGINT",
    () => {

        console.log(
            "[SYSTEM] SIGINT erhalten."
        );

        stopMinecraft();

        if (discordClient) {

            discordClient.destroy();

        }

        process.exit(
            0
        );

    }
);

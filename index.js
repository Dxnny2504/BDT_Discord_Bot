require("dotenv").config();

const fs = require("fs");
const path = require("path");
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
    process.env.MC_USERNAME;

const MC_HOST =
    process.env.MC_HOST ||
    "play.griefergames.net";

const MC_PORT =
    Number(process.env.MC_PORT || 25565);

const MC_AUTH =
    process.env.MC_AUTH ||
    "microsoft";

// ============================================================
// MICROSOFT AUTH SPEICHER
// ============================================================

const RAILWAY_VOLUME_MOUNT_PATH =
    process.env.RAILWAY_VOLUME_MOUNT_PATH;

const MC_AUTH_DIR =
    process.env.MC_AUTH_DIR ||
    (
        RAILWAY_VOLUME_MOUNT_PATH
            ? path.join(
                RAILWAY_VOLUME_MOUNT_PATH,
                "minecraft_profiles"
            )
            : "/app/minecraft_profiles"
    );

try {
    fs.mkdirSync(
        MC_AUTH_DIR,
        {
            recursive: true
        }
    );
} catch (error) {
    console.error(
        "[MC ERROR] Auth Ordner konnte nicht erstellt werden."
    );

    console.error(error);
}

// ============================================================
// STATUS
// ============================================================

let mcBot = null;

let discordClient = null;

let afkRunning = false;

let mcStarting = false;

let portalRouteRunning = false;

let portalEntered = false;

let panelMessage = null;

let afkStartedAt = null;

let reconnectTimer = null;

let lastAction = "Noch keine";

let movements = 0;

let jumps = 0;

let reconnects = 0;

let disconnects = 0;

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function sleep(ms) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}

function getPosition() {

    if (
        !mcBot ||
        !mcBot.entity
    ) {
        return "Unbekannt";
    }

    return (
        "X " +
        mcBot.entity.position.x.toFixed(2) +
        " Y " +
        mcBot.entity.position.y.toFixed(2) +
        " Z " +
        mcBot.entity.position.z.toFixed(2)
    );
}

function setLastAction(action) {

    lastAction = action;

    console.log(
        "[MC] Aktion: " +
        action
    );

    updatePanel();
}

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

    } catch (error) {
    }
}

// ============================================================
// NORDEN
// ============================================================

async function lookNorth() {

    if (!mcBot) {
        return;
    }

    await mcBot.look(
        0,
        0,
        true
    );

    console.log(
        "[ROUTE] Blickrichtung nach Norden gesetzt."
    );
}

// ============================================================
// VORWÄRTS LAUFEN
// ============================================================

async function moveForward(ms) {

    if (!mcBot) {
        return;
    }

    if (!portalRouteRunning) {
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
        Date.now() - start < ms
    ) {

        movements++;

        await sleep(50);
    }

    stopMovement();
}

// ============================================================
// SPRINGEN
// ============================================================

async function jump() {

    if (!mcBot) {
        return;
    }

    if (!portalRouteRunning) {
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
            .setTitle("AFK Bot")
            .setDescription(
                "GrieferGames AFK Kontrollzentrum"
            )
            .addFields(
                {
                    name: "Status",
                    value:
                        online
                            ? "ONLINE"
                            : "OFFLINE",
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
                    name: "Letzte Aktion",
                    value:
                        lastAction,
                    inline: true
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
        embeds: [embed],
        components: [row]
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

    } catch (error) {

        console.log(
            "[DISCORD] Panel konnte nicht aktualisiert werden."
        );
    }
}

// ============================================================
// MINECRAFT STARTEN
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

    if (!MC_EMAIL) {

        console.log(
            "[MC ERROR] MC_EMAIL beziehungsweise MC_USERNAME fehlt."
        );

        return;
    }

    mcStarting = true;

    afkRunning = true;

    portalRouteRunning = false;

    portalEntered = false;

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

                profilesFolder:
                    MC_AUTH_DIR,

                version:
                    false
            });

        mcBot.loadPlugin(
            pathfinder
        );

        setupMinecraftEvents();

    } catch (error) {

        console.error(
            "[MC ERROR] Minecraft konnte nicht gestartet werden."
        );

        console.error(error);

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
        }
    );

    mcBot.once(
        "spawn",
        async () => {

            console.log(
                "[MC] Minecraft Spawn erfolgreich."
            );

            console.log(
                "[MC] AFK Bot ist jetzt auf dem Server."
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

            await sleep(2000);

            if (!mcBot) {
                return;
            }

            await runCB6Route();
        }
    );

    mcBot.on(
        "message",
        message => {

            const text =
                message.toString();

            console.log(
                "[MC CHAT] " +
                text
            );
        }
    );

    mcBot.on(
        "kicked",
        reason => {

            console.log(
                "[MC] Bot wurde gekickt:"
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

            mcBot = null;

            mcStarting = false;

            stopMovement();

            setLastAction(
                "Minecraft Verbindung beendet"
            );

            if (
                afkRunning &&
                !reconnectTimer
            ) {

                console.log(
                    "[MC] Reconnect wird vorbereitet."
                );

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

async function runCB6Route() {

    if (!mcBot) {

        console.log(
            "[ROUTE] Kein Minecraft Bot vorhanden."
        );

        return;
    }

    if (portalRouteRunning) {

        console.log(
            "[ROUTE] Route läuft bereits."
        );

        return;
    }

    portalRouteRunning =
        true;

    portalEntered =
        false;

    console.log(
        ""
    );

    console.log(
        "========================================"
    );

    console.log(
        "        CB6 PORTAL ROUTE"
    );

    console.log(
        "========================================"
    );

    console.log(
        "[ROUTE] Aktuelle Position: " +
        getPosition()
    );

    // ========================================================
    // /PORTAL
    // ========================================================

    console.log(
        "[ROUTE] Sende /portal..."
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
        "[ROUTE] Portalraum sollte jetzt geladen sein."
    );

    console.log(
        "[ROUTE] Position: " +
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
        "[ROUTE] Starte festen Weg über die Kante."
    );

    setLastAction(
        "Fester Weg zum CB6 Portal"
    );

    // ========================================================
    // ERSTER WEG
    // ========================================================

    console.log(
        "[ROUTE] Laufe 900 ms nach vorne."
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
    // SPRUNG
    // ========================================================

    await jump();

    if (
        !mcBot ||
        !portalRouteRunning
    ) {
        return;
    }

    // ========================================================
    // ZWEITER WEG
    // ========================================================

    console.log(
        "[ROUTE] Laufe weitere 850 ms."
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
        300
    );

    if (
        !mcBot ||
        !portalRouteRunning
    ) {
        return;
    }

    // ========================================================
    // ENDLAUF
    // ========================================================

    console.log(
        "[ROUTE] Endlauf zum CB6 Portal."
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

    console.log(
        "[ROUTE] CB6 Portal erreicht."
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );

    setLastAction(
        "CB6 Portal erreicht"
    );

    portalEntered =
        true;

    // ========================================================
    // 12 SEKUNDEN
    // ========================================================

    console.log(
        "[ROUTE] Warte 12 Sekunden."
    );

    setLastAction(
        "Warte 12 Sekunden am CB6 Portal"
    );

    await sleep(
        12000
    );

    if (
        !mcBot ||
        !portalRouteRunning
    ) {
        return;
    }

    console.log(
        "[ROUTE] 12 Sekunden vorbei."
    );

    // ========================================================
    // HOME 55
    // ========================================================

    console.log(
        "[ROUTE] Sende /home 55."
    );

    setLastAction(
        "/home 55"
    );

    mcBot.chat(
        "/home 55"
    );

    portalRouteRunning =
        false;

    portalEntered =
        true;

    console.log(
        "[ROUTE] /home 55 gesendet."
    );

    console.log(
        "[ROUTE] CB6 Ablauf abgeschlossen."
    );

    await sleep(
        3000
    );

    updatePanel();
}

// ============================================================
// MINECRAFT STOPPEN
// ============================================================

function stopMinecraft() {

    portalRouteRunning =
        false;

    portalEntered =
        false;

    afkRunning =
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

        } catch (error) {
        }
    }

    mcBot =
        null;

    mcStarting =
        false;

    setLastAction(
        "AFK gestoppt"
    );

    console.log(
        "[MC] AFK Bot gestoppt."
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
            `[DISCORD] Bot online: ${discordClient.user.tag}`
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

        if (message.author.bot) {
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
                flags: 64
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
                flags: 64
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

                await runCB6Route();
            }

            return;
        }

        // ====================================================
        // STOP
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
                flags: 64
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
                flags: 64
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
                flags: 64
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
    "[SYSTEM] Minecraft Version: automatisch"
);

console.log(
    "[SYSTEM] Starte Discord Login..."
);

console.log(
    "[MC] Microsoft Auth Speicher: " +
    MC_AUTH_DIR
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
// PANEL AUTOMATISCH AKTUALISIEREN
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

        process.exit(0);
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

        process.exit(0);
    }
);

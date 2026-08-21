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

const {
    pathfinder,
    Movements,
    goals
} = require("mineflayer-pathfinder");

const { GoalNear } = goals;

// ============================================================
// KONFIGURATION
// ============================================================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_OWNER_ID = process.env.DISCORD_OWNER_ID;

const MC_USERNAME = process.env.MC_USERNAME;
const MC_HOST = process.env.MC_HOST || "play.griefergames.net";
const MC_PORT = Number(process.env.MC_PORT || 25565);
const MC_AUTH = process.env.MC_AUTH || "microsoft";

// WICHTIG:
// Railway Variable:
// MC_AUTH_DIR=/data/minecraft_profiles
//
// Falls die Variable fehlt, wird /app/minecraft_profiles verwendet.
const MC_AUTH_DIR =
    process.env.MC_AUTH_DIR || "/app/minecraft_profiles";

// ============================================================
// ORDNER FÜR MICROSOFT AUTH ERSTELLEN
// ============================================================

try {
    fs.mkdirSync(MC_AUTH_DIR, {
        recursive: true
    });

    console.log(`[MC] Microsoft Auth Speicher: ${MC_AUTH_DIR}`);
} catch (error) {
    console.error("[MC ERROR] Konnte Auth Ordner nicht erstellen:");
    console.error(error);
}

// ============================================================
// STATUS
// ============================================================

let mcBot = null;
let discordClient = null;

let afkRunning = false;
let connecting = false;

let sessionStartedAt = null;
let lastAction = "Noch keine";

let movements = 0;
let jumps = 0;
let reconnects = 0;
let disconnects = 0;

let navigationStarted = false;
let portalReached = false;

let afkPanelMessage = null;

// ============================================================
// CB6 KOORDINATEN
// ============================================================

// Bereich nach /portal
const PORTAL_AREA = {
    x: 325,
    y: 67,
    z: 280
};

// CB6 Portal
const CB6_PORTAL = {
    x: 309.348,
    y: 67,
    z: 276.376
};

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setLastAction(action) {
    lastAction = action;
    console.log(`[MC] Aktion: ${action}`);
}

function getRuntime() {
    if (!sessionStartedAt) {
        return "00:00:00";
    }

    const seconds = Math.floor(
        (Date.now() - sessionStartedAt) / 1000
    );

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return (
        String(h).padStart(2, "0") +
        ":" +
        String(m).padStart(2, "0") +
        ":" +
        String(s).padStart(2, "0")
    );
}

// ============================================================
// DISCORD PANEL
// ============================================================

function createPanelEmbed() {
    const online = mcBot && mcBot.player;

    let position = "Unbekannt";

    if (mcBot && mcBot.entity) {
        position =
            `${mcBot.entity.position.x.toFixed(1)}, ` +
            `${mcBot.entity.position.y.toFixed(1)}, ` +
            `${mcBot.entity.position.z.toFixed(1)}`;
    }

    return new EmbedBuilder()
        .setTitle("🤖 AFK Bot")
        .setDescription("GrieferGames AFK Kontrollzentrum")
        .addFields(
            {
                name: "📡 Status",
                value: online
                    ? "🟢 ONLINE"
                    : "🔴 OFFLINE",
                inline: true
            },
            {
                name: "🌐 Server",
                value: MC_HOST,
                inline: true
            },
            {
                name: "🔌 Verbindung",
                value: online
                    ? "🟢 Online"
                    : "🔴 Offline",
                inline: true
            },
            {
                name: "📍 Position",
                value: position,
                inline: false
            },
            {
                name: "⏱️ Laufzeit",
                value: getRuntime(),
                inline: true
            },
            {
                name: "⚡ Letzte Aktion",
                value: lastAction,
                inline: true
            },
            {
                name: "📊 AFK Statistik",
                value:
                    `Bewegungen: ${movements}\n` +
                    `Sprünge: ${jumps}\n` +
                    `Reconnects: ${reconnects}\n` +
                    `Disconnects: ${disconnects}`,
                inline: false
            }
        )
        .setFooter({
            text: "AFK Control"
        })
        .setTimestamp();
}

function createPanelButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("afk_start")
            .setLabel("AFK Start")
            .setEmoji("🟢")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("afk_stop")
            .setLabel("AFK Stopp")
            .setEmoji("🔴")
            .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
            .setCustomId("afk_reconnect")
            .setLabel("Reconnect")
            .setEmoji("🔄")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("afk_position")
            .setLabel("Position")
            .setEmoji("📍")
            .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
            .setCustomId("afk_refresh")
            .setLabel("Aktualisieren")
            .setEmoji("📊")
            .setStyle(ButtonStyle.Secondary)
    );
}

async function updatePanel() {
    if (!afkPanelMessage) {
        return;
    }

    try {
        await afkPanelMessage.edit({
            embeds: [createPanelEmbed()],
            components: [createPanelButtons()]
        });
    } catch (error) {
        console.error("[DISCORD ERROR] Panel konnte nicht aktualisiert werden:");
        console.error(error.message);
    }
}

// ============================================================
// MINECRAFT BOT STARTEN
// ============================================================

async function startMinecraft() {
    if (connecting) {
        console.log("[MC] Verbindung läuft bereits.");
        return;
    }

    if (mcBot) {
        console.log("[MC] Minecraft Bot läuft bereits.");
        return;
    }

    connecting = true;

    console.log("========================================");
    console.log("        AFK SESSION START");
    console.log("========================================");

    console.log("[MC] Starte Minecraft Bot...");
    console.log(`[MC] Account: ${MC_USERNAME}`);
    console.log(`[MC] Host: ${MC_HOST}`);
    console.log(`[MC] Port: ${MC_PORT}`);
    console.log(`[MC] Auth: ${MC_AUTH}`);
    console.log(`[MC] Auth Speicher: ${MC_AUTH_DIR}`);

    try {
        mcBot = mineflayer.createBot({
            host: MC_HOST,
            port: MC_PORT,
            username: MC_USERNAME,
            auth: MC_AUTH,

            // HIER ist der wichtige Teil:
            // Microsoft Login wird im Railway Volume gespeichert.
            profilesFolder: MC_AUTH_DIR,

            version: false
        });

        mcBot.loadPlugin(pathfinder);

        setupMinecraftEvents();

    } catch (error) {
        connecting = false;

        console.error("[MC ERROR] Minecraft konnte nicht gestartet werden:");
        console.error(error);

        mcBot = null;
    }
}

// ============================================================
// MINECRAFT EVENTS
// ============================================================

function setupMinecraftEvents() {

    mcBot.once("login", () => {
        connecting = false;

        console.log("[MC] Minecraft Login erfolgreich.");

        setLastAction("Minecraft Login");

        updatePanel();
    });

    mcBot.once("spawn", async () => {

        console.log("[MC] Minecraft Spawn erfolgreich.");
        console.log("[MC] AFK Bot ist jetzt auf dem Server.");

        setLastAction("Spawn erfolgreich");

        sessionStartedAt = Date.now();

        updatePanel();

        if (!afkRunning) {
            console.log("[MC] AFK wurde noch nicht gestartet.");
            return;
        }

        await startGrieferGamesRoute();
    });

    mcBot.on("message", message => {
        const text = message.toString();

        console.log(`[MC CHAT] ${text}`);

        handleMinecraftChat(text);
    });

    mcBot.on("kicked", reason => {
        console.log("[MC] Bot wurde gekickt:");
        console.log(reason);

        disconnects++;

        setLastAction("Gekickt");

        updatePanel();
    });

    mcBot.on("end", () => {

        console.log("[MC] Minecraft Verbindung beendet.");

        disconnects++;

        setLastAction("Verbindung beendet");

        connecting = false;

        mcBot = null;

        updatePanel();

        if (afkRunning) {
            console.log("[MC] AFK läuft noch.");
            console.log("[MC] Reconnect wird vorbereitet.");

            reconnects++;

            setTimeout(() => {

                if (afkRunning && !mcBot) {
                    startMinecraft();
                }

            }, 5000);
        }
    });

    mcBot.on("error", error => {

        console.error("[MC ERROR]", error);

        setLastAction("Minecraft Fehler");

        updatePanel();
    });

    mcBot.on("move", () => {
        movements++;
    });
}

// ============================================================
// CHAT VERARBEITEN
// ============================================================

function handleMinecraftChat(text) {

    const lower = text.toLowerCase();

    // Nach /portal warten wir auf die Portalwelt
    if (
        navigationStarted &&
        (
            lower.includes("portal") ||
            lower.includes("teleport")
        )
    ) {
        console.log("[MC] Portal Nachricht erkannt.");
    }
}

// ============================================================
// GRIEFERGAMES ROUTE
// ============================================================

async function startGrieferGamesRoute() {

    if (!mcBot || !mcBot.entity) {
        console.log("[MC] Noch keine Entity vorhanden.");
        return;
    }

    if (navigationStarted) {
        console.log("[MC] Navigation läuft bereits.");
        return;
    }

    navigationStarted = true;
    portalReached = false;

    console.log("========================================");
    console.log("        GRIEFERGAMES ROUTE");
    console.log("========================================");

    // --------------------------------------------------------
    // /portal
    // --------------------------------------------------------

    console.log("[MC] Sende /portal...");

    setLastAction("/portal");

    mcBot.chat("/portal");

    await sleep(3000);

    if (!mcBot || !mcBot.entity) {
        return;
    }

    // --------------------------------------------------------
    // Bewegungen vorbereiten
    // --------------------------------------------------------

    console.log("[MC] Warte auf Portalbereich...");

    await sleep(2000);

    if (!mcBot || !mcBot.entity) {
        return;
    }

    const defaultMovements =
        new Movements(mcBot);

    defaultMovements.canDig = false;
    defaultMovements.allow1by1towers = false;
    defaultMovements.allowParkour = true;
    defaultMovements.allowFreeMotion = false;

    mcBot.pathfinder.setMovements(
        defaultMovements
    );

    // --------------------------------------------------------
    // Zum CB6 Portal
    // --------------------------------------------------------

    console.log(
        `[MC] Laufe zum CB6 Portal: ` +
        `${CB6_PORTAL.x}, ` +
        `${CB6_PORTAL.y}, ` +
        `${CB6_PORTAL.z}`
    );

    setLastAction("Laufe zum CB6 Portal");

    const goal = new GoalNear(
        CB6_PORTAL.x,
        CB6_PORTAL.y,
        CB6_PORTAL.z,
        1.5
    );

    try {

        await mcBot.pathfinder.goto(goal);

        console.log("[MC] CB6 Portal erreicht.");

        portalReached = true;

        setLastAction("CB6 Portal erreicht");

        updatePanel();

    } catch (error) {

        console.error(
            "[MC ERROR] Weg zum CB6 Portal fehlgeschlagen:"
        );

        console.error(error);

        setLastAction("Navigation fehlgeschlagen");

        navigationStarted = false;

        updatePanel();

        return;
    }

    // --------------------------------------------------------
    // 12 SEKUNDEN WARTEN
    // --------------------------------------------------------

    console.log(
        "[MC] CB6 Portal erreicht."
    );

    console.log(
        "[MC] Warte 12 Sekunden..."
    );

    setLastAction("Warte 12 Sekunden am CB6 Portal");

    updatePanel();

    for (let i = 12; i > 0; i--) {

        console.log(
            `[MC] CB6 Wartezeit: ${i}s`
        );

        await sleep(1000);

        if (!mcBot) {
            return;
        }
    }

    // --------------------------------------------------------
    // /home 55
    // --------------------------------------------------------

    console.log("[MC] Sende /home 55...");

    setLastAction("/home 55");

    mcBot.chat("/home 55");

    await sleep(3000);

    console.log("========================================");
    console.log("        AFK ROUTE FERTIG");
    console.log("========================================");

    setLastAction("CB6 Home 55 erreicht");

    navigationStarted = false;

    updatePanel();
}

// ============================================================
// STOPP
// ============================================================

function stopMinecraft() {

    afkRunning = false;
    navigationStarted = false;
    portalReached = false;

    setLastAction("AFK gestoppt");

    if (mcBot) {

        try {
            mcBot.quit("AFK Bot gestoppt");
        } catch (error) {
            console.error("[MC ERROR]", error);
        }

        mcBot = null;
    }

    connecting = false;

    console.log("[MC] AFK Bot gestoppt.");

    updatePanel();
}

// ============================================================
// DISCORD
// ============================================================

discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

discordClient.once("clientReady", async () => {

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
});

// ============================================================
// !AFK
// ============================================================

discordClient.on("messageCreate", async message => {

    if (message.author.bot) {
        return;
    }

    if (message.content.toLowerCase() !== "!afk") {
        return;
    }

    if (
        DISCORD_OWNER_ID &&
        message.author.id !== DISCORD_OWNER_ID
    ) {
        return;
    }

    console.log("[DISCORD] !afk empfangen.");

    const embed = createPanelEmbed();
    const buttons = createPanelButtons();

    try {

        const panel =
            await message.channel.send({
                embeds: [embed],
                components: [buttons]
            });

        afkPanelMessage = panel;

        console.log(
            "[DISCORD] AFK Panel erstellt."
        );

    } catch (error) {

        console.error(
            "[DISCORD ERROR] Panel konnte nicht erstellt werden:"
        );

        console.error(error);
    }
});

// ============================================================
// BUTTONS
// ============================================================

discordClient.on("interactionCreate", async interaction => {

    if (!interaction.isButton()) {
        return;
    }

    if (
        DISCORD_OWNER_ID &&
        interaction.user.id !== DISCORD_OWNER_ID
    ) {
        await interaction.reply({
            content: "Keine Berechtigung.",
            flags: 64
        });

        return;
    }

    console.log(
        `[DISCORD] Button: ${interaction.customId}`
    );

    // --------------------------------------------------------
    // START
    // --------------------------------------------------------

    if (interaction.customId === "afk_start") {

        console.log(
            "[DISCORD] AFK Start gedrückt."
        );

        afkRunning = true;

        setLastAction("AFK gestartet");

        await interaction.reply({
            content: "AFK Bot wird gestartet.",
            flags: 64
        });

        updatePanel();

        if (!mcBot && !connecting) {
            await startMinecraft();
        } else if (mcBot && mcBot.entity) {

            if (!navigationStarted) {
                await startGrieferGamesRoute();
            }
        }

        return;
    }

    // --------------------------------------------------------
    // STOPP
    // --------------------------------------------------------

    if (interaction.customId === "afk_stop") {

        console.log(
            "[DISCORD] AFK Stopp gedrückt."
        );

        stopMinecraft();

        await interaction.reply({
            content: "AFK Bot wurde gestoppt.",
            flags: 64
        });

        return;
    }

    // --------------------------------------------------------
    // RECONNECT
    // --------------------------------------------------------

    if (interaction.customId === "afk_reconnect") {

        console.log(
            "[DISCORD] Reconnect gedrückt."
        );

        reconnects++;

        stopMinecraft();

        afkRunning = true;

        setLastAction("Reconnect");

        await interaction.reply({
            content: "Minecraft wird neu verbunden.",
            flags: 64
        });

        setTimeout(() => {

            if (afkRunning && !mcBot) {
                startMinecraft();
            }

        }, 1000);

        return;
    }

    // --------------------------------------------------------
    // POSITION
    // --------------------------------------------------------

    if (interaction.customId === "afk_position") {

        let position = "Unbekannt";

        if (mcBot && mcBot.entity) {

            position =
                `X: ${mcBot.entity.position.x.toFixed(2)}\n` +
                `Y: ${mcBot.entity.position.y.toFixed(2)}\n` +
                `Z: ${mcBot.entity.position.z.toFixed(2)}`;
        }

        await interaction.reply({
            content: `📍 Position\n${position}`,
            flags: 64
        });

        return;
    }

    // --------------------------------------------------------
    // AKTUALISIEREN
    // --------------------------------------------------------

    if (interaction.customId === "afk_refresh") {

        await interaction.update({
            embeds: [createPanelEmbed()],
            components: [createPanelButtons()]
        });

        return;
    }
});

// ============================================================
// DISCORD LOGIN
// ============================================================

console.log("========================================");
console.log("        GRIEFERGAMES AFK BOT");
console.log("========================================");

console.log(
    `[SYSTEM] Node: ${process.version}`
);

console.log(
    `[SYSTEM] Prozess: ${process.pid}`
);

console.log(
    `[SYSTEM] Minecraft Host: ${MC_HOST}`
);

console.log(
    `[SYSTEM] Minecraft Port: ${MC_PORT}`
);

console.log(
    "[SYSTEM] Minecraft Version: automatisch"
);

console.log(
    "[SYSTEM] Starte Discord Login..."
);

discordClient.login(DISCORD_TOKEN)
    .catch(error => {

        console.error(
            "[DISCORD ERROR] Login fehlgeschlagen:"
        );

        console.error(error);

        process.exit(1);
    });

// ============================================================
// PANEL AUTOMATISCH AKTUALISIEREN
// ============================================================

setInterval(() => {

    if (afkPanelMessage) {
        updatePanel();
    }

}, 5000);

// ============================================================
// FEHLERBEHANDLUNG
// ============================================================

process.on("uncaughtException", error => {

    console.error(
        "[SYSTEM ERROR] Uncaught Exception:"
    );

    console.error(error);
});

process.on("unhandledRejection", error => {

    console.error(
        "[SYSTEM ERROR] Unhandled Rejection:"
    );

    console.error(error);
});

// ============================================================
// SHUTDOWN
// ============================================================

process.on("SIGTERM", () => {

    console.log(
        "[SYSTEM] SIGTERM erhalten."
    );

    afkRunning = false;

    if (mcBot) {
        try {
            mcBot.quit("Railway shutdown");
        } catch (error) {
            console.error(error);
        }
    }

    if (discordClient) {
        discordClient.destroy();
    }

    process.exit(0);
});

process.on("SIGINT", () => {

    console.log(
        "[SYSTEM] SIGINT erhalten."
    );

    afkRunning = false;

    if (mcBot) {
        try {
            mcBot.quit("Process stopped");
        } catch (error) {
            console.error(error);
        }
    }

    if (discordClient) {
        discordClient.destroy();
    }

    process.exit(0);
});

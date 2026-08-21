require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const mineflayer = require("mineflayer");

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const MC_EMAIL = process.env.MC_EMAIL;

const MC_HOST = "play.griefergames.net";
const MC_PORT = 25565;
const MC_VERSION = "1.21.11";

let mcBot = null;
let mcStarting = false;
let afkRunning = false;
let afkStartedAt = null;
let panelMessage = null;

let portalRouteRunning = false;
let portalEntered = false;

let reconnectTimer = null;

let statistics = {
    movements: 0,
    jumps: 0,
    reconnects: 0,
    disconnects: 0
};

console.log("========================================");
console.log("        GRIEFERGAMES AFK BOT");
console.log("========================================");

console.log("[SYSTEM] Node:", process.version);
console.log("[SYSTEM] Minecraft Host:", MC_HOST);
console.log("[SYSTEM] Minecraft Port:", MC_PORT);
console.log("[SYSTEM] Minecraft Version:", MC_VERSION);
console.log("[SYSTEM] Starte Discord Login...");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getUptime() {
    if (!afkStartedAt) {
        return "00:00:00";
    }

    const seconds = Math.floor((Date.now() - afkStartedAt) / 1000);

    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");

    return `${h}:${m}:${s}`;
}

function getPosition() {
    if (!mcBot || !mcBot.entity || !mcBot.entity.position) {
        return "Unbekannt";
    }

    const pos = mcBot.entity.position;

    return (
        `X: ${pos.x.toFixed(2)} | ` +
        `Y: ${pos.y.toFixed(2)} | ` +
        `Z: ${pos.z.toFixed(2)}`
    );
}

function getMinecraftStatus() {
    if (!mcBot) {
        return "OFFLINE";
    }

    if (mcBot.player) {
        return "ONLINE";
    }

    return "VERBINDET";
}

function createPanel() {
    const online = getMinecraftStatus() === "ONLINE";

    const embed = new EmbedBuilder()
        .setTitle("🤖 AFK Bot")
        .setDescription("GrieferGames AFK Kontrollzentrum")
        .addFields(
            {
                name: "📡 Status",
                value: online ? "🟢 ONLINE" : "🔴 OFFLINE",
                inline: true
            },
            {
                name: "🌐 Server",
                value: "GrieferGames",
                inline: true
            },
            {
                name: "📡 Verbindung",
                value: online ? "🟢 Online" : "🔴 Offline",
                inline: true
            },
            {
                name: "📍 Position",
                value: getPosition(),
                inline: false
            },
            {
                name: "⏱️ Laufzeit",
                value: getUptime(),
                inline: true
            },
            {
                name: "⚡ Letzte Aktion",
                value: portalRouteRunning
                    ? "CB6 Route läuft"
                    : afkRunning
                        ? "AFK aktiv"
                        : "Noch keine",
                inline: true
            },
            {
                name: "📊 AFK Statistik",
                value:
                    `Bewegungen: ${statistics.movements}\n` +
                    `Sprünge: ${statistics.jumps}\n` +
                    `Reconnects: ${statistics.reconnects}\n` +
                    `Disconnects: ${statistics.disconnects}`,
                inline: false
            }
        )
        .setFooter({
            text: `AFK Control • ${new Date().toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit"
            })} Uhr`
        });

    const row = new ActionRowBuilder().addComponents(
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

    return {
        embeds: [embed],
        components: [row]
    };
}

async function updatePanel() {
    if (!panelMessage) {
        return;
    }

    try {
        await panelMessage.edit(createPanel());
    } catch (error) {
        console.log(
            "[DISCORD] Panel konnte nicht aktualisiert werden:",
            error.message
        );
    }
}

function stopMovement() {
    if (!mcBot) {
        return;
    }

    try {
        mcBot.setControlState("forward", false);
        mcBot.setControlState("back", false);
        mcBot.setControlState("left", false);
        mcBot.setControlState("right", false);
        mcBot.setControlState("jump", false);
        mcBot.setControlState("sprint", false);
    } catch {}
}

async function lookNorth() {
    if (!mcBot) {
        return;
    }

    await mcBot.look(0, 0, true);

    console.log("[ROUTE] Blickrichtung nach Norden gesetzt.");
}

async function moveForward(ms) {
    if (!mcBot) {
        return;
    }

    mcBot.setControlState("forward", true);
    mcBot.setControlState("sprint", true);

    const start = Date.now();

    while (
        mcBot &&
        portalRouteRunning &&
        Date.now() - start < ms
    ) {
        statistics.movements++;

        await sleep(50);
    }

    stopMovement();
}

async function jump() {
    if (!mcBot) {
        return;
    }

    console.log("[ROUTE] Springe über die Kante...");

    statistics.jumps++;

    mcBot.setControlState("jump", true);

    await sleep(350);

    mcBot.setControlState("jump", false);
}

async function runCB6Route() {
    if (!mcBot) {
        console.log("[ROUTE] Kein Minecraft Bot vorhanden.");
        return;
    }

    if (portalRouteRunning) {
        console.log("[ROUTE] Route läuft bereits.");
        return;
    }

    portalRouteRunning = true;
    portalEntered = false;

    console.log("");
    console.log("========================================");
    console.log("        CB6 PORTAL ROUTE");
    console.log("========================================");

    console.log("[ROUTE] Aktuelle Position:", getPosition());

    console.log("[ROUTE] Sende /portal...");

    mcBot.chat("/portal");

    await sleep(4000);

    if (!mcBot || !portalRouteRunning) {
        return;
    }

    console.log("[ROUTE] Portalraum sollte jetzt geladen sein.");
    console.log("[ROUTE] Position:", getPosition());

    await lookNorth();

    console.log("[ROUTE] Starte festen Weg über die Kante.");

    /*
        Alter fester Weg:

        Start:
        X 309.50
        Y 66
        Z 280.00

        Kante:
        X 309.50
        Y 68.17
        Z 278.03

        Danach:
        X 309.50
        Y 68.18
        Z 277.55

        Ziel:
        X 309.30
        Y 67
        Z 276.60
    */

    console.log("[ROUTE] Ziel X: 309.30");
    console.log("[ROUTE] Ziel Y: 67.00");
    console.log("[ROUTE] Ziel Z: 276.60");

    await moveForward(900);

    if (!mcBot || !portalRouteRunning) {
        return;
    }

    await jump();

    if (!mcBot || !portalRouteRunning) {
        return;
    }

    await moveForward(850);

    if (!mcBot || !portalRouteRunning) {
        return;
    }

    stopMovement();

    console.log("[ROUTE] Kante überquert.");
    console.log("[ROUTE] Position:", getPosition());

    await sleep(300);

    console.log("[ROUTE] Endlauf zum CB6 Portal.");

    await moveForward(900);

    stopMovement();

    if (!mcBot || !portalRouteRunning) {
        return;
    }

    console.log("[ROUTE] CB6 Portal erreicht.");
    console.log("[ROUTE] Position:", getPosition());

    console.log("[ROUTE] Warte 12 Sekunden.");

    await sleep(12000);

    if (!mcBot || !portalRouteRunning) {
        return;
    }

    console.log("[ROUTE] 12 Sekunden vorbei.");
    console.log("[ROUTE] Sende /home 55.");

    mcBot.chat("/home 55");

    portalEntered = true;
    portalRouteRunning = false;

    console.log("[ROUTE] /home 55 gesendet.");
    console.log("[ROUTE] CB6 Ablauf abgeschlossen.");

    await sleep(3000);

    updatePanel();
}

function stopMinecraft() {
    portalRouteRunning = false;
    portalEntered = false;
    afkRunning = false;
    afkStartedAt = null;

    stopMovement();

    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (mcBot) {
        try {
            mcBot.quit("AFK Bot gestoppt");
        } catch {}
    }

    mcBot = null;
    mcStarting = false;

    updatePanel();
}

function startMinecraft() {
    if (mcStarting) {
        console.log("[MC] Minecraft Bot startet bereits.");
        return;
    }

    if (mcBot) {
        console.log("[MC] Minecraft Bot läuft bereits.");
        return;
    }

    if (!MC_EMAIL) {
        console.log("[MC ERROR] MC_EMAIL fehlt in Railway Variables.");
        return;
    }

    mcStarting = true;
    afkRunning = true;

    if (!afkStartedAt) {
        afkStartedAt = Date.now();
    }

    console.log("========================================");
    console.log("        AFK SESSION START");
    console.log("========================================");

    console.log("[MC] Starte Minecraft Bot...");
    console.log("[MC] Account:", MC_EMAIL);
    console.log("[MC] Host:", MC_HOST);
    console.log("[MC] Port:", MC_PORT);
    console.log("[MC] Auth: microsoft");
    console.log("[MC] Version:", MC_VERSION);
    console.log("[MC] Auth Speicher: /app/minecraft_profiles");

    try {
        mcBot = mineflayer.createBot({
            host: MC_HOST,
            port: MC_PORT,
            username: MC_EMAIL,
            auth: "microsoft",
            version: MC_VERSION,
            profilesFolder: "/app/minecraft_profiles",
            checkTimeoutInterval: 60000,
            hideErrors: false
        });
    } catch (error) {
        console.log("[MC ERROR] Bot konnte nicht erstellt werden:");
        console.log(error);

        mcBot = null;
        mcStarting = false;

        updatePanel();

        return;
    }

    mcBot.once("spawn", async () => {
        mcStarting = false;

        console.log("========================================");
        console.log("[MC] Minecraft Spawn erfolgreich.");
        console.log("[MC] Spieler:", mcBot.username);
        console.log("[MC] Position:", getPosition());
        console.log("========================================");

        updatePanel();

        await sleep(2000);

        if (!mcBot || !afkRunning) {
            return;
        }

        console.log("[MC] Starte automatische CB6 Route.");

        runCB6Route().catch(error => {
            console.log("[ROUTE ERROR]", error);

            stopMovement();

            portalRouteRunning = false;

            updatePanel();
        });
    });

    mcBot.on("login", () => {
        console.log("[MC] Minecraft Login erfolgreich.");
        updatePanel();
    });

    mcBot.on("chat", (username, message) => {
        console.log(`[MC CHAT] ${username}: ${message}`);
    });

    mcBot.on("messagestr", message => {
        console.log(`[MC CHAT] ${message}`);
    });

    mcBot.on("kicked", reason => {
        console.log("[MC] Bot wurde gekickt:");
        console.log(reason);

        statistics.disconnects++;

        stopMovement();

        mcBot = null;
        mcStarting = false;
        portalRouteRunning = false;

        updatePanel();
    });

    mcBot.on("end", reason => {
        console.log(
            "[MC] Verbindung beendet:",
            reason || "Unbekannt"
        );

        statistics.disconnects++;

        stopMovement();

        mcBot = null;
        mcStarting = false;
        portalRouteRunning = false;

        updatePanel();

        if (afkRunning) {
            console.log("[MC] AFK läuft weiter.");
            console.log("[MC] Reconnect in 10 Sekunden.");

            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;

                if (!afkRunning) {
                    return;
                }

                statistics.reconnects++;

                console.log("[MC] Automatischer Reconnect.");

                startMinecraft();
            }, 10000);
        }
    });

    mcBot.on("error", error => {
        console.log("[MC ERROR]", error);
        updatePanel();
    });

    mcBot.on("move", () => {
        statistics.movements++;
    });
}

client.once("clientReady", () => {
    console.log("[DISCORD] Bot online:", client.user.tag);
    console.log("[DISCORD] Schreibe !afk");
    console.log("[SYSTEM] Discord Verbindung aktiv.");
    console.log("[SYSTEM] Prozess bleibt aktiv.");
});

client.on("messageCreate", async message => {
    if (message.author.bot) {
        return;
    }

    if (message.content.toLowerCase() !== "!afk") {
        return;
    }

    console.log("[DISCORD] !afk empfangen.");

    try {
        panelMessage = await message.channel.send(
            createPanel()
        );

        console.log("[DISCORD] AFK Panel erstellt.");

        updatePanel();
    } catch (error) {
        console.log(
            "[DISCORD ERROR] Panel konnte nicht erstellt werden:",
            error
        );
    }
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isButton()) {
        return;
    }

    console.log("[DISCORD] Button:", interaction.customId);

    if (interaction.customId === "afk_start") {
        console.log("[DISCORD] AFK Start gedrückt.");

        await interaction.deferUpdate();

        if (mcBot) {
            updatePanel();
            return;
        }

        afkRunning = true;
        afkStartedAt = Date.now();

        startMinecraft();

        setTimeout(updatePanel, 1000);

        return;
    }

    if (interaction.customId === "afk_stop") {
        console.log("[DISCORD] AFK Stopp gedrückt.");

        await interaction.deferUpdate();

        stopMinecraft();

        setTimeout(updatePanel, 500);

        return;
    }

    if (interaction.customId === "afk_reconnect") {
        console.log("[DISCORD] Reconnect gedrückt.");

        await interaction.deferUpdate();

        stopMinecraft();

        await sleep(2000);

        afkRunning = true;
        afkStartedAt = Date.now();

        startMinecraft();

        return;
    }

    if (interaction.customId === "afk_position") {
        console.log("[DISCORD] Position gedrückt.");

        await interaction.deferUpdate();

        updatePanel();

        return;
    }

    if (interaction.customId === "afk_refresh") {
        console.log("[DISCORD] Aktualisieren gedrückt.");

        await interaction.deferUpdate();

        updatePanel();

        return;
    }
});

process.on("uncaughtException", error => {
    console.log("[SYSTEM ERROR] Uncaught Exception:");
    console.log(error);
});

process.on("unhandledRejection", error => {
    console.log("[SYSTEM ERROR] Unhandled Rejection:");
    console.log(error);
});

process.on("SIGTERM", () => {
    console.log("[SYSTEM] SIGTERM empfangen.");

    stopMovement();

    if (mcBot) {
        try {
            mcBot.quit("Railway shutdown");
        } catch {}
    }

    client.destroy();

    process.exit(0);
});

process.on("SIGINT", () => {
    console.log("[SYSTEM] SIGINT empfangen.");

    stopMovement();

    if (mcBot) {
        try {
            mcBot.quit("Process shutdown");
        } catch {}
    }

    client.destroy();

    process.exit(0);
});

client.login(DISCORD_TOKEN);

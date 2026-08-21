require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mineflayer = require("mineflayer");

const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    Events
} = require("discord.js");

// ============================================================
// KONFIGURATION
// ============================================================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const MINECRAFT_USERNAME = process.env.MINECRAFT_USERNAME;
const MINECRAFT_HOST = process.env.MINECRAFT_HOST || "griefergames.net";
const MINECRAFT_PORT = Number(process.env.MINECRAFT_PORT || 25565);
const MINECRAFT_VERSION = process.env.MINECRAFT_VERSION || "1.8.9";

// Railway Volume:
// Wir speichern den Microsoft Auth Cache dauerhaft unter /data
const AUTH_CACHE_DIR = process.env.AUTH_CACHE_DIR || "/data/minecraft-auth";

if (!DISCORD_TOKEN) {
    console.error("DISCORD_TOKEN fehlt.");
    process.exit(1);
}

if (!DISCORD_CHANNEL_ID) {
    console.error("DISCORD_CHANNEL_ID fehlt.");
    process.exit(1);
}

if (!MINECRAFT_USERNAME) {
    console.error("MINECRAFT_USERNAME fehlt.");
    process.exit(1);
}

// ============================================================
// AUTH CACHE ANLEGEN
// ============================================================

try {
    fs.mkdirSync(AUTH_CACHE_DIR, {
        recursive: true
    });

    console.log(`Microsoft Auth Cache: ${AUTH_CACHE_DIR}`);
} catch (error) {
    console.error("Auth Cache konnte nicht erstellt werden:");
    console.error(error);
    process.exit(1);
}

// ============================================================
// DISCORD CLIENT
// ============================================================

const discord = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// ============================================================
// MINECRAFT STATUS
// ============================================================

let minecraftBot = null;

let minecraftStatus = "offline";

let lastConnectedAt = null;

let lastDisconnectReason = null;

let reconnecting = false;

// ============================================================
// STATUS TEXTE
// ============================================================

function getStatusText() {
    switch (minecraftStatus) {
        case "online":
            return "🟢 Online";

        case "connecting":
            return "🟡 Verbinde...";

        case "reconnecting":
            return "🟠 Reconnect...";

        case "error":
            return "🔴 Fehler";

        case "offline":
        default:
            return "⚫ Offline";
    }
}

// ============================================================
// DISCORD PANEL
// ============================================================

function createPanel() {
    const embed = new EmbedBuilder()
        .setTitle("🎮 Minecraft AFK Bot")
        .setDescription(
            "Steuere deinen Minecraft Account über die Buttons."
        )
        .addFields(
            {
                name: "Status",
                value: getStatusText(),
                inline: true
            },
            {
                name: "Account",
                value: MINECRAFT_USERNAME,
                inline: true
            },
            {
                name: "Server",
                value: `${MINECRAFT_HOST}:${MINECRAFT_PORT}`,
                inline: true
            }
        )
        .setFooter({
            text: "Minecraft Control Panel"
        })
        .setTimestamp();

    if (lastConnectedAt) {
        embed.addFields({
            name: "Verbunden seit",
            value: `<t:${Math.floor(lastConnectedAt / 1000)}:R>`,
            inline: false
        });
    }

    if (lastDisconnectReason) {
        embed.addFields({
            name: "Letzter Fehler",
            value: lastDisconnectReason.substring(0, 1000),
            inline: false
        });
    }

    const row = new ActionRowBuilder().addComponents(

        new ButtonBuilder()
            .setCustomId("minecraft_start")
            .setLabel("STARTEN")
            .setEmoji("🟢")
            .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
            .setCustomId("minecraft_stop")
            .setLabel("STOPPEN")
            .setEmoji("🔴")
            .setStyle(ButtonStyle.Danger),

        new ButtonBuilder()
            .setCustomId("minecraft_status")
            .setLabel("STATUS")
            .setEmoji("📊")
            .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
            .setCustomId("minecraft_reconnect")
            .setLabel("RECONNECT")
            .setEmoji("🔄")
            .setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [row]
    };
}

// ============================================================
// DISCORD PANEL AKTUALISIEREN
// ============================================================

async function updatePanel() {
    try {
        const channel = await discord.channels.fetch(
            DISCORD_CHANNEL_ID
        );

        if (!channel || !channel.isTextBased()) {
            console.error(
                "Discord Channel nicht gefunden oder nicht textbasiert."
            );

            return;
        }

        const messages = await channel.messages.fetch({
            limit: 50
        });

        const existingPanel = messages.find((message) => {
            if (message.author.id !== discord.user.id) {
                return false;
            }

            if (!message.embeds.length) {
                return false;
            }

            return message.embeds[0].title === "🎮 Minecraft AFK Bot";
        });

        const panel = createPanel();

        if (existingPanel) {
            await existingPanel.edit(panel);
        } else {
            await channel.send(panel);
        }

    } catch (error) {
        console.error(
            "Discord Panel konnte nicht aktualisiert werden:"
        );

        console.error(error);
    }
}

// ============================================================
// MINECRAFT BOT ERSTELLEN
// ============================================================

function createMinecraftBot() {
    if (minecraftBot) {
        console.log(
            "Minecraft Bot existiert bereits."
        );

        return;
    }

    minecraftStatus = "connecting";
    lastDisconnectReason = null;

    updatePanel();

    console.log("");
    console.log("==========================================");
    console.log("Minecraft Verbindung wird gestartet");
    console.log("==========================================");
    console.log(`Account: ${MINECRAFT_USERNAME}`);
    console.log(`Server: ${MINECRAFT_HOST}`);
    console.log(`Port: ${MINECRAFT_PORT}`);
    console.log(`Version: ${MINECRAFT_VERSION}`);
    console.log("Microsoft Login: aktiviert");
    console.log("==========================================");
    console.log("");

    try {
        minecraftBot = mineflayer.createBot({

            host: MINECRAFT_HOST,

            port: MINECRAFT_PORT,

            username: MINECRAFT_USERNAME,

            auth: "microsoft",

            version: MINECRAFT_VERSION,

            profilesFolder: AUTH_CACHE_DIR,

            onMsaCode: (data) => {

                console.log("");
                console.log("==========================================");
                console.log("MICROSOFT LOGIN");
                console.log("==========================================");

                if (data.verification_uri) {
                    console.log(
                        `Öffne: ${data.verification_uri}`
                    );
                }

                if (data.user_code) {
                    console.log(
                        `Code: ${data.user_code}`
                    );
                }

                console.log("==========================================");
                console.log("");
            }
        });

        minecraftBot.once("spawn", async () => {

            minecraftStatus = "online";

            lastConnectedAt = Date.now();

            lastDisconnectReason = null;

            reconnecting = false;

            console.log("");
            console.log("Minecraft Bot ist ONLINE.");
            console.log(`Spieler: ${minecraftBot.username}`);
            console.log(`Server: ${MINECRAFT_HOST}`);
            console.log("");

            await updatePanel();
        });

        minecraftBot.on("login", async () => {

            console.log(
                "Minecraft Login erfolgreich."
            );

            minecraftStatus = "connecting";

            await updatePanel();
        });

        minecraftBot.on("kicked", async (reason) => {

            console.log("");
            console.log("Minecraft Bot wurde gekickt.");

            console.log(
                "Grund:",
                reason
            );

            minecraftStatus = "error";

            lastDisconnectReason =
                typeof reason === "string"
                    ? reason
                    : JSON.stringify(reason);

            await updatePanel();
        });

        minecraftBot.on("error", async (error) => {

            console.error("");
            console.error(
                "Minecraft Fehler:"
            );

            console.error(error);

            minecraftStatus = "error";

            lastDisconnectReason =
                error?.message ||
                String(error);

            await updatePanel();
        });

        minecraftBot.on("end", async (reason) => {

            console.log("");
            console.log(
                "Minecraft Verbindung beendet."
            );

            console.log(
                "Grund:",
                reason || "Unbekannt"
            );

            minecraftStatus = "offline";

            minecraftBot = null;

            reconnecting = false;

            lastDisconnectReason =
                reason
                    ? String(reason)
                    : "Verbindung beendet";

            await updatePanel();
        });

    } catch (error) {

        console.error(
            "Minecraft Bot konnte nicht erstellt werden:"
        );

        console.error(error);

        minecraftStatus = "error";

        lastDisconnectReason =
            error?.message ||
            String(error);

        minecraftBot = null;

        updatePanel();
    }
}

// ============================================================
// MINECRAFT BOT STOPPEN
// ============================================================

async function stopMinecraftBot() {

    if (!minecraftBot) {

        minecraftStatus = "offline";

        await updatePanel();

        return false;
    }

    console.log(
        "Minecraft Bot wird gestoppt..."
    );

    try {

        minecraftBot.quit(
            "Discord Bot wurde gestoppt."
        );

    } catch (error) {

        console.error(
            "Fehler beim Stoppen:",
            error
        );

        try {
            minecraftBot.end();
        } catch {}
    }

    minecraftBot = null;

    minecraftStatus = "offline";

    lastDisconnectReason = null;

    reconnecting = false;

    await updatePanel();

    return true;
}

// ============================================================
// RECONNECT
// ============================================================

async function reconnectMinecraftBot() {

    if (reconnecting) {
        return false;
    }

    reconnecting = true;

    minecraftStatus = "reconnecting";

    await updatePanel();

    console.log(
        "Minecraft Reconnect wird durchgeführt..."
    );

    if (minecraftBot) {

        try {
            minecraftBot.quit(
                "Reconnect"
            );
        } catch {}

        minecraftBot = null;
    }

    await new Promise((resolve) => {
        setTimeout(resolve, 3000);
    });

    reconnecting = false;

    createMinecraftBot();

    return true;
}

// ============================================================
// BUTTON INTERACTIONS
// ============================================================

discord.on(
    Events.InteractionCreate,
    async (interaction) => {

        if (!interaction.isButton()) {
            return;
        }

        try {

            // ----------------------------------------------
            // START
            // ----------------------------------------------

            if (
                interaction.customId ===
                "minecraft_start"
            ) {

                if (minecraftBot) {

                    await interaction.reply({
                        content:
                            "🟡 Der Minecraft Account ist bereits verbunden.",
                        ephemeral: true
                    });

                    return;
                }

                await interaction.reply({
                    content:
                        "🟢 Minecraft Verbindung wird gestartet...",
                    ephemeral: true
                });

                createMinecraftBot();

                return;
            }

            // ----------------------------------------------
            // STOP
            // ----------------------------------------------

            if (
                interaction.customId ===
                "minecraft_stop"
            ) {

                if (!minecraftBot) {

                    await interaction.reply({
                        content:
                            "⚫ Der Minecraft Account ist bereits offline.",
                        ephemeral: true
                    });

                    return;
                }

                await interaction.reply({
                    content:
                        "🔴 Minecraft Verbindung wird beendet...",
                    ephemeral: true
                });

                await stopMinecraftBot();

                return;
            }

            // ----------------------------------------------
            // STATUS
            // ----------------------------------------------

            if (
                interaction.customId ===
                "minecraft_status"
            ) {

                await updatePanel();

                await interaction.reply({
                    content:
                        `📊 Aktueller Minecraft Status: ${getStatusText()}`,
                    ephemeral: true
                });

                return;
            }

            // ----------------------------------------------
            // RECONNECT
            // ----------------------------------------------

            if (
                interaction.customId ===
                "minecraft_reconnect"
            ) {

                if (!minecraftBot) {

                    await interaction.reply({
                        content:
                            "⚫ Der Minecraft Account ist momentan offline. Benutze zuerst STARTEN.",
                        ephemeral: true
                    });

                    return;
                }

                await interaction.reply({
                    content:
                        "🔄 Minecraft Verbindung wird neu aufgebaut...",
                    ephemeral: true
                });

                await reconnectMinecraftBot();

                return;
            }

        } catch (error) {

            console.error(
                "Fehler bei Button Interaktion:",
                error
            );

            if (!interaction.replied) {

                await interaction.reply({
                    content:
                        "❌ Es ist ein Fehler aufgetreten.",
                    ephemeral: true
                });

            }
        }
    }
);

// ============================================================
// DISCORD READY
// ============================================================

discord.once(
    Events.ClientReady,
    async (client) => {

        console.log("");
        console.log("==========================================");
        console.log("Discord Bot ist online");
        console.log("==========================================");
        console.log(`Bot: ${client.user.tag}`);
        console.log(`Channel: ${DISCORD_CHANNEL_ID}`);
        console.log("==========================================");
        console.log("");

        await updatePanel();
    }
);

// ============================================================
// PROZESS FEHLER
// ============================================================

process.on(
    "unhandledRejection",
    (error) => {

        console.error(
            "Unhandled Promise Rejection:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "Uncaught Exception:",
            error
        );
    }
);

// ============================================================
// DISCORD LOGIN
// ============================================================

console.log(
    "Discord Bot wird gestartet..."
);

discord.login(DISCORD_TOKEN);

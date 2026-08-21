const fs = require("fs");
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
// RAILWAY VARIABLEN
// ============================================================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_OWNER_ID = process.env.DISCORD_OWNER_ID;

const MC_AUTH = process.env.MC_AUTH || "microsoft";
const MC_AUTH_DIR = process.env.MC_AUTH_DIR || "/data/minecraft-auth";

const MC_HOST = process.env.MC_HOST || "griefergames.net";
const MC_PORT = Number(process.env.MC_PORT || 25565);
const MC_USERNAME = process.env.MC_USERNAME;


// ============================================================
// PRÜFEN
// ============================================================

function checkEnvironment() {
    const missing = [];

    if (!DISCORD_TOKEN) {
        missing.push("DISCORD_TOKEN");
    }

    if (!DISCORD_OWNER_ID) {
        missing.push("DISCORD_OWNER_ID");
    }

    if (!MC_USERNAME) {
        missing.push("MC_USERNAME");
    }

    if (missing.length > 0) {
        console.error("");
        console.error("Fehlende Railway Variablen:");
        console.error(missing.join(", "));
        console.error("");
        process.exit(1);
    }
}

checkEnvironment();


// ============================================================
// AUTH ORDNER
// ============================================================

try {
    fs.mkdirSync(MC_AUTH_DIR, {
        recursive: true
    });

    console.log("Minecraft Auth Ordner:");
    console.log(MC_AUTH_DIR);

} catch (error) {
    console.error("Der Minecraft Auth Ordner konnte nicht erstellt werden.");
    console.error(error);
    process.exit(1);
}


// ============================================================
// DISCORD
// ============================================================

const discord = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages
    ]
});


// ============================================================
// MINECRAFT STATUS
// ============================================================

let minecraftBot = null;

let minecraftStatus = "offline";

let minecraftSince = null;

let lastDisconnectReason = null;

let manualStop = false;

let reconnectInProgress = false;

let reconnectTimer = null;


// ============================================================
// STATUS
// ============================================================

function getStatusText() {
    switch (minecraftStatus) {
        case "online":
            return "🟢 Online";

        case "connecting":
            return "🟡 Verbinde";

        case "reconnecting":
            return "🟠 Reconnect";

        case "error":
            return "🔴 Fehler";

        default:
            return "⚫ Offline";
    }
}


// ============================================================
// PANEL EMBED
// ============================================================

function createPanel() {

    const embed = new EmbedBuilder()
        .setTitle("🎮 Minecraft AFK")
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
                value: MC_USERNAME,
                inline: true
            },
            {
                name: "Server",
                value: MC_HOST,
                inline: true
            }
        )
        .setTimestamp();

    if (minecraftSince) {
        embed.addFields({
            name: "Verbunden seit",
            value: `<t:${Math.floor(minecraftSince / 1000)}:R>`,
            inline: false
        });
    }

    if (lastDisconnectReason) {
        embed.addFields({
            name: "Letzter Hinweis",
            value: String(lastDisconnectReason).slice(0, 1000),
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
// PANEL NACHRICHT
// ============================================================

let panelMessage = null;


async function getOwner() {

    try {

        const owner = await discord.users.fetch(
            DISCORD_OWNER_ID
        );

        return owner;

    } catch (error) {

        console.error(
            "Discord Owner konnte nicht gefunden werden."
        );

        console.error(error);

        return null;
    }
}


// ============================================================
// PANEL ERSTELLEN
// ============================================================

async function createPanelMessage() {

    const owner = await getOwner();

    if (!owner) {
        return;
    }

    try {

        const dm = await owner.createDM();

        const messages = await dm.messages.fetch({
            limit: 50
        });

        const existing = messages.find(
            message =>
                message.author.id === discord.user.id &&
                message.embeds.length > 0 &&
                message.embeds[0].title === "🎮 Minecraft AFK"
        );

        const panel = createPanel();

        if (existing) {

            panelMessage = existing;

            await existing.edit(panel);

            console.log(
                "Vorhandenes Discord Panel aktualisiert."
            );

        } else {

            panelMessage = await dm.send(panel);

            console.log(
                "Neues Discord Panel erstellt."
            );
        }

    } catch (error) {

        console.error(
            "Discord Panel konnte nicht erstellt werden."
        );

        console.error(error);
    }
}


// ============================================================
// PANEL AKTUALISIEREN
// ============================================================

async function updatePanel() {

    if (!panelMessage) {
        await createPanelMessage();
        return;
    }

    try {

        await panelMessage.edit(
            createPanel()
        );

    } catch (error) {

        console.log(
            "Panel konnte nicht aktualisiert werden."
        );

        panelMessage = null;

        await createPanelMessage();
    }
}


// ============================================================
// MINECRAFT VERBINDUNG STARTEN
// ============================================================

function startMinecraft() {

    if (minecraftBot) {

        console.log(
            "Minecraft ist bereits verbunden oder verbindet."
        );

        return;
    }

    manualStop = false;

    lastDisconnectReason = null;

    minecraftStatus = "connecting";

    updatePanel();

    console.log("");
    console.log("==========================================");
    console.log("MINECRAFT START");
    console.log("==========================================");
    console.log(`Account: ${MC_USERNAME}`);
    console.log(`Server: ${MC_HOST}`);
    console.log(`Port: ${MC_PORT}`);
    console.log(`Auth: ${MC_AUTH}`);
    console.log(`Auth Ordner: ${MC_AUTH_DIR}`);
    console.log("==========================================");
    console.log("");

    try {

        minecraftBot = mineflayer.createBot({

            host: MC_HOST,

            port: MC_PORT,

            username: MC_USERNAME,

            auth: MC_AUTH,

            profilesFolder: MC_AUTH_DIR,

            version: "1.8.9",

            hideErrors: false,

            onMsaCode: (data) => {

                console.log("");
                console.log("==========================================");
                console.log("MICROSOFT LOGIN ERFORDERLICH");
                console.log("==========================================");

                if (data.verification_uri) {

                    console.log(
                        `Login Seite: ${data.verification_uri}`
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


        // ====================================================
        // LOGIN
        // ====================================================

        minecraftBot.on(
            "login",
            async () => {

                console.log(
                    "Minecraft Login erfolgreich."
                );

                await updatePanel();
            }
        );


        // ====================================================
        // SPAWN
        // ====================================================

        minecraftBot.once(
            "spawn",
            async () => {

                minecraftStatus = "online";

                minecraftSince = Date.now();

                lastDisconnectReason = null;

                reconnectInProgress = false;

                console.log("");
                console.log("==========================================");
                console.log("MINECRAFT ONLINE");
                console.log("==========================================");
                console.log(`Name: ${minecraftBot.username}`);
                console.log(`Server: ${MC_HOST}`);
                console.log("==========================================");
                console.log("");

                await updatePanel();
            }
        );


        // ====================================================
        // KICK
        // ====================================================

        minecraftBot.on(
            "kicked",
            async (reason) => {

                console.log("");
                console.log("Minecraft wurde gekickt.");
                console.log("Grund:");
                console.log(reason);
                console.log("");

                lastDisconnectReason =
                    typeof reason === "string"
                        ? reason
                        : JSON.stringify(reason);

                minecraftStatus = "error";

                await updatePanel();
            }
        );


        // ====================================================
        // ERROR
        // ====================================================

        minecraftBot.on(
            "error",
            async (error) => {

                console.error("");
                console.error("Minecraft Fehler:");
                console.error(error);
                console.error("");

                lastDisconnectReason =
                    error?.message || String(error);

                minecraftStatus = "error";

                await updatePanel();
            }
        );


        // ====================================================
        // VERBINDUNG BEENDET
        // ====================================================

        minecraftBot.on(
            "end",
            async (reason) => {

                console.log("");
                console.log("==========================================");
                console.log("MINECRAFT VERBINDUNG BEENDET");
                console.log("==========================================");
                console.log(`Grund: ${reason || "Unbekannt"}`);
                console.log("==========================================");
                console.log("");

                minecraftBot = null;

                minecraftSince = null;

                if (!manualStop) {

                    minecraftStatus = "reconnecting";

                    lastDisconnectReason =
                        reason
                            ? String(reason)
                            : "Verbindung beendet";

                    await updatePanel();

                    scheduleReconnect();

                } else {

                    minecraftStatus = "offline";

                    await updatePanel();
                }
            }
        );

    } catch (error) {

        console.error(
            "Minecraft Bot konnte nicht erstellt werden."
        );

        console.error(error);

        minecraftBot = null;

        minecraftStatus = "error";

        lastDisconnectReason =
            error?.message || String(error);

        updatePanel();
    }
}


// ============================================================
// AUTOMATISCHER RECONNECT
// ============================================================

function scheduleReconnect() {

    if (manualStop) {
        return;
    }

    if (reconnectInProgress) {
        return;
    }

    if (reconnectTimer) {
        return;
    }

    reconnectInProgress = true;

    console.log(
        "Reconnect wird in 10 Sekunden gestartet."
    );

    reconnectTimer = setTimeout(
        () => {

            reconnectTimer = null;

            reconnectInProgress = false;

            if (manualStop) {
                return;
            }

            startMinecraft();

        },
        10000
    );
}


// ============================================================
// STOPPEN
// ============================================================

async function stopMinecraft() {

    manualStop = true;

    reconnectInProgress = false;

    if (reconnectTimer) {

        clearTimeout(reconnectTimer);

        reconnectTimer = null;
    }

    if (!minecraftBot) {

        minecraftStatus = "offline";

        minecraftSince = null;

        await updatePanel();

        return;
    }

    minecraftStatus = "offline";

    await updatePanel();

    try {

        minecraftBot.quit(
            "Discord Stop"
        );

    } catch (error) {

        console.error(
            "Minecraft konnte nicht sauber beendet werden."
        );

        console.error(error);

        try {
            minecraftBot.end();
        } catch {}
    }

    minecraftBot = null;

    minecraftSince = null;

    await updatePanel();
}


// ============================================================
// RECONNECT
// ============================================================

async function reconnectMinecraft() {

    if (reconnectInProgress) {
        return false;
    }

    reconnectInProgress = true;

    manualStop = true;

    if (reconnectTimer) {

        clearTimeout(reconnectTimer);

        reconnectTimer = null;
    }

    minecraftStatus = "reconnecting";

    await updatePanel();

    if (minecraftBot) {

        try {

            minecraftBot.quit(
                "Discord Reconnect"
            );

        } catch {}

        minecraftBot = null;
    }

    await new Promise(
        resolve => setTimeout(resolve, 3000)
    );

    manualStop = false;

    reconnectInProgress = false;

    startMinecraft();

    return true;
}


// ============================================================
// DISCORD BUTTONS
// ============================================================

discord.on(
    Events.InteractionCreate,
    async (interaction) => {

        if (!interaction.isButton()) {
            return;
        }


        // Nur Owner darf Buttons benutzen

        if (interaction.user.id !== DISCORD_OWNER_ID) {

            await interaction.reply({
                content:
                    "❌ Du darfst diesen Bot nicht steuern.",
                ephemeral: true
            });

            return;
        }


        try {

            // ==================================================
            // START
            // ==================================================

            if (
                interaction.customId ===
                "minecraft_start"
            ) {

                if (minecraftBot) {

                    await interaction.reply({
                        content:
                            "🟡 Minecraft ist bereits online oder verbindet sich.",
                        ephemeral: true
                    });

                    return;
                }

                await interaction.reply({
                    content:
                        "🟢 Minecraft Verbindung wird gestartet.",
                    ephemeral: true
                });

                startMinecraft();

                return;
            }


            // ==================================================
            // STOP
            // ==================================================

            if (
                interaction.customId ===
                "minecraft_stop"
            ) {

                await interaction.reply({
                    content:
                        "🔴 Minecraft wird gestoppt.",
                    ephemeral: true
                });

                await stopMinecraft();

                return;
            }


            // ==================================================
            // STATUS
            // ==================================================

            if (
                interaction.customId ===
                "minecraft_status"
            ) {

                await updatePanel();

                await interaction.reply({
                    content:
                        `📊 Minecraft Status: ${getStatusText()}`,
                    ephemeral: true
                });

                return;
            }


            // ==================================================
            // RECONNECT
            // ==================================================

            if (
                interaction.customId ===
                "minecraft_reconnect"
            ) {

                if (!minecraftBot) {

                    await interaction.reply({
                        content:
                            "⚫ Minecraft ist momentan offline. Benutze zuerst STARTEN.",
                        ephemeral: true
                    });

                    return;
                }

                await interaction.reply({
                    content:
                        "🔄 Minecraft wird neu verbunden.",
                    ephemeral: true
                });

                await reconnectMinecraft();

                return;
            }

        } catch (error) {

            console.error(
                "Button Fehler:"
            );

            console.error(error);

            if (!interaction.replied) {

                await interaction.reply({
                    content:
                        "❌ Beim Ausführen ist ein Fehler aufgetreten.",
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
        console.log("DISCORD BOT ONLINE");
        console.log("==========================================");
        console.log(`Bot: ${client.user.tag}`);
        console.log(`Owner ID: ${DISCORD_OWNER_ID}`);
        console.log("==========================================");
        console.log("");

        await createPanelMessage();
    }
);


// ============================================================
// FEHLER
// ============================================================

process.on(
    "unhandledRejection",
    (error) => {

        console.error(
            "Unhandled Promise Rejection:"
        );

        console.error(error);
    }
);

process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "Uncaught Exception:"
        );

        console.error(error);
    }
);


// ============================================================
// START
// ============================================================

console.log(
    "Discord Bot wird gestartet..."
);

discord.login(
    DISCORD_TOKEN
);

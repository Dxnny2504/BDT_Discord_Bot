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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let mcBot = null;
let afkRunning = false;
let afkStartedAt = null;
let afkInterval = null;

let statistics = {
    movements: 0,
    jumps: 0,
    reconnects: 0,
    disconnects: 0
};

let panelMessage = null;

console.log("========================================");
console.log("        GRIEFERGAMES AFK BOT");
console.log("========================================");


// =====================================================
// DISCORD READY
// =====================================================

client.once("ready", async () => {

    console.log(`[DISCORD] Bot online: ${client.user.tag}`);
    console.log("[DISCORD] Schreibe !afk");

});


// =====================================================
// AFK PANEL
// =====================================================

function createPanel() {

    const status = afkRunning
        ? "🟢 ONLINE"
        : "🔴 OFFLINE";

    const connection = mcBot
        ? "🟢 Verbunden"
        : "🔴 Offline";

    let uptime = "00:00:00";

    if (afkRunning && afkStartedAt) {

        const seconds = Math.floor(
            (Date.now() - afkStartedAt) / 1000
        );

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        uptime =
            String(hours).padStart(2, "0") + ":" +
            String(minutes).padStart(2, "0") + ":" +
            String(secs).padStart(2, "0");
    }

    const position = mcBot && mcBot.entity
        ? `${Math.floor(mcBot.entity.position.x)}, ${Math.floor(mcBot.entity.position.y)}, ${Math.floor(mcBot.entity.position.z)}`
        : "Unbekannt";

    const embed = new EmbedBuilder()
        .setTitle("🤖 AFK Bot")
        .setDescription("GrieferGames AFK Kontrollzentrum")
        .addFields(
            {
                name: "📡 Status",
                value: status,
                inline: true
            },
            {
                name: "🌐 Server",
                value: "GrieferGames",
                inline: true
            },
            {
                name: "🔌 Verbindung",
                value: connection,
                inline: true
            },
            {
                name: "📍 Position",
                value: position,
                inline: true
            },
            {
                name: "⏱️ Laufzeit",
                value: uptime,
                inline: true
            },
            {
                name: "⚡ Letzte Aktion",
                value: afkRunning ? "AFK läuft" : "Noch keine",
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
            text: "AFK Control"
        })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(

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


// =====================================================
// MINECRAFT STARTEN
// =====================================================

function startMinecraft() {

    if (mcBot) {

        console.log("[MC] Minecraft läuft bereits.");

        return;
    }

    console.log("========================================");
    console.log("        AFK SESSION START");
    console.log("========================================");

    console.log("[MC] Starte Minecraft Bot...");

    mcBot = mineflayer.createBot({

        host: process.env.MC_HOST || "play.griefergames.net",

        port: Number(
            process.env.MC_PORT || 25565
        ),

        username: process.env.MC_USERNAME,

        auth: process.env.MC_AUTH || "microsoft",

        version: process.env.MC_VERSION || false,

        hideErrors: false
    });


    // =================================================
    // MINECRAFT LOGIN
    // =================================================

    mcBot.once("login", () => {

        console.log("[MC] Minecraft Login erfolgreich.");

    });


    // =================================================
    // SPAWN
    // =================================================

    mcBot.once("spawn", () => {

        console.log("[MC] Minecraft Bot ist auf dem Server.");

        afkRunning = true;
        afkStartedAt = Date.now();

        statistics.movements = 0;
        statistics.jumps = 0;
        statistics.reconnects = 0;
        statistics.disconnects = 0;

        console.log("[MC] AFK Session gestartet.");

        updatePanel();
    });


    // =================================================
    // CHAT
    // =================================================

    mcBot.on("chat", (username, message) => {

        console.log(
            `[MC CHAT] ${username}: ${message}`
        );

        /*
         * HIER KOMMT SPÄTER DIE BDT ERKENNUNG HIN.
         *
         * Der Bot kann später den Minecraft Chat
         * auswerten und erkennen, was BDT ist.
         *
         * Das bauen wir ganz zum Schluss ein.
         */

    });


    // =================================================
    // MOVE
    // =================================================

    mcBot.on("move", () => {

        if (!afkRunning) return;

        statistics.movements++;

    });


    // =================================================
    // DISCONNECT
    // =================================================

    mcBot.on("end", () => {

        console.log("[MC] Minecraft Verbindung beendet.");

        statistics.disconnects++;

        mcBot = null;

        if (afkRunning) {

            console.log("[MC] AFK war aktiv.");

            updatePanel();
        }

    });


    // =================================================
    // ERROR
    // =================================================

    mcBot.on("error", (error) => {

        console.log(
            "[MC ERROR]",
            error.message
        );

    });


    // =================================================
    // KICK
    // =================================================

    mcBot.on("kicked", (reason) => {

        console.log(
            "[MC] Bot wurde gekickt:",
            reason
        );

        statistics.disconnects++;

        updatePanel();

    });

}


// =====================================================
// MINECRAFT STOPPEN
// =====================================================

function stopMinecraft() {

    console.log("========================================");
    console.log("        AFK SESSION STOP");
    console.log("========================================");

    afkRunning = false;
    afkStartedAt = null;

    if (mcBot) {

        console.log("[MC] Stoppe Minecraft Bot...");

        try {
            mcBot.quit("AFK Bot gestoppt");
        } catch (error) {
            console.log("[MC] Fehler beim Stoppen:", error.message);
        }

        mcBot = null;
    }

    updatePanel();

}


// =====================================================
// RECONNECT
// =====================================================

function reconnectMinecraft() {

    console.log("[MC] Reconnect...");

    statistics.reconnects++;

    if (mcBot) {

        try {
            mcBot.quit("Reconnect");
        } catch {}
    }

    mcBot = null;

    setTimeout(() => {

        startMinecraft();

    }, 3000);

}


// =====================================================
// PANEL AKTUALISIEREN
// =====================================================

async function updatePanel() {

    if (!panelMessage) return;

    try {

        await panelMessage.edit(
            createPanel()
        );

    } catch (error) {

        console.log(
            "[DISCORD] Panel konnte nicht aktualisiert werden:",
            error.message
        );

    }

}


// =====================================================
// !AFK
// =====================================================

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    if (message.content.toLowerCase() !== "!afk") {
        return;
    }

    console.log("[DISCORD] !afk empfangen.");

    try {

        const panel = createPanel();

        panelMessage = await message.channel.send(panel);

        console.log("[DISCORD] AFK Panel erstellt.");

    } catch (error) {

        console.log(
            "[DISCORD] Fehler beim Erstellen des Panels:",
            error
        );

    }

});


// =====================================================
// BUTTONS
// =====================================================

client.on("interactionCreate", async (interaction) => {

    if (!interaction.isButton()) return;

    try {

        // =============================================
        // AFK START
        // =============================================

        if (interaction.customId === "afk_start") {

            await interaction.deferUpdate();

            if (afkRunning) {

                return;
            }

            console.log("[DISCORD] AFK Start gedrückt.");

            startMinecraft();

            setTimeout(updatePanel, 1000);

            return;
        }


        // =============================================
        // AFK STOP
        // =============================================

        if (interaction.customId === "afk_stop") {

            await interaction.deferUpdate();

            console.log("[DISCORD] AFK Stopp gedrückt.");

            stopMinecraft();

            return;
        }


        // =============================================
        // RECONNECT
        // =============================================

        if (interaction.customId === "afk_reconnect") {

            await interaction.deferUpdate();

            console.log("[DISCORD] Reconnect gedrückt.");

            reconnectMinecraft();

            return;
        }


        // =============================================
        // POSITION
        // =============================================

        if (interaction.customId === "afk_position") {

            const position =
                mcBot && mcBot.entity
                    ? `${Math.floor(mcBot.entity.position.x)}, ${Math.floor(mcBot.entity.position.y)}, ${Math.floor(mcBot.entity.position.z)}`
                    : "Unbekannt";

            await interaction.reply({
                content: `📍 Aktuelle Position: **${position}**`,
                flags: 64
            });

            return;
        }


        // =============================================
        // AKTUALISIEREN
        // =============================================

        if (interaction.customId === "afk_refresh") {

            await interaction.deferUpdate();

            await updatePanel();

            return;
        }

    } catch (error) {

        console.log(
            "[DISCORD] Interaction Fehler:",
            error
        );

    }

});


// =====================================================
// PANEL AUTOMATISCH AKTUALISIEREN
// =====================================================

setInterval(() => {

    if (panelMessage) {
        updatePanel();
    }

}, 5000);


// =====================================================
// DISCORD LOGIN
// =====================================================

if (!process.env.DISCORD_TOKEN) {

    console.error(
        "[DISCORD] FEHLER: DISCORD_TOKEN fehlt!"
    );

    process.exit(1);
}

client.login(
    process.env.DISCORD_TOKEN
);

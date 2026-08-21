require("dotenv").config();

const path = require("path");
const fs = require("fs");
const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");

const mineflayer = require("mineflayer");

// ============================================================
// KONFIGURATION
// ============================================================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const MC_EMAIL =
    process.env.MC_EMAIL ||
    process.env.MINECRAFT_EMAIL;

const MC_HOST =
    process.env.MC_HOST ||
    "play.griefergames.net";

const MC_PORT =
    Number(process.env.MC_PORT) ||
    25565;

const MC_VERSION =
    process.env.MC_VERSION ||
    false;

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

fs.mkdirSync(MC_AUTH_DIR, {
    recursive: true
});

// ============================================================
// STATUS
// ============================================================

let mcBot = null;
let afkRunning = false;

// ============================================================
// DISCORD
// ============================================================

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ============================================================
// STARTUP
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
    `[SYSTEM] Minecraft Version: ${MC_VERSION || "automatisch"}`
);

console.log(
    `[MC] Railway Volume Mount: ${
        RAILWAY_VOLUME_MOUNT_PATH || "nicht gesetzt"
    }`
);

console.log(
    `[MC] Microsoft Auth Speicher: ${MC_AUTH_DIR}`
);

console.log(
    "[SYSTEM] Starte Discord Login..."
);

// ============================================================
// DISCORD READY
// ============================================================

discordClient.once("ready", () => {
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

    if (message.content !== "!afk") {
        return;
    }

    console.log(
        "[DISCORD] !afk empfangen."
    );

    const embed = new EmbedBuilder()
        .setTitle("GrieferGames AFK Bot")
        .setDescription(
            "Starte oder stoppe die AFK Session."
        );

    const row = new ActionRowBuilder()
        .addComponents(

            new ButtonBuilder()
                .setCustomId("afk_start")
                .setLabel("AFK Start")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId("afk_stop")
                .setLabel("AFK Stop")
                .setStyle(ButtonStyle.Danger)
        );

    await message.channel.send({
        embeds: [embed],
        components: [row]
    });

    console.log(
        "[DISCORD] AFK Panel erstellt."
    );
});

// ============================================================
// BUTTONS
// ============================================================

discordClient.on("interactionCreate", async interaction => {

    if (!interaction.isButton()) {
        return;
    }

    console.log(
        `[DISCORD] Button: ${interaction.customId}`
    );

    if (interaction.customId === "afk_start") {

        console.log(
            "[DISCORD] AFK Start gedrückt."
        );

        if (afkRunning) {

            await interaction.reply({
                content: "Der AFK Bot läuft bereits.",
                ephemeral: true
            });

            return;
        }

        await interaction.reply({
            content: "AFK Session wird gestartet.",
            ephemeral: true
        });

        startMinecraft();
    }

    if (interaction.customId === "afk_stop") {

        console.log(
            "[DISCORD] AFK Stop gedrückt."
        );

        if (!mcBot) {

            await interaction.reply({
                content: "Der Minecraft Bot läuft nicht.",
                ephemeral: true
            });

            return;
        }

        stopMinecraft();

        await interaction.reply({
            content: "AFK Session wurde beendet.",
            ephemeral: true
        });
    }
});

// ============================================================
// MINECRAFT START
// ============================================================

function startMinecraft() {

    if (mcBot) {
        return;
    }

    afkRunning = true;

    console.log("========================================");
    console.log("        AFK SESSION START");
    console.log("========================================");

    console.log(
        "[MC] Starte Minecraft Bot..."
    );

    console.log(
        `[MC] Account: ${MC_EMAIL}`
    );

    console.log(
        `[MC] Host: ${MC_HOST}`
    );

    console.log(
        `[MC] Port: ${MC_PORT}`
    );

    console.log(
        "[MC] Auth: microsoft"
    );

    console.log(
        `[MC] Auth Speicher: ${MC_AUTH_DIR}`
    );

    const options = {

        host: MC_HOST,

        port: MC_PORT,

        username: MC_EMAIL,

        auth: "microsoft",

        profilesFolder: MC_AUTH_DIR,

        version: MC_VERSION || undefined,

        hideErrors: false
    };

    try {

        mcBot = mineflayer.createBot(options);

    } catch (error) {

        console.error(
            "[MC ERROR] Minecraft Bot konnte nicht gestartet werden:"
        );

        console.error(error);

        mcBot = null;
        afkRunning = false;

        return;
    }

    // ========================================================
    // LOGIN
    // ========================================================

    mcBot.once("login", () => {

        console.log(
            "[MC] Minecraft Login erfolgreich."
        );
    });

    // ========================================================
    // SPAWN
    // ========================================================

    mcBot.once("spawn", () => {

        console.log(
            "[MC] Minecraft Spawn erfolgreich."
        );

        console.log(
            "[MC] AFK Bot ist jetzt auf dem Server."
        );

        startGrieferGamesRoute();
    });

    // ========================================================
    // CHAT
    // ========================================================

    mcBot.on("message", message => {

        const text = message.toString();

        console.log(
            `[MC CHAT] ${text}`
        );
    });

    // ========================================================
    // ERROR
    // ========================================================

    mcBot.on("error", error => {

        console.error(
            "[MC ERROR]",
            error
        );
    });

    // ========================================================
    // KICK
    // ========================================================

    mcBot.on("kicked", reason => {

        console.log(
            "[MC] Bot wurde gekickt:",
            reason
        );
    });

    // ========================================================
    // END
    // ========================================================

    mcBot.on("end", reason => {

        console.log(
            `[MC] Minecraft Verbindung beendet: ${reason || "unbekannt"}`
        );

        mcBot = null;
        afkRunning = false;
    });
}

// ============================================================
// GRIEFERGAMES ROUTE
// ============================================================

async function startGrieferGamesRoute() {

    if (!mcBot) {
        return;
    }

    console.log(
        "[MC] Starte GrieferGames Route..."
    );

    // /portal öffnen
    console.log(
        "[MC] Sende /portal..."
    );

    mcBot.chat("/portal");

    // Kurz warten, damit das Portal geöffnet wird
    await sleep(3000);

    if (!mcBot) {
        return;
    }

    console.log(
        "[MC] Suche CB6 Portal..."
    );

    // ========================================================
    // HIER KOMMT DER LAUFWG ZUM CB6 PORTAL
    // ========================================================
    //
    // Der genaue Laufweg hängt von den Koordinaten
    // beziehungsweise der Position des Portals ab.
    //
    // Deshalb bewegen wir den Bot hier zunächst nicht
    // blind irgendwo hin.
    //
    // Sobald wir die Koordinaten des CB6 Portals haben,
    // können wir den exakten Laufweg einbauen.
    //

    console.log(
        "[MC] CB6 Portal muss noch angelaufen werden."
    );
}

// ============================================================
// STOP
// ============================================================

function stopMinecraft() {

    console.log(
        "[MC] Stoppe Minecraft Bot..."
    );

    afkRunning = false;

    if (mcBot) {

        try {
            mcBot.quit("AFK Bot gestoppt.");
        } catch (error) {
            console.error(error);
        }

        mcBot = null;
    }

    console.log(
        "[MC] Minecraft Bot gestoppt."
    );
}

// ============================================================
// SLEEP
// ============================================================

function sleep(ms) {

    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

// ============================================================
// DISCORD LOGIN
// ============================================================

discordClient.login(DISCORD_TOKEN)
    .catch(error => {

        console.error(
            "[DISCORD ERROR] Discord Login fehlgeschlagen:"
        );

        console.error(error);

        process.exit(1);
    });

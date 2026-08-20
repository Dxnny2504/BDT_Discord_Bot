require("dotenv").config();

const path = require("path");

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const mineflayer = require("mineflayer");


// =====================================================
// KONFIGURATION
// =====================================================

const TOKEN = process.env.DISCORD_TOKEN;
const MC_USERNAME = process.env.MC_USERNAME;

const MC_HOST =
    process.env.MC_HOST ||
    "play.griefergames.net";

const MC_PORT =
    Number(
        process.env.MC_PORT ||
        25565
    );

const MC_VERSION =
    process.env.MC_VERSION ||
    false;


// =====================================================
// MICROSOFT AUTH SPEICHER
// =====================================================

const profilesFolder = path.join(
    "/app",
    "minecraft_profiles"
);

console.log(
    "[MC] Microsoft Auth Speicher:",
    profilesFolder
);


// =====================================================
// DISCORD CLIENT
// =====================================================

const client = new Client({

    intents: [

        GatewayIntentBits.Guilds,

        GatewayIntentBits.GuildMessages,

        GatewayIntentBits.MessageContent

    ]

});


// =====================================================
// VARIABLEN
// =====================================================

let mcBot = null;

let afkRunning = false;

let afkStartedAt = null;

let panelMessage = null;

let statistics = {

    movements: 0,

    jumps: 0,

    reconnects: 0,

    disconnects: 0

};


// =====================================================
// START
// =====================================================

console.log("");

console.log(
    "========================================"
);

console.log(
    "        GRIEFERGAMES AFK BOT"
);

console.log(
    "========================================"
);

console.log("");

console.log(
    "[SYSTEM] Node:",
    process.version
);

console.log(
    "[SYSTEM] Prozess:",
    process.pid
);

console.log(
    "[SYSTEM] Minecraft Host:",
    MC_HOST
);

console.log(
    "[SYSTEM] Minecraft Port:",
    MC_PORT
);

console.log(
    "[SYSTEM] Minecraft Version:",
    MC_VERSION || "automatisch"
);

if (!TOKEN) {

    console.error(
        "[DISCORD] FEHLER: DISCORD_TOKEN fehlt!"
    );

    process.exit(1);
}

if (!MC_USERNAME) {

    console.error(
        "[MC] FEHLER: MC_USERNAME fehlt!"
    );

}


// =====================================================
// DISCORD READY
// =====================================================

client.once(
    "clientReady",
    () => {

        console.log(
            "[DISCORD] Bot online: " +
            client.user.tag
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


// =====================================================
// DISCORD ERROR
// =====================================================

client.on(
    "error",
    error => {

        console.error(
            "[DISCORD ERROR]",
            error
        );

    }
);


// =====================================================
// AFK PANEL
// =====================================================

function createPanel() {

    let status =
        "🔴 OFFLINE";

    let connection =
        "🔴 Offline";


    if (
        afkRunning &&
        mcBot
    ) {

        status =
            "🟢 ONLINE";

        connection =
            "🟢 Verbunden";

    }


    if (
        afkRunning &&
        !mcBot
    ) {

        status =
            "🟡 VERBINDET";

        connection =
            "🟡 Wird verbunden";

    }


    let position =
        "Unbekannt";


    if (
        mcBot &&
        mcBot.entity &&
        mcBot.entity.position
    ) {

        const pos =
            mcBot.entity.position;

        position =
            "X " +
            Math.floor(pos.x) +
            " | Y " +
            Math.floor(pos.y) +
            " | Z " +
            Math.floor(pos.z);

    }


    let uptime =
        "00:00:00";


    if (
        afkRunning &&
        afkStartedAt
    ) {

        const seconds =
            Math.floor(
                (Date.now() - afkStartedAt) /
                1000
            );

        const hours =
            Math.floor(
                seconds / 3600
            );

        const minutes =
            Math.floor(
                (seconds % 3600) / 60
            );

        const secs =
            seconds % 60;


        uptime =
            String(hours)
                .padStart(2, "0") +
            ":" +
            String(minutes)
                .padStart(2, "0") +
            ":" +
            String(secs)
                .padStart(2, "0");

    }


    const embed =
        new EmbedBuilder()

            .setTitle(
                "🤖 AFK Bot"
            )

            .setDescription(
                "GrieferGames AFK Kontrollzentrum"
            )

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

                    inline: false
                },

                {
                    name: "⏱️ Laufzeit",

                    value: uptime,

                    inline: true
                },

                {
                    name: "📊 AFK Statistik",

                    value:

                        "Bewegungen: **" +
                        statistics.movements +
                        "**\n" +

                        "Sprünge: **" +
                        statistics.jumps +
                        "**\n" +

                        "Reconnects: **" +
                        statistics.reconnects +
                        "**\n" +

                        "Disconnects: **" +
                        statistics.disconnects +
                        "**",

                    inline: false
                }

            )

            .setFooter({
                text: "AFK Control"
            })

            .setTimestamp();


    const buttons =
        new ActionRowBuilder()

            .addComponents(

                new ButtonBuilder()

                    .setCustomId(
                        "afk_start"
                    )

                    .setLabel(
                        "AFK Start"
                    )

                    .setEmoji(
                        "🟢"
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

                    .setEmoji(
                        "🔴"
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

                    .setEmoji(
                        "🔄"
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

                    .setEmoji(
                        "📍"
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

                    .setEmoji(
                        "📊"
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
            buttons
        ]

    };

}


// =====================================================
// !AFK
// =====================================================

client.on(
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
                "[DISCORD] Panel Fehler:",
                error
            );

        }

    }
);


// =====================================================
// BUTTONS
// =====================================================

client.on(
    "interactionCreate",
    async interaction => {

        if (
            !interaction.isButton()
        ) {

            return;

        }


        console.log(
            "[DISCORD] Button:",
            interaction.customId
        );


        try {


            // =========================================
            // START
            // =========================================

            if (
                interaction.customId ===
                "afk_start"
            ) {

                await interaction.deferUpdate();


                if (
                    afkRunning
                ) {

                    return;

                }


                console.log(
                    "[DISCORD] AFK Start gedrückt."
                );


                afkRunning =
                    true;

                afkStartedAt =
                    Date.now();


                statistics = {

                    movements: 0,

                    jumps: 0,

                    reconnects: 0,

                    disconnects: 0

                };


                startMinecraft();


                await updatePanel();


                return;

            }


            // =========================================
            // STOP
            // =========================================

            if (
                interaction.customId ===
                "afk_stop"
            ) {

                await interaction.deferUpdate();


                console.log(
                    "[DISCORD] AFK Stopp gedrückt."
                );


                stopMinecraft();


                return;

            }


            // =========================================
            // RECONNECT
            // =========================================

            if (
                interaction.customId ===
                "afk_reconnect"
            ) {

                await interaction.deferUpdate();


                console.log(
                    "[DISCORD] Reconnect gedrückt."
                );


                reconnectMinecraft();


                return;

            }


            // =========================================
            // POSITION
            // =========================================

            if (
                interaction.customId ===
                "afk_position"
            ) {

                let position =
                    "Unbekannt";


                if (
                    mcBot &&
                    mcBot.entity &&
                    mcBot.entity.position
                ) {

                    const pos =
                        mcBot.entity.position;


                    position =
                        "X " +
                        Math.floor(pos.x) +
                        " | Y " +
                        Math.floor(pos.y) +
                        " | Z " +
                        Math.floor(pos.z);

                }


                await interaction.reply({

                    content:
                        "📍 Position: **" +
                        position +
                        "**",

                    flags: 64

                });


                return;

            }


            // =========================================
            // REFRESH
            // =========================================

            if (
                interaction.customId ===
                "afk_refresh"
            ) {

                await interaction.deferUpdate();


                await updatePanel();


                return;

            }

        } catch (error) {

            console.error(
                "[DISCORD] Interaction Fehler:",
                error
            );

        }

    }
);


// =====================================================
// MINECRAFT START
// =====================================================

function startMinecraft() {

    if (
        mcBot
    ) {

        console.log(
            "[MC] Minecraft läuft bereits."
        );

        return;

    }


    if (
        !MC_USERNAME
    ) {

        console.error(
            "[MC] MC_USERNAME fehlt!"
        );

        return;

    }


    console.log("");

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
        "[MC] Account:",
        MC_USERNAME
    );

    console.log(
        "[MC] Host:",
        MC_HOST
    );

    console.log(
        "[MC] Port:",
        MC_PORT
    );

    console.log(
        "[MC] Auth: microsoft"
    );

    console.log(
        "[MC] Auth Speicher:",
        profilesFolder
    );


    try {

        mcBot =
            mineflayer.createBot({

                host:
                    MC_HOST,

                port:
                    MC_PORT,

                username:
                    MC_USERNAME,

                auth:
                    "microsoft",

                profilesFolder:
                    profilesFolder,

                version:
                    MC_VERSION,

                hideErrors:
                    false

            });


    } catch (error) {

        console.error(
            "[MC] Start Fehler:",
            error
        );

        mcBot =
            null;

        return;

    }


    // ================================================
    // LOGIN
    // ================================================

    mcBot.once(
        "login",
        () => {

            console.log(
                "[MC] Minecraft Login erfolgreich."
            );

        }
    );


    // ================================================
    // SPAWN
    // ================================================

    mcBot.once(
        "spawn",
        () => {

            console.log(
                "[MC] Minecraft Spawn erfolgreich."
            );

            console.log(
                "[MC] AFK Bot ist jetzt auf dem Server."
            );

            updatePanel();

        }
    );


    // ================================================
    // POSITION
    // ================================================

    mcBot.on(
        "move",
        () => {

            statistics.movements++;

        }
    );


    // ================================================
    // CHAT
    // ================================================

    mcBot.on(
        "messagestr",
        message => {

            console.log(
                "[MC CHAT]",
                message
            );

        }
    );


    // ================================================
    // KICK
    // ================================================

    mcBot.on(
        "kicked",
        reason => {

            console.log(
                "[MC] Gekickt:",
                reason
            );

            statistics.disconnects++;

            updatePanel();

        }
    );


    // ================================================
    // ERROR
    // ================================================

    mcBot.on(
        "error",
        error => {

            console.error(
                "[MC ERROR]",
                error
            );

        }
    );


    // ================================================
    // END
    // ================================================

    mcBot.on(
        "end",
        () => {

            console.log(
                "[MC] Minecraft Verbindung beendet."
            );


            statistics.disconnects++;


            mcBot =
                null;


            updatePanel();

        }
    );

}


// =====================================================
// MINECRAFT STOP
// =====================================================

function stopMinecraft() {

    console.log(
        "[MC] Stoppe Minecraft Bot..."
    );


    afkRunning =
        false;


    afkStartedAt =
        null;


    if (
        mcBot
    ) {

        try {

            mcBot.quit(
                "AFK Bot gestoppt"
            );

        } catch (error) {

            console.error(
                "[MC] Stop Fehler:",
                error
            );

        }

    }


    mcBot =
        null;


    updatePanel();

}


// =====================================================
// RECONNECT
// =====================================================

function reconnectMinecraft() {

    console.log(
        "[MC] Reconnect gestartet."
    );


    statistics.reconnects++;


    if (
        mcBot
    ) {

        try {

            mcBot.quit(
                "Reconnect"
            );

        } catch {}

    }


    mcBot =
        null;


    setTimeout(
        () => {

            if (
                !afkRunning
            ) {

                return;

            }


            startMinecraft();

        },

        3000

    );

}


// =====================================================
// PANEL UPDATE
// =====================================================

async function updatePanel() {

    if (
        !panelMessage
    ) {

        return;

    }


    try {

        await panelMessage.edit(
            createPanel()
        );


    } catch (error) {

        console.log(
            "[DISCORD] Panel Update Fehler:",
            error.message
        );

    }

}


// =====================================================
// PANEL AUTOMATISCH AKTUALISIEREN
// =====================================================

setInterval(
    () => {

        if (
            panelMessage
        ) {

            updatePanel();

        }

    },

    5000
);


// =====================================================
// RAILWAY SHUTDOWN
// =====================================================

process.on(
    "SIGTERM",
    () => {

        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "[SYSTEM] SIGTERM empfangen."
        );

        console.log(
            "[SYSTEM] Railway beendet den Container."
        );

        console.log(
            "========================================"
        );


        if (
            mcBot
        ) {

            try {

                mcBot.quit(
                    "Container Shutdown"
                );

            } catch {}

        }


        setTimeout(
            () => {

                process.exit(0);

            },

            1000
        );

    }
);


process.on(
    "SIGINT",
    () => {

        console.log(
            "[SYSTEM] SIGINT empfangen."
        );


        if (
            mcBot
        ) {

            try {

                mcBot.quit(
                    "Container Shutdown"
                );

            } catch {}

        }


        process.exit(0);

    }
);


// =====================================================
// FEHLER
// =====================================================

process.on(
    "uncaughtException",
    error => {

        console.error("");

        console.error(
            "========================================"
        );

        console.error(
            "[SYSTEM] UNCAUGHT EXCEPTION"
        );

        console.error(
            error
        );

        console.error(
            "========================================"
        );

    }
);


process.on(
    "unhandledRejection",
    error => {

        console.error("");

        console.error(
            "========================================"
        );

        console.error(
            "[SYSTEM] UNHANDLED REJECTION"
        );

        console.error(
            error
        );

        console.error(
            "========================================"
        );

    }
);


// =====================================================
// DISCORD LOGIN
// =====================================================

console.log(
    "[SYSTEM] Starte Discord Login..."
);


client.login(
    TOKEN
);

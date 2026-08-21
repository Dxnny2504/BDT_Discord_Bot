require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const {
    spawn
} = require("child_process");

// ============================================================
// KONFIGURATION
// ============================================================

const DISCORD_TOKEN =
    process.env.DISCORD_TOKEN;

const OWNER_ID =
    process.env.DISCORD_OWNER_ID;

const MINECRAFT_FILE =
    path.join(
        __dirname,
        "index.js"
    );

// ============================================================
// DISCORD CLIENT
// ============================================================

const client =
    new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

// ============================================================
// STATUS
// ============================================================

let minecraftProcess =
    null;

let activeAFK =
    false;

let currentPanelMessage =
    null;

let minecraftOutputBuffer =
    "";

// ============================================================
// STARTUP
// ============================================================

console.log("");
console.log("========================================");
console.log("        AFK DISCORD BOT");
console.log("========================================");
console.log("");

// ============================================================
// DISCORD READY
// ============================================================

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

// ============================================================
// !AFK
// ============================================================

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

        if (
            OWNER_ID &&
            message.author.id !==
            OWNER_ID
        ) {
            return;
        }

        console.log(
            "[DISCORD] !afk empfangen."
        );

        try {

            const panel =
                await message.channel.send({
                    embeds: [
                        createAFKEmbed()
                    ],
                    components: [
                        createAFKButtons()
                    ]
                });

            currentPanelMessage =
                panel;

            console.log(
                "[DISCORD] AFK Panel erstellt."
            );

        } catch (error) {

            console.error(
                "[DISCORD ERROR] Panel konnte nicht erstellt werden:"
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

client.on(
    "interactionCreate",
    async interaction => {

        if (
            !interaction.isButton()
        ) {
            return;
        }

        const customId =
            interaction.customId;

        console.log(
            "[DISCORD] Button: " +
            customId
        );

        if (
            OWNER_ID &&
            interaction.user.id !==
            OWNER_ID
        ) {

            await interaction.reply({
                content:
                    "Keine Berechtigung.",
                ephemeral:
                    true
            });

            return;

        }

        // ====================================================
        // START
        // ====================================================

        if (
            customId ===
            "afk_start"
        ) {

            console.log(
                "[DISCORD] AFK Start gedrückt."
            );

            if (
                activeAFK &&
                minecraftProcess
            ) {

                await interaction.reply({
                    content:
                        "Der AFK Bot läuft bereits.",
                    ephemeral:
                        true
                });

                return;

            }

            await interaction.reply({
                content:
                    "Minecraft Bot wird gestartet.",
                ephemeral:
                    true
            });

            startMinecraft();

            return;

        }

        // ====================================================
        // STOP
        // ====================================================

        if (
            customId ===
            "afk_stop"
        ) {

            console.log(
                "[DISCORD] AFK Stopp gedrückt."
            );

            stopMinecraft();

            await interaction.reply({
                content:
                    "AFK Bot wurde gestoppt.",
                ephemeral:
                    true
            });

            return;

        }

        // ====================================================
        // RECONNECT
        // ====================================================

        if (
            customId ===
            "afk_reconnect"
        ) {

            console.log(
                "[DISCORD] Reconnect gedrückt."
            );

            stopMinecraft();

            await interaction.reply({
                content:
                    "Minecraft wird neu gestartet.",
                ephemeral:
                    true
            });

            setTimeout(
                () => {

                    startMinecraft();

                },
                1000
            );

            return;

        }

        // ====================================================
        // POSITION
        // ====================================================

        if (
            customId ===
            "afk_position"
        ) {

            await interaction.reply({
                content:
                    "Die aktuelle Minecraft Position wird im Railway Log angezeigt.",
                ephemeral:
                    true
            });

            return;

        }

        // ====================================================
        // REFRESH
        // ====================================================

        if (
            customId ===
            "afk_refresh"
        ) {

            await interaction.update({
                embeds: [
                    createAFKEmbed()
                ],
                components: [
                    createAFKButtons()
                ]
            });

            return;

        }

    }
);

// ============================================================
// AFK EMBED
// ============================================================

function createAFKEmbed() {

    return new EmbedBuilder()

        .setTitle(
            "GRIEFERGAMES AFK BOT"
        )

        .setDescription(
            "Steuerung für den Minecraft AFK Bot"
        )

        .addFields(

            {
                name:
                    "Status",

                value:
                    minecraftProcess
                        ? "ONLINE"
                        : "OFFLINE",

                inline:
                    true
            },

            {
                name:
                    "Minecraft",

                value:
                    activeAFK
                        ? "Aktiv"
                        : "Inaktiv",

                inline:
                    true
            },

            {
                name:
                    "Ablauf",

                value:
                    "GrieferGames\n" +
                    "/portal\n" +
                    "CB6 Portal\n" +
                    "12 Sekunden\n" +
                    "/home 55",

                inline:
                    false
            }

        )

        .setTimestamp();

}

// ============================================================
// BUTTONS
// ============================================================

function createAFKButtons() {

    return new ActionRowBuilder()

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

}

// ============================================================
// MINECRAFT START
// ============================================================

function startMinecraft() {

    if (
        activeAFK &&
        minecraftProcess
    ) {

        console.log(
            "[MC] Minecraft läuft bereits."
        );

        return;

    }

    if (
        !fs.existsSync(
            MINECRAFT_FILE
        )
    ) {

        console.error(
            "[MC] index.js wurde nicht gefunden."
        );

        return;

    }

    activeAFK =
        true;

    minecraftOutputBuffer =
        "";

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
        "[MC] Starte index.js..."
    );

    console.log(
        "[MC] Datei: " +
        MINECRAFT_FILE
    );

    try {

        minecraftProcess =
            spawn(
                process.execPath,
                [
                    MINECRAFT_FILE
                ],
                {
                    cwd:
                        __dirname,

                    env:
                        process.env,

                    stdio: [
                        "ignore",
                        "pipe",
                        "pipe"
                    ],

                    windowsHide:
                        true
                }
            );

        console.log(
            "[MC] Minecraft Prozess gestartet."
        );

        console.log(
            "[MC] PID: " +
            minecraftProcess.pid
        );

        // ====================================================
        // STDOUT
        // ====================================================

        minecraftProcess.stdout.on(
            "data",
            data => {

                const text =
                    data.toString();

                minecraftOutputBuffer +=
                    text;

                process.stdout.write(
                    "[MC] " +
                    text
                );

                updatePanel();

            }
        );

        // ====================================================
        // STDERR
        // ====================================================

        minecraftProcess.stderr.on(
            "data",
            data => {

                const text =
                    data.toString();

                process.stderr.write(
                    "[MC ERROR] " +
                    text
                );

            }
        );

        // ====================================================
        // PROCESS ERROR
        // ====================================================

        minecraftProcess.on(
            "error",
            error => {

                console.error(
                    "[MC ERROR] Minecraft Prozess konnte nicht gestartet werden:"
                );

                console.error(
                    error
                );

                activeAFK =
                    false;

                minecraftProcess =
                    null;

                updatePanel();

            }
        );

        // ====================================================
        // PROCESS CLOSE
        // ====================================================

        minecraftProcess.on(
            "close",
            (
                code,
                signal
            ) => {

                console.log("");
                console.log(
                    "[MC] Minecraft Prozess beendet."
                );

                console.log(
                    "[MC] Code: " +
                    code
                );

                console.log(
                    "[MC] Signal: " +
                    signal
                );

                activeAFK =
                    false;

                minecraftProcess =
                    null;

                minecraftOutputBuffer =
                    "";

                updatePanel();

            }
        );

    } catch (error) {

        console.error(
            "[MC ERROR] Minecraft Prozess konnte nicht gestartet werden:"
        );

        console.error(
            error
        );

        activeAFK =
            false;

        minecraftProcess =
            null;

    }

}

// ============================================================
// MINECRAFT STOPPEN
// ============================================================

function stopMinecraft() {

    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "        MINECRAFT BOT BEENDEN"
    );

    console.log(
        "========================================"
    );

    if (
        !minecraftProcess
    ) {

        console.log(
            "[MC] Kein Minecraft Prozess läuft."
        );

        activeAFK =
            false;

        updatePanel();

        return;

    }

    const pid =
        minecraftProcess.pid;

    console.log(
        "[MC] PID: " +
        pid
    );

    try {

        minecraftProcess.kill(
            "SIGTERM"
        );

        console.log(
            "[MC] Minecraft Prozess beendet."
        );

    } catch (error) {

        console.error(
            "[MC ERROR] Fehler beim Beenden:"
        );

        console.error(
            error
        );

    }

    activeAFK =
        false;

    minecraftProcess =
        null;

    updatePanel();

}

// ============================================================
// PANEL AKTUALISIEREN
// ============================================================

async function updatePanel() {

    if (
        !currentPanelMessage
    ) {

        return;

    }

    try {

        await currentPanelMessage.edit({

            embeds: [
                createAFKEmbed()
            ],

            components: [
                createAFKButtons()
            ]

        });

    } catch (error) {

        console.error(
            "[DISCORD] Panel konnte nicht aktualisiert werden."
        );

    }

}

// ============================================================
// DISCORD LOGIN
// ============================================================

console.log(
    "[SYSTEM] Starte Discord Login..."
);

client
    .login(
        DISCORD_TOKEN
    )
    .catch(
        error => {

            console.error(
                "[DISCORD ERROR] Login fehlgeschlagen:"
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
// PANEL UPDATE TIMER
// ============================================================

setInterval(
    () => {

        if (
            currentPanelMessage
        ) {

            updatePanel();

        }

    },
    5000
);

// ============================================================
// SYSTEM FEHLER
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

        client.destroy();

        process.exit(
            0
        );

    }
);

process.on(
    "SIGINT",
    () => {

        stopMinecraft();

        client.destroy();

        process.exit(
            0
        );

    }
);

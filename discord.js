const fs = require("fs");
const mineflayer = require("mineflayer");

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
    MessageFlags
} = require("discord.js");


// ============================================================
// RAILWAY VARIABLEN
// ============================================================

const DISCORD_TOKEN =
    process.env.DISCORD_TOKEN;

const DISCORD_OWNER_ID =
    process.env.DISCORD_OWNER_ID;

const MC_USERNAME =
    process.env.MC_USERNAME;

const MC_AUTH =
    process.env.MC_AUTH ||
    "microsoft";

const MC_AUTH_DIR =
    process.env.MC_AUTH_DIR ||
    "/data/minecraft_profiles";

const MC_HOST =
    process.env.MC_HOST ||
    "griefergames.net";

const MC_PORT =
    Number(
        process.env.MC_PORT ||
        25565
    );


// ============================================================
// VARIABLEN PRÜFEN
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
        console.error("========================================");
        console.error("FEHLENDE RAILWAY VARIABLEN");
        console.error("========================================");
        console.error(
            missing.join(", ")
        );
        console.error("========================================");
        console.error("");

        process.exit(1);
    }
}

checkEnvironment();


// ============================================================
// AUTH ORDNER
// ============================================================

try {

    fs.mkdirSync(
        MC_AUTH_DIR,
        {
            recursive: true
        }
    );

    console.log(
        "[AUTH] Speicher: " +
        MC_AUTH_DIR
    );

} catch (error) {

    console.error(
        "[AUTH ERROR] Auth Ordner konnte nicht erstellt werden."
    );

    console.error(error);

    process.exit(1);
}


// ============================================================
// DISCORD
// ============================================================

const discordClient =
    new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.DirectMessages
        ]
    });


// ============================================================
// STATUS
// ============================================================

let bot = null;

let starting = false;

let routeRunning = false;

let calibrationRunning = false;

let panelMessage = null;

let startedAt = null;

let lastAction =
    "Noch keine";

let manualStop =
    false;


// ============================================================
// CB6 ZIEL AUS UNSEREN VORHERIGEN TESTS
// ============================================================

const CB6_PORTAL = {
    x: 309.348,
    y: 67,
    z: 276.376
};


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


function setLastAction(action) {

    lastAction =
        action;

    console.log(
        "[MC] Aktion: " +
        action
    );
}


function getPosition() {

    if (
        !bot ||
        !bot.entity
    ) {
        return "Unbekannt";
    }

    const position =
        bot.entity.position;

    return (
        "X: " +
        position.x.toFixed(3) +
        " | Y: " +
        position.y.toFixed(3) +
        " | Z: " +
        position.z.toFixed(3)
    );
}


function getRotation() {

    if (
        !bot ||
        !bot.entity
    ) {
        return "Unbekannt";
    }

    const yaw =
        bot.entity.yaw;

    const pitch =
        bot.entity.pitch;

    return (
        "Yaw: " +
        yaw.toFixed(5) +
        " | Pitch: " +
        pitch.toFixed(5)
    );
}


function getRuntime() {

    if (!startedAt) {
        return "00:00:00";
    }

    const seconds =
        Math.floor(
            (
                Date.now() -
                startedAt
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
// PANEL
// ============================================================

function createPanel() {

    const online =
        !!(
            bot &&
            bot.entity
        );

    const embed =
        new EmbedBuilder()
            .setTitle(
                "GRIEFERGAMES AFK BOT"
            )
            .setDescription(
                "Kalibrierung der CB6 Route"
            )
            .addFields(

                {
                    name: "Status",
                    value:
                        online
                            ? "🟢 Online"
                            : "🔴 Offline",
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
                    name: "Blickrichtung",
                    value:
                        getRotation(),
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
                        "START"
                    )
                    .setStyle(
                        ButtonStyle.Success
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "afk_stop"
                    )
                    .setLabel(
                        "STOPP"
                    )
                    .setStyle(
                        ButtonStyle.Danger
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "afk_position"
                    )
                    .setLabel(
                        "POSITION"
                    )
                    .setStyle(
                        ButtonStyle.Secondary
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        "afk_refresh"
                    )
                    .setLabel(
                        "AKTUALISIEREN"
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

    } catch (error) {

        console.error(
            "[DISCORD] Panel Update fehlgeschlagen."
        );

        console.error(error);
    }
}


// ============================================================
// KALIBRIERUNG
// ============================================================

async function runCalibration() {

    if (
        !bot ||
        calibrationRunning
    ) {
        return;
    }

    calibrationRunning =
        true;

    console.log("");
    console.log(
        "========================================"
    );
    console.log(
        "        CB6 KALIBRIERUNG"
    );
    console.log(
        "========================================"
    );

    setLastAction(
        "/portal wird gesendet"
    );

    await updatePanel();


    // ========================================================
    // PORTAL
    // ========================================================

    console.log(
        "[CALIBRATION] Sende /portal..."
    );

    bot.chat(
        "/portal"
    );


    // ========================================================
    // WARTEN
    // ========================================================

    console.log(
        "[CALIBRATION] Warte 5 Sekunden..."
    );

    await sleep(
        5000
    );


    if (
        !bot ||
        manualStop
    ) {

        calibrationRunning =
            false;

        return;
    }


    // ========================================================
    // POSITION
    // ========================================================

    console.log("");
    console.log(
        "========================================"
    );
    console.log(
        "        PORTAL POSITION"
    );
    console.log(
        "========================================"
    );

    console.log(
        "[CALIBRATION] Position:"
    );

    console.log(
        getPosition()
    );

    console.log(
        "[CALIBRATION] Blickrichtung:"
    );

    console.log(
        getRotation()
    );

    console.log(
        "[CALIBRATION] Erwartetes Ziel:"
    );

    console.log(
        "X: " +
        CB6_PORTAL.x +
        " | Y: " +
        CB6_PORTAL.y +
        " | Z: " +
        CB6_PORTAL.z
    );

    console.log(
        "========================================"
    );


    setLastAction(
        "Portalraum kalibriert"
    );

    calibrationRunning =
        false;

    await updatePanel();
}


// ============================================================
// MINECRAFT START
// ============================================================

function startMinecraft() {

    if (starting) {

        console.log(
            "[MC] Minecraft startet bereits."
        );

        return;
    }

    if (bot) {

        console.log(
            "[MC] Minecraft läuft bereits."
        );

        return;
    }


    starting =
        true;

    manualStop =
        false;

    routeRunning =
        false;

    calibrationRunning =
        false;

    startedAt =
        Date.now();


    console.log("");
    console.log(
        "========================================"
    );
    console.log(
        "        MINECRAFT START"
    );
    console.log(
        "========================================"
    );

    console.log(
        "Account: " +
        MC_USERNAME
    );

    console.log(
        "Server: " +
        MC_HOST
    );

    console.log(
        "Port: " +
        MC_PORT
    );

    console.log(
        "Auth: " +
        MC_AUTH
    );

    console.log(
        "Auth Ordner: " +
        MC_AUTH_DIR
    );

    console.log(
        "Version: 1.8.9"
    );

    console.log(
        "========================================"
    );


    try {

        bot =
            mineflayer.createBot({

                host:
                    MC_HOST,

                port:
                    MC_PORT,

                username:
                    MC_USERNAME,

                auth:
                    MC_AUTH,

                profilesFolder:
                    MC_AUTH_DIR,

                version:
                    "1.8.9",

                onMsaCode:
                    data => {

                        console.log("");
                        console.log(
                            "========================================"
                        );
                        console.log(
                            "        MICROSOFT LOGIN"
                        );
                        console.log(
                            "========================================"
                        );

                        if (
                            data.verification_uri
                        ) {

                            console.log(
                                "Login Seite: " +
                                data.verification_uri
                            );
                        }

                        if (
                            data.user_code
                        ) {

                            console.log(
                                "Code: " +
                                data.user_code
                            );
                        }

                        console.log(
                            "========================================"
                        );
                        console.log("");
                    }
            });


        // ====================================================
        // LOGIN
        // ====================================================

        bot.once(
            "login",
            async () => {

                starting =
                    false;

                console.log(
                    "Minecraft Login erfolgreich."
                );

                setLastAction(
                    "Minecraft Login erfolgreich"
                );

                await updatePanel();
            }
        );


        // ====================================================
        // SPAWN
        // ====================================================

        bot.once(
            "spawn",
            async () => {

                starting =
                    false;

                console.log(
                    "Minecraft Spawn erfolgreich."
                );

                console.log(
                    "Minecraft Bot ist jetzt im Spiel."
                );

                setLastAction(
                    "Im Spiel"
                );

                await updatePanel();


                await sleep(
                    3000
                );


                if (
                    bot &&
                    !manualStop
                ) {

                    await runCalibration();
                }
            }
        );


        // ====================================================
        // CHAT
        // ====================================================

        bot.on(
            "messagestr",
            message => {

                console.log(
                    "[MC CHAT] " +
                    message
                );
            }
        );


        // ====================================================
        // KICK
        // ====================================================

        bot.on(
            "kicked",
            reason => {

                console.log("");
                console.log(
                    "[MC] Bot wurde gekickt."
                );

                console.log(
                    "[MC] Grund:"
                );

                console.log(
                    reason
                );

                setLastAction(
                    "Minecraft gekickt"
                );

                updatePanel();
            }
        );


        // ====================================================
        // ERROR
        // ====================================================

        bot.on(
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

                updatePanel();
            }
        );


        // ====================================================
        // END
        // ====================================================

        bot.on(
            "end",
            () => {

                console.log(
                    "[MC] Minecraft Verbindung beendet."
                );

                bot =
                    null;

                starting =
                    false;

                routeRunning =
                    false;

                calibrationRunning =
                    false;

                setLastAction(
                    "Minecraft Verbindung beendet"
                );

                updatePanel();
            }
        );


    } catch (error) {

        console.error(
            "[MC ERROR] Minecraft konnte nicht gestartet werden."
        );

        console.error(
            error
        );

        bot =
            null;

        starting =
            false;

        routeRunning =
            false;

        calibrationRunning =
            false;

        setLastAction(
            "Minecraft Start fehlgeschlagen"
        );

        updatePanel();
    }
}


// ============================================================
// MINECRAFT STOPP
// ============================================================

function stopMinecraft() {

    manualStop =
        true;

    routeRunning =
        false;

    calibrationRunning =
        false;

    startedAt =
        null;


    if (bot) {

        try {

            bot.clearControlStates();

            bot.quit(
                "AFK Bot gestoppt"
            );

        } catch (error) {

            console.error(
                "[MC ERROR] Fehler beim Stoppen."
            );

            console.error(
                error
            );
        }
    }


    bot =
        null;

    starting =
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
// DISCORD READY
// ============================================================

discordClient.once(
    Events.ClientReady,
    async () => {

        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "        DISCORD BOT ONLINE"
        );
        console.log(
            "========================================"
        );

        console.log(
            "Bot: " +
            discordClient.user.tag
        );

        console.log(
            "Owner ID: " +
            DISCORD_OWNER_ID
        );

        console.log(
            "========================================"
        );


        try {

            const owner =
                await discordClient.users.fetch(
                    DISCORD_OWNER_ID
                );

            const dm =
                await owner.createDM();

            panelMessage =
                await dm.send(
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
// BUTTONS
// ============================================================

discordClient.on(
    Events.InteractionCreate,
    async interaction => {

        if (
            !interaction.isButton()
        ) {
            return;
        }


        // ====================================================
        // BERECHTIGUNG
        // ====================================================

        if (
            interaction.user.id !==
            DISCORD_OWNER_ID
        ) {

            await interaction.reply({

                content:
                    "Keine Berechtigung.",

                flags:
                    MessageFlags.Ephemeral
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

            await interaction.reply({

                content:
                    "Minecraft Bot wird gestartet und nach dem Join kalibriert.",

                flags:
                    MessageFlags.Ephemeral
            });


            startMinecraft();

            return;
        }


        // ====================================================
        // STOPP
        // ====================================================

        if (
            interaction.customId ===
            "afk_stop"
        ) {

            stopMinecraft();


            await interaction.reply({

                content:
                    "AFK Bot wurde gestoppt.",

                flags:
                    MessageFlags.Ephemeral
            });

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
                    "Position:\n" +
                    getPosition() +
                    "\n\nBlickrichtung:\n" +
                    getRotation(),

                flags:
                    MessageFlags.Ephemeral
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
// PANEL AUTO UPDATE
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

        stopMinecraft();

        discordClient.destroy();

        process.exit(0);
    }
);


process.on(
    "SIGINT",
    () => {

        stopMinecraft();

        discordClient.destroy();

        process.exit(0);
    }
);


// ============================================================
// START
// ============================================================

console.log(
    "========================================"
);

console.log(
    "        DISCORD MINECRAFT BOT"
);

console.log(
    "========================================"
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

            process.exit(1);
        }
    );

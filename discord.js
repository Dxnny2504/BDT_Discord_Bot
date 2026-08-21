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

const { Vec3 } = require("vec3");


// ============================================================
// RAILWAY
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

        console.error(
            "[SYSTEM] Fehlende Variablen:",
            missing.join(", ")
        );

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

} catch (error) {

    console.error(
        "[AUTH] Auth Ordner konnte nicht erstellt werden."
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
// MINECRAFT
// ============================================================

let bot = null;

let starting = false;

let routeRunning = false;

let panelMessage = null;

let startedAt = null;

let lastAction =
    "Noch keine";

let manualStop = false;


// ============================================================
// CB6 ZIEL
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
        resolve => setTimeout(
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

    const p =
        bot.entity.position;

    return (
        `X: ${p.x.toFixed(3)} | ` +
        `Y: ${p.y.toFixed(3)} | ` +
        `Z: ${p.z.toFixed(3)}`
    );
}


function getDistanceToCB6() {

    if (
        !bot ||
        !bot.entity
    ) {
        return null;
    }

    const p =
        bot.entity.position;

    const dx =
        CB6_PORTAL.x - p.x;

    const dz =
        CB6_PORTAL.z - p.z;

    return Math.sqrt(
        dx * dx +
        dz * dz
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
// DISCORD PANEL
// ============================================================

function createPanel() {

    const online =
        !!(
            bot &&
            bot.entity
        );

    const distance =
        getDistanceToCB6();

    const embed =
        new EmbedBuilder()
            .setTitle(
                "GRIEFERGAMES AFK BOT"
            )
            .setDescription(
                "Minecraft AFK Steuerung"
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
                    name: "Entfernung zu CB6",
                    value:
                        distance === null
                            ? "Unbekannt"
                            : `${distance.toFixed(2)} Blöcke`,
                    inline: true
                },

                {
                    name: "Route",
                    value:
                        routeRunning
                            ? "🟡 Zum CB6 Portal"
                            : "⚪ Keine Route",
                    inline: true
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
// PANEL UPDATE
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
// /PORTAL
// ============================================================

async function enterPortalRoom() {

    if (!bot) {
        return false;
    }

    setLastAction(
        "/portal"
    );

    console.log(
        "[ROUTE] Sende /portal..."
    );

    bot.chat(
        "/portal"
    );

    await sleep(
        5000
    );

    if (!bot) {
        return false;
    }

    console.log(
        "[ROUTE] Portalraum erreicht."
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );

    return true;
}


// ============================================================
// ZIELBLICKRICHTUNG
// ============================================================

async function lookAtCB6() {

    if (!bot) {
        return false;
    }

    const target =
        new Vec3(
            CB6_PORTAL.x,
            CB6_PORTAL.y,
            CB6_PORTAL.z
        );

    console.log(
        "[ROUTE] Drehe direkt auf das CB6 Portal."
    );

    await bot.lookAt(
        target,
        true
    );

    await sleep(500);

    console.log(
        "[ROUTE] Blickrichtung auf Ziel gesetzt."
    );

    return true;
}


// ============================================================
// ZUM ZIEL LAUFEN
// ============================================================

async function walkToCB6() {

    if (!bot) {
        return false;
    }

    console.log("");
    console.log(
        "========================================"
    );
    console.log(
        "        LAUFE ZUM CB6 PORTAL"
    );
    console.log(
        "========================================"
    );

    console.log(
        "[ROUTE] Startposition: " +
        getPosition()
    );

    console.log(
        "[ROUTE] Ziel:"
    );

    console.log(
        `X: ${CB6_PORTAL.x} | ` +
        `Y: ${CB6_PORTAL.y} | ` +
        `Z: ${CB6_PORTAL.z}`
    );


    await lookAtCB6();


    if (!bot) {
        return false;
    }


    bot.setControlState(
        "forward",
        true
    );

    bot.setControlState(
        "sprint",
        true
    );


    const maxRunTime =
        5000;

    const start =
        Date.now();


    let lastLog =
        0;


    while (
        bot &&
        routeRunning &&
        Date.now() - start < maxRunTime
    ) {

        const distance =
            getDistanceToCB6();


        if (
            distance !== null &&
            distance <= 1.0
        ) {

            console.log("");
            console.log(
                "[ROUTE] Zielbereich erreicht."
            );

            console.log(
                "[ROUTE] Entfernung: " +
                distance.toFixed(3)
            );

            break;
        }


        if (
            Date.now() - lastLog >= 500
        ) {

            lastLog =
                Date.now();

            console.log(
                "[ROUTE] Position: " +
                getPosition()
            );

            if (distance !== null) {

                console.log(
                    "[ROUTE] Entfernung: " +
                    distance.toFixed(3)
                );
            }
        }


        await sleep(
            50
        );
    }


    bot.setControlState(
        "forward",
        false
    );

    bot.setControlState(
        "sprint",
        false
    );


    if (!bot) {
        return false;
    }


    const finalDistance =
        getDistanceToCB6();


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "[ROUTE] Bewegung beendet."
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );

    console.log(
        "[ROUTE] Entfernung zum CB6 Portal: " +
        (
            finalDistance === null
                ? "Unbekannt"
                : finalDistance.toFixed(3)
        )
    );

    console.log(
        "========================================"
    );


    if (
        finalDistance !== null &&
        finalDistance <= 1.5
    ) {

        setLastAction(
            "CB6 Portal erreicht"
        );

        return true;
    }


    setLastAction(
        "CB6 Ziel nicht erreicht"
    );

    return false;
}


// ============================================================
// CB6 ROUTE
// ============================================================

async function startCB6Route() {

    if (
        !bot ||
        routeRunning
    ) {
        return;
    }

    routeRunning =
        true;


    console.log("");
    console.log(
        "========================================"
    );
    console.log(
        "        CB6 ROUTE"
    );
    console.log(
        "========================================"
    );


    setLastAction(
        "Starte CB6 Route"
    );

    await updatePanel();


    // ========================================================
    // PORTAL
    // ========================================================

    const portalSuccess =
        await enterPortalRoom();


    if (
        !portalSuccess ||
        !bot ||
        !routeRunning
    ) {

        routeRunning =
            false;

        return;
    }


    setLastAction(
        "Portalraum erreicht"
    );

    await updatePanel();


    // ========================================================
    // ZUM CB6 PORTAL
    // ========================================================

    const success =
        await walkToCB6();


    if (
        success &&
        bot
    ) {

        console.log(
            "[ROUTE] CB6 Portal erfolgreich erreicht."
        );

        routeRunning =
            false;

        setLastAction(
            "CB6 Portal erreicht"
        );

    } else {

        console.log(
            "[ROUTE] CB6 Portal nicht erreicht."
        );

        routeRunning =
            false;

        setLastAction(
            "CB6 Route fehlgeschlagen"
        );
    }


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

                    await startCB6Route();
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

        setLastAction(
            "Minecraft Start fehlgeschlagen"
        );

        updatePanel();
    }
}


// ============================================================
// STOPP
// ============================================================

function stopMinecraft() {

    manualStop =
        true;

    routeRunning =
        false;

    startedAt =
        null;


    if (bot) {

        try {

            bot.clearControlStates();

            bot.quit(
                "AFK Bot gestoppt"
            );

        } catch {}
    }


    bot =
        null;

    starting =
        false;


    setLastAction(
        "AFK gestoppt"
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
                "[DISCORD] Panel konnte nicht erstellt werden."
            );

            console.error(error);
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


        if (
            interaction.customId ===
            "afk_start"
        ) {

            await interaction.reply({

                content:
                    "Minecraft Bot wird gestartet und danach zum CB6 Portal bewegt.",

                flags:
                    MessageFlags.Ephemeral
            });


            startMinecraft();

            return;
        }


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


        if (
            interaction.customId ===
            "afk_position"
        ) {

            const distance =
                getDistanceToCB6();


            await interaction.reply({

                content:
                    "Position:\n" +
                    getPosition() +
                    "\n\n" +
                    "Entfernung zu CB6:\n" +
                    (
                        distance === null
                            ? "Unbekannt"
                            : `${distance.toFixed(3)} Blöcke`
                    ),

                flags:
                    MessageFlags.Ephemeral
            });

            return;
        }


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
            "[SYSTEM ERROR]",
            error
        );
    }
);


process.on(
    "unhandledRejection",
    error => {

        console.error(
            "[SYSTEM ERROR]",
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
                "[DISCORD ERROR]",
                error
            );

            process.exit(1);
        }
    );

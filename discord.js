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
// PRÜFUNG
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
            "Fehlende Railway Variablen:"
        );

        console.error(
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

    console.log(
        "[AUTH] Speicher: " +
        MC_AUTH_DIR
    );

} catch (error) {

    console.error(
        "[AUTH] Ordner konnte nicht erstellt werden."
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

let panelMessage = null;

let startedAt = null;

let lastAction =
    "Noch keine";

let manualStop = false;

let waitingForTeleport = false;

let homeCommandSent = false;


// ============================================================
// KOORDINATEN
// ============================================================

// Ausgangsposition nach /portal

const PORTAL_START = {
    x: 325.000,
    y: 67.000,
    z: 280.000
};


// Exakte Portalposition aus dem Video

const CB6_PORTAL = {
    x: 308.811,
    y: 67.000,
    z: 276.557
};


// Position nach dem Teleport laut Video

const CB6_AFTER_TELEPORT = {
    x: 215.000,
    y: 67.000,
    z: 371.000
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

    const p =
        bot.entity.position;

    return (
        "X: " +
        p.x.toFixed(3) +
        " | Y: " +
        p.y.toFixed(3) +
        " | Z: " +
        p.z.toFixed(3)
    );
}


function getDistance(
    target
) {

    if (
        !bot ||
        !bot.entity
    ) {
        return null;
    }

    const p =
        bot.entity.position;

    const dx =
        target.x -
        p.x;

    const dz =
        target.z -
        p.z;

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
// AUF PORTAL SCHAUEN
// ============================================================

async function lookAtPortal() {

    if (!bot) {
        return;
    }

    const position =
        bot.entity.position;

    const dx =
        CB6_PORTAL.x -
        position.x;

    const dz =
        CB6_PORTAL.z -
        position.z;


    const yaw =
        Math.atan2(
            -dx,
            -dz
        );


    console.log(
        "[ROUTE] Berechne Blickrichtung zum CB6 Portal."
    );


    await bot.look(
        yaw,
        0,
        true
    );


    await sleep(
        500
    );


    console.log(
        "[ROUTE] Blickrichtung gesetzt."
    );
}


// ============================================================
// VORWÄRTS
// ============================================================

async function moveForward() {

    if (
        !bot ||
        !routeRunning
    ) {
        return;
    }

    bot.setControlState(
        "forward",
        true
    );

    bot.setControlState(
        "sprint",
        true
    );
}


// ============================================================
// BEWEGUNG STOPPEN
// ============================================================

function stopMovement() {

    if (!bot) {
        return;
    }

    bot.setControlState(
        "forward",
        false
    );

    bot.setControlState(
        "sprint",
        false
    );

    bot.setControlState(
        "jump",
        false
    );
}


// ============================================================
// PORTAL BETRETEN
// ============================================================

async function walkToCB6Portal() {

    if (
        !bot ||
        !routeRunning
    ) {
        return false;
    }


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "        CB6 PORTAL ROUTE"
    );

    console.log(
        "========================================"
    );


    console.log(
        "[ROUTE] Startposition:"
    );

    console.log(
        getPosition()
    );


    console.log(
        "[ROUTE] Zielposition:"
    );

    console.log(
        "X: " +
        CB6_PORTAL.x +
        " | Y: " +
        CB6_PORTAL.y +
        " | Z: " +
        CB6_PORTAL.z
    );


    setLastAction(
        "Laufe zum CB6 Portal"
    );


    await lookAtPortal();


    if (
        !bot ||
        !routeRunning
    ) {
        return false;
    }


    moveForward();


    const start =
        Date.now();


    const maximumTime =
        8000;


    let lastPositionLog =
        0;


    while (
        bot &&
        routeRunning &&
        Date.now() - start < maximumTime
    ) {

        const distance =
            getDistance(
                CB6_PORTAL
            );


        if (
            distance !== null &&
            distance <= 0.65
        ) {

            console.log(
                "[ROUTE] Portalposition erreicht."
            );

            console.log(
                "[ROUTE] Entfernung: " +
                distance.toFixed(3)
            );

            break;
        }


        if (
            Date.now() -
            lastPositionLog >=
            500
        ) {

            lastPositionLog =
                Date.now();


            console.log(
                "[ROUTE] Position: " +
                getPosition()
            );


            if (
                distance !== null
            ) {

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


    stopMovement();


    if (!bot) {
        return false;
    }


    console.log(
        "[ROUTE] Bewegung zum Portal beendet."
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );


    waitingForTeleport =
        true;

    setLastAction(
        "Warte auf CB6 Teleport"
    );


    return true;
}


// ============================================================
// TELEPORT ERKENNEN
// ============================================================

async function waitForCB6Teleport() {

    if (!bot) {
        return false;
    }


    console.log("");
    console.log(
        "[ROUTE] Warte auf Teleport nach CB6..."
    );


    const start =
        Date.now();


    const maximumWait =
        20000;


    while (
        bot &&
        routeRunning &&
        Date.now() - start < maximumWait
    ) {

        const position =
            bot.entity.position;


        const dx =
            Math.abs(
                position.x -
                CB6_PORTAL.x
            );

        const dz =
            Math.abs(
                position.z -
                CB6_PORTAL.z
            );


        if (
            dx > 30 ||
            dz > 30
        ) {

            console.log("");
            console.log(
                "========================================"
            );

            console.log(
                "        CB6 TELEPORT ERKANNT"
            );

            console.log(
                "========================================"
            );

            console.log(
                "[ROUTE] Neue Position:"
            );

            console.log(
                getPosition()
            );


            waitingForTeleport =
                false;


            setLastAction(
                "CB6 erreicht"
            );


            return true;
        }


        await sleep(
            100
        );
    }


    waitingForTeleport =
        false;


    console.log(
        "[ROUTE] Kein Teleport erkannt."
    );


    setLastAction(
        "Teleport nicht erkannt"
    );


    return false;
}


// ============================================================
// /HOME 55
// ============================================================

async function sendHome55() {

    if (
        !bot ||
        homeCommandSent
    ) {
        return;
    }


    homeCommandSent =
        true;


    console.log(
        "[ROUTE] Warte vor /home 55..."
    );


    setLastAction(
        "Warte vor /home 55"
    );


    await updatePanel();


    await sleep(
        3000
    );


    if (!bot) {
        return;
    }


    console.log(
        "[ROUTE] Sende /home 55..."
    );


    bot.chat(
        "/home 55"
    );


    setLastAction(
        "/home 55 gesendet"
    );


    await updatePanel();


    console.log(
        "[ROUTE] /home 55 gesendet."
    );
}


// ============================================================
// KOMPLETTE ROUTE
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

    homeCommandSent =
        false;

    waitingForTeleport =
        false;


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "        CB6 ABLAUF START"
    );

    console.log(
        "========================================"
    );


    // ========================================================
    // /PORTAL
    // ========================================================

    setLastAction(
        "Sende /portal"
    );

    await updatePanel();


    console.log(
        "[ROUTE] Sende /portal..."
    );


    bot.chat(
        "/portal"
    );


    await sleep(
        5000
    );


    if (
        !bot ||
        !routeRunning
    ) {
        return;
    }


    console.log(
        "[ROUTE] Portalraum:"
    );

    console.log(
        getPosition()
    );


    // ========================================================
    // CB6 PORTAL
    // ========================================================

    await walkToCB6Portal();


    if (
        !bot ||
        !routeRunning
    ) {
        return;
    }


    // ========================================================
    // TELEPORT
    // ========================================================

    const teleported =
        await waitForCB6Teleport();


    if (
        !teleported ||
        !bot ||
        !routeRunning
    ) {

        routeRunning =
            false;

        await updatePanel();

        return;
    }


    // ========================================================
    // /HOME 55
    // ========================================================

    await sendHome55();


    routeRunning =
        false;


    setLastAction(
        "CB6 Ablauf abgeschlossen"
    );


    await updatePanel();


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "        CB6 ABLAUF FERTIG"
    );

    console.log(
        "========================================"
    );
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

                    startCB6Route();
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

                waitingForTeleport =
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

    waitingForTeleport =
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
// DISCORD PANEL
// ============================================================

function createPanel() {

    const online =
        !!(
            bot &&
            bot.entity
        );


    const distance =
        getDistance(
            CB6_PORTAL
        );


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
                    name: "CB6 Entfernung",
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
                            ? "🟡 Aktiv"
                            : "⚪ Inaktiv",
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
// DISCORD PANEL AKTUALISIEREN
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
    }
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
                    "Minecraft Bot wird gestartet und die CB6 Route beginnt automatisch.",

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
                getDistance(
                    CB6_PORTAL
                );


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
            "[SYSTEM ERROR]"
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
            "[SYSTEM ERROR]"
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

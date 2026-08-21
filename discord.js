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
        "[AUTH ERROR]",
        error
    );

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
// MINECRAFT STATUS
// ============================================================

let bot = null;

let starting = false;

let routeRunning = false;

let panelMessage = null;

let startedAt = null;

let lastAction =
    "Noch keine";

let manualStop = false;

let teleportWaiting = false;


// ============================================================
// CB6 ROUTE
// ============================================================

// Exakte Wegpunkte aus dem Video

const ROUTE_POINTS = [

    {
        name: "Start",
        x: 325.000,
        y: 67.000,
        z: 280.000
    },

    {
        name: "Wegpunkt 1",
        x: 324.994,
        y: 66.921,
        z: 277.884
    },

    {
        name: "Wegpunkt 2",
        x: 317.437,
        y: 66.000,
        z: 275.537
    },

    {
        name: "Wegpunkt 3",
        x: 314.302,
        y: 66.000,
        z: 276.543
    },

    {
        name: "Wegpunkt 4",
        x: 311.617,
        y: 66.000,
        z: 276.551
    },

    {
        name: "CB6 Portal",
        x: 308.811,
        y: 67.000,
        z: 276.557
    }

];


// ============================================================
// ZIEL NACH TELEPORT
// ============================================================

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


function distanceToPoint(point) {

    if (
        !bot ||
        !bot.entity
    ) {

        return null;
    }

    const p =
        bot.entity.position;

    const dx =
        point.x -
        p.x;

    const dy =
        point.y -
        p.y;

    const dz =
        point.z -
        p.z;

    return Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz
    );
}


function horizontalDistanceToPoint(point) {

    if (
        !bot ||
        !bot.entity
    ) {

        return null;
    }

    const p =
        bot.entity.position;

    const dx =
        point.x -
        p.x;

    const dz =
        point.z -
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
        "back",
        false
    );

    bot.setControlState(
        "left",
        false
    );

    bot.setControlState(
        "right",
        false
    );

    bot.setControlState(
        "jump",
        false
    );

    bot.setControlState(
        "sprint",
        false
    );
}


// ============================================================
// AUF WEGPUNKT SCHAUEN
// ============================================================

async function lookAtPoint(point) {

    if (!bot) {

        return false;
    }

    console.log(
        "[ROUTE] Blick auf " +
        point.name
    );

    await bot.lookAt(
        {
            x: point.x,
            y: point.y,
            z: point.z
        },
        true
    );

    await sleep(
        300
    );

    return true;
}


// ============================================================
// WEGPUNKT ANLAUFEN
// ============================================================

async function moveToPoint(
    point
) {

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
        "[ROUTE] " +
        point.name
    );

    console.log(
        "========================================"
    );


    console.log(
        "[ROUTE] Aktuelle Position: " +
        getPosition()
    );


    console.log(
        "[ROUTE] Ziel:"
    );

    console.log(
        "X: " +
        point.x +
        " | Y: " +
        point.y +
        " | Z: " +
        point.z
    );


    await lookAtPoint(
        point
    );


    if (
        !bot ||
        !routeRunning
    ) {

        return false;
    }


    setLastAction(
        "Laufe zu " +
        point.name
    );


    bot.setControlState(
        "forward",
        true
    );

    bot.setControlState(
        "sprint",
        false
    );


    const start =
        Date.now();


    const timeout =
        7000;


    let lastLog =
        0;


    while (
        bot &&
        routeRunning &&
        Date.now() - start < timeout
    ) {

        const distance =
            horizontalDistanceToPoint(
                point
            );


        if (
            distance !== null &&
            distance <= 0.45
        ) {

            break;
        }


        if (
            Date.now() -
            lastLog >=
            500
        ) {

            lastLog =
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


    const finalDistance =
        horizontalDistanceToPoint(
            point
        );


    console.log(
        "[ROUTE] Bewegung beendet."
    );


    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );


    console.log(
        "[ROUTE] Entfernung: " +
        (
            finalDistance === null
                ? "Unbekannt"
                : finalDistance.toFixed(3)
        )
    );


    if (
        finalDistance !== null &&
        finalDistance <= 0.75
    ) {

        console.log(
            "[ROUTE] " +
            point.name +
            " erreicht."
        );

        return true;
    }


    console.log(
        "[ROUTE] " +
        point.name +
        " NICHT erreicht."
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
        "        CB6 ROUTE START"
    );

    console.log(
        "========================================"
    );


    // ========================================================
    // PORTAL
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
        "[ROUTE] Portalraum Position: " +
        getPosition()
    );


    // ========================================================
    // WEGPUNKT 1
    // ========================================================

    let success =
        await moveToPoint(
            ROUTE_POINTS[1]
        );


    if (
        !success
    ) {

        routeFailed(
            "Wegpunkt 1 nicht erreicht"
        );

        return;
    }


    await sleep(
        300
    );


    // ========================================================
    // WEGPUNKT 2
    // ========================================================

    success =
        await moveToPoint(
            ROUTE_POINTS[2]
        );


    if (
        !success
    ) {

        routeFailed(
            "Wegpunkt 2 nicht erreicht"
        );

        return;
    }


    await sleep(
        300
    );


    // ========================================================
    // WEGPUNKT 3
    // ========================================================

    success =
        await moveToPoint(
            ROUTE_POINTS[3]
        );


    if (
        !success
    ) {

        routeFailed(
            "Wegpunkt 3 nicht erreicht"
        );

        return;
    }


    await sleep(
        300
    );


    // ========================================================
    // WEGPUNKT 4
    // ========================================================

    success =
        await moveToPoint(
            ROUTE_POINTS[4]
        );


    if (
        !success
    ) {

        routeFailed(
            "Wegpunkt 4 nicht erreicht"
        );

        return;
    }


    await sleep(
        300
    );


    // ========================================================
    // CB6 PORTAL
    // ========================================================

    success =
        await moveToPoint(
            ROUTE_POINTS[5]
        );


    if (
        !success
    ) {

        routeFailed(
            "CB6 Portal nicht erreicht"
        );

        return;
    }


    stopMovement();


    teleportWaiting =
        true;


    setLastAction(
        "CB6 Portal erreicht"
    );


    await updatePanel();


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "        CB6 PORTAL ERREICHT"
    );

    console.log(
        "========================================"
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );


    // ========================================================
    // TELEPORT WARTEN
    // ========================================================

    await waitForTeleport();
}


// ============================================================
// ROUTE FEHLER
// ============================================================

function routeFailed(
    reason
) {

    stopMovement();

    routeRunning =
        false;

    teleportWaiting =
        false;


    setLastAction(
        reason
    );


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "        ROUTE FEHLGESCHLAGEN"
    );

    console.log(
        "========================================"
    );

    console.log(
        "[ROUTE] " +
        reason
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );

    console.log(
        "========================================"
    );


    updatePanel();
}


// ============================================================
// TELEPORT ERKENNEN
// ============================================================

async function waitForTeleport() {

    if (
        !bot
    ) {

        return;
    }


    console.log(
        "[ROUTE] Warte auf CB6 Teleport..."
    );


    const start =
        Date.now();


    const timeout =
        15000;


    while (
        bot &&
        routeRunning &&
        Date.now() -
        start <
        timeout
    ) {

        const position =
            bot.entity.position;


        const distance =
            horizontalDistanceToPoint(
                CB6_AFTER_TELEPORT
            );


        if (
            distance !== null &&
            distance < 80
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
                "[ROUTE] Position: " +
                getPosition()
            );


            teleportWaiting =
                false;


            setLastAction(
                "CB6 Teleport erkannt"
            );


            await updatePanel();


            await sleep(
                3000
            );


            if (
                bot &&
                routeRunning
            ) {

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
            }


            routeRunning =
                false;


            return;
        }


        await sleep(
            100
        );
    }


    teleportWaiting =
        false;


    routeRunning =
        false;


    setLastAction(
        "Kein CB6 Teleport erkannt"
    );


    console.log(
        "[ROUTE] Kein Teleport erkannt."
    );


    await updatePanel();
}


// ============================================================
// MINECRAFT START
// ============================================================

function startMinecraft() {

    if (
        starting
    ) {

        console.log(
            "[MC] Minecraft startet bereits."
        );

        return;
    }


    if (
        bot
    ) {

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

    teleportWaiting =
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

                teleportWaiting =
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

    teleportWaiting =
        false;

    startedAt =
        null;


    stopMovement();


    if (
        bot
    ) {

        try {

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
        bot
            ? horizontalDistanceToPoint(
                ROUTE_POINTS[5]
            )
            : null;


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
                "[DISCORD] Panel Fehler:",
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


        // ====================================================
        // START
        // ====================================================

        if (
            interaction.customId ===
            "afk_start"
        ) {

            await interaction.reply({

                content:
                    "Minecraft Bot wird gestartet und fährt danach automatisch die CB6 Route ab.",

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
                    "Aktuelle Position:\n" +
                    getPosition(),

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
// AUTO UPDATE
// ============================================================

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

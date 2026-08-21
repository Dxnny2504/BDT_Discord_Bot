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
        console.error(
            "========================================"
        );
        console.error(
            "FEHLENDE RAILWAY VARIABLEN"
        );
        console.error(
            "========================================"
        );

        console.error(
            missing.join(", ")
        );

        console.error(
            "========================================"
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

let teleportWaiting = false;

let cooldownActive = false;

let portalRetryRunning = false;

let panelMessage = null;

let startedAt = null;

let lastAction =
    "Noch keine";

let manualStop = false;


// ============================================================
// ZIEL
// ============================================================

const PORTAL_TARGET = {
    x: 307,
    y: 67,
    z: 276
};


// Position, bei der wir über die Kante springen

const JUMP_POINT_X =
    312.0;


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


function getRotation() {

    if (
        !bot ||
        !bot.entity
    ) {

        return "Unbekannt";
    }

    return (
        "Yaw: " +
        bot.entity.yaw.toFixed(5) +
        " | Pitch: " +
        bot.entity.pitch.toFixed(5)
    );
}


function getHorizontalDistance(target) {

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
// ZIELBLICK
// ============================================================

async function lookAtTarget(target) {

    if (!bot) {
        return false;
    }

    const position =
        bot.entity.position;

    const dx =
        target.x -
        position.x;

    const dy =
        target.y -
        (position.y + 1.62);

    const dz =
        target.z -
        position.z;

    const horizontal =
        Math.sqrt(
            dx * dx +
            dz * dz
        );

    const yaw =
        Math.atan2(
            -dx,
            -dz
        );

    const pitch =
        Math.atan2(
            dy,
            horizontal
        );

    console.log(
        "[ROUTE] Zielblick:"
    );

    console.log(
        "Yaw: " +
        yaw.toFixed(5)
    );

    console.log(
        "Pitch: " +
        pitch.toFixed(5)
    );

    await bot.look(
        yaw,
        pitch,
        true
    );

    await sleep(
        300
    );

    console.log(
        "[ROUTE] Rotation: " +
        getRotation()
    );

    return true;
}


// ============================================================
// ERNEUT INS PORTAL LAUFEN
// ============================================================

async function retryPortalEntry() {

    if (
        !bot ||
        !routeRunning ||
        portalRetryRunning
    ) {

        return;
    }

    portalRetryRunning =
        true;

    cooldownActive =
        false;


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "        PORTAL ERNEUT BETRETEN"
    );

    console.log(
        "========================================"
    );


    setLastAction(
        "Betrete CB6 Portal erneut"
    );


    await updatePanel();


    if (!bot) {

        portalRetryRunning =
            false;

        return;
    }


    // Wir schauen leicht in Richtung des eigentlichen Portals

    await lookAtTarget(
        PORTAL_TARGET
    );


    if (!bot) {

        portalRetryRunning =
            false;

        return;
    }


    console.log(
        "[PORTAL] Laufe erneut ins Portal."
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
        2500;


    while (
        bot &&
        routeRunning &&
        Date.now() -
        start <
        timeout
    ) {

        console.log(
            "[PORTAL] Position: " +
            getPosition()
        );

        await sleep(
            200
        );
    }


    stopMovement();


    portalRetryRunning =
        false;


    if (!bot) {
        return;
    }


    console.log(
        "[PORTAL] Erneuter Portaleintritt beendet."
    );


    setLastAction(
        "Warte auf CB6 Teleport"
    );


    teleportWaiting =
        true;


    await updatePanel();
}


// ============================================================
// 12 SEKUNDEN COOLDOWN
// ============================================================

async function handleTeleportCooldown() {

    if (
        !bot ||
        !routeRunning ||
        cooldownActive
    ) {

        return;
    }


    cooldownActive =
        true;

    teleportWaiting =
        false;


    stopMovement();


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "        TELEPORT COOLDOWN"
    );

    console.log(
        "========================================"
    );

    console.log(
        "[PORTAL] GrieferGames verlangt 12 Sekunden."
    );

    console.log(
        "[PORTAL] Bot bleibt stehen."
    );


    setLastAction(
        "12 Sekunden Teleport Cooldown"
    );


    await updatePanel();


    for (
        let seconds = 12;
        seconds > 0;
        seconds--
    ) {

        if (
            !bot ||
            !routeRunning ||
            manualStop
        ) {

            return;
        }


        console.log(
            "[PORTAL] Warte noch " +
            seconds +
            " Sekunden."
        );


        setLastAction(
            "Teleport Cooldown: " +
            seconds +
            "s"
        );


        await updatePanel();


        await sleep(
            1000
        );
    }


    if (
        !bot ||
        !routeRunning
    ) {

        return;
    }


    console.log(
        "[PORTAL] Cooldown vorbei."
    );


    await retryPortalEntry();
}


// ============================================================
// PORTAL ROUTE
// ============================================================

async function runPortalRoute() {

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
        "        PORTAL ROUTE"
    );

    console.log(
        "========================================"
    );


    console.log(
        "[ROUTE] Startposition: " +
        getPosition()
    );


    console.log(
        "[ROUTE] Ziel: X 307 | Y 67 | Z 276"
    );


    // ========================================================
    // AUF ZIEL AUSRICHTEN
    // ========================================================

    setLastAction(
        "Richte auf 307 / 67 / 276"
    );


    await lookAtTarget(
        PORTAL_TARGET
    );


    if (
        !bot ||
        !routeRunning
    ) {

        return false;
    }


    // ========================================================
    // LAUFEN
    // ========================================================

    console.log(
        "[ROUTE] Laufe zum Portal."
    );


    setLastAction(
        "Laufe zum CB6 Portal"
    );


    bot.setControlState(
        "forward",
        true
    );

    bot.setControlState(
        "sprint",
        false
    );


    let jumped =
        false;

    let lastLog =
        0;

    const start =
        Date.now();

    const timeout =
        9000;


    while (
        bot &&
        routeRunning &&
        Date.now() -
        start <
        timeout
    ) {

        const position =
            bot.entity.position;


        // ====================================================
        // SPRUNG
        // ====================================================

        if (
            !jumped &&
            position.x <=
            JUMP_POINT_X
        ) {

            jumped =
                true;


            console.log("");
            console.log(
                "========================================"
            );

            console.log(
                "[ROUTE] KANTE ERREICHT"
            );

            console.log(
                "========================================"
            );


            console.log(
                "[ROUTE] Position: " +
                getPosition()
            );


            console.log(
                "[ROUTE] Springe über die Kante."
            );


            bot.setControlState(
                "jump",
                true
            );


            await sleep(
                400
            );


            if (bot) {

                bot.setControlState(
                    "jump",
                    false
                );
            }
        }


        // ====================================================
        // ZIELBEREICH
        // ====================================================

        const distance =
            getHorizontalDistance(
                PORTAL_TARGET
            );


        if (
            distance !== null &&
            distance <= 1.0
        ) {

            console.log("");
            console.log(
                "========================================"
            );

            console.log(
                "[ROUTE] PORTALBEREICH ERREICHT"
            );

            console.log(
                "========================================"
            );

            console.log(
                "[ROUTE] Position: " +
                getPosition()
            );

            console.log(
                "[ROUTE] Entfernung: " +
                distance.toFixed(3)
            );


            break;
        }


        // ====================================================
        // LOG
        // ====================================================

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


    if (
        !bot ||
        !routeRunning
    ) {

        return false;
    }


    console.log(
        "[ROUTE] Position nach Portalbewegung: " +
        getPosition()
    );


    teleportWaiting =
        true;


    setLastAction(
        "Warte auf Portalantwort"
    );


    await updatePanel();


    return true;
}


// ============================================================
// TELEPORT NACH CB6
// ============================================================

async function waitForCB6Teleport() {

    if (!bot) {
        return false;
    }


    console.log("");
    console.log(
        "========================================"
    );

    console.log(
        "        WARTE AUF CB6"
    );

    console.log(
        "========================================"
    );


    const startPosition =
        bot.entity.position.clone();


    const start =
        Date.now();

    const timeout =
        20000;


    while (
        bot &&
        routeRunning &&
        Date.now() -
        start <
        timeout
    ) {

        const current =
            bot.entity.position;


        const dx =
            current.x -
            startPosition.x;

        const dy =
            current.y -
            startPosition.y;

        const dz =
            current.z -
            startPosition.z;


        const moved =
            Math.sqrt(
                dx * dx +
                dy * dy +
                dz * dz
            );


        if (
            moved >=
            20
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
                "[ROUTE] Neue Position: " +
                getPosition()
            );


            teleportWaiting =
                false;


            setLastAction(
                "CB6 erreicht"
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


            return true;
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
        "[ROUTE] Kein CB6 Teleport erkannt."
    );


    await updatePanel();


    return false;
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

    teleportWaiting =
        false;

    cooldownActive =
        false;


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
        "[ROUTE] Portalraum erreicht."
    );


    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );


    // ========================================================
    // ZUM PORTAL
    // ========================================================

    const success =
        await runPortalRoute();


    if (
        !success
    ) {

        stopMovement();

        routeRunning =
            false;


        setLastAction(
            "Portalroute fehlgeschlagen"
        );


        await updatePanel();


        return;
    }


    // ========================================================
    // WARTEN
    // ========================================================

    await waitForCB6Teleport();
}


// ============================================================
// CHAT ÜBERWACHUNG
// ============================================================

function setupMinecraftChatHandlers() {

    if (!bot) {
        return;
    }


    bot.on(
        "messagestr",
        async message => {

            console.log(
                "[MC CHAT] " +
                message
            );


            const text =
                String(message)
                    .replace(
                        /§[0-9a-fk-or]/gi,
                        ""
                    )
                    .trim();


            // ==================================================
            // 12 SEKUNDEN COOLDOWN
            // ==================================================

            if (
                text.includes(
                    "Bitte warte 12 Sekunden zwischen jedem Teleport"
                )
            ) {

                await handleTeleportCooldown();

                return;
            }


            // ==================================================
            // PORTALRAUM
            // ==================================================

            if (
                text.includes(
                    "Du bist im Portalraum"
                )
            ) {

                console.log(
                    "[MC CHAT] Portalraum bestätigt."
                );

                return;
            }
        }
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

    teleportWaiting =
        false;

    cooldownActive =
        false;

    portalRetryRunning =
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


        setupMinecraftChatHandlers();


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

                cooldownActive =
                    false;

                portalRetryRunning =
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
// MINECRAFT STOPP
// ============================================================

function stopMinecraft() {

    manualStop =
        true;

    routeRunning =
        false;

    teleportWaiting =
        false;

    cooldownActive =
        false;

    portalRetryRunning =
        false;

    startedAt =
        null;


    stopMovement();


    if (bot) {

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
            ? getHorizontalDistance(
                PORTAL_TARGET
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
                    name: "Portal Entfernung",
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
                    name: "Teleport",
                    value:
                        teleportWaiting
                            ? "🟡 Warte"
                            : "⚪ Nein",
                    inline: true
                },

                {
                    name: "Cooldown",
                    value:
                        cooldownActive
                            ? "🟡 Aktiv"
                            : "⚪ Nein",
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
// DISCORD BUTTONS
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
                    "Minecraft Bot wird gestartet und fährt anschließend automatisch zum CB6 Portal.",

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
                    "\n\nRotation:\n" +
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
// SYSTEM FEHLER
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

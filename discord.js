require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mineflayer = require("mineflayer");

// ============================================================
// KONFIGURATION
// ============================================================

const MC_EMAIL =
    process.env.MC_EMAIL ||
    "r.guse858@gmail.com";

const MC_HOST =
    process.env.MC_HOST ||
    "play.griefergames.net";

const MC_PORT =
    Number(
        process.env.MC_PORT ||
        25565
    );

const MC_AUTH =
    "microsoft";

const MC_AUTH_DIR =
    path.join(
        process.cwd(),
        "minecraft-auth"
    );

const MC_VERSION =
    "1.8.9";

// ============================================================
// STATUS
// ============================================================

let bot =
    null;

let routeRunning =
    false;

let afkRunning =
    true;

// ============================================================
// HILFSFUNKTION
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

// ============================================================
// POSITION
// ============================================================

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
        position.x.toFixed(2) +
        " | Y: " +
        position.y.toFixed(2) +
        " | Z: " +
        position.z.toFixed(2)
    );

}

// ============================================================
// AUTH ORDNER
// ============================================================

try {

    fs.mkdirSync(
        MC_AUTH_DIR,
        {
            recursive:
                true
        }
    );

    console.log(
        "[SYSTEM] Microsoft Auth Speicher: " +
        MC_AUTH_DIR
    );

} catch (error) {

    console.error(
        "[MC ERROR] Auth Ordner konnte nicht erstellt werden."
    );

    console.error(
        error
    );

}

// ============================================================
// START
// ============================================================

console.log(
    "========================================"
);

console.log(
    "        GRIEFERGAMES AFK BOT"
);

console.log(
    "========================================"
);

console.log(
    "[SYSTEM] Node: " +
    process.version
);

console.log(
    "[SYSTEM] Prozess: " +
    process.pid
);

console.log(
    "[SYSTEM] Minecraft Host: " +
    MC_HOST
);

console.log(
    "[SYSTEM] Minecraft Port: " +
    MC_PORT
);

console.log(
    "[SYSTEM] Minecraft Version: " +
    MC_VERSION
);

console.log(
    "[MC] Account: " +
    MC_EMAIL
);

console.log(
    "[MC] Auth: " +
    MC_AUTH
);

console.log(
    "[MC] Auth Speicher: " +
    MC_AUTH_DIR
);

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

// ============================================================
// MINECRAFT START
// ============================================================

try {

    bot =
        mineflayer.createBot({

            host:
                MC_HOST,

            port:
                MC_PORT,

            username:
                MC_EMAIL,

            auth:
                MC_AUTH,

            version:
                MC_VERSION,

            profilesFolder:
                MC_AUTH_DIR

        });

} catch (error) {

    console.error(
        "[MC ERROR] Minecraft konnte nicht gestartet werden."
    );

    console.error(
        error
    );

    process.exit(
        1
    );

}

// ============================================================
// LOGIN
// ============================================================

bot.once(
    "login",
    () => {

        console.log(
            "[MC] Minecraft Login erfolgreich."
        );

    }
);

// ============================================================
// SPAWN
// ============================================================

bot.once(
    "spawn",
    async () => {

        console.log(
            "[MC CHAT] Dxnny858 joined the game"
        );

        console.log(
            "[MC] Minecraft Spawn erfolgreich."
        );

        console.log(
            "[MC] Minecraft Bot ist jetzt auf dem Server."
        );

        console.log(
            "[MC] Position: " +
            getPosition()
        );

        await sleep(
            3000
        );

        if (
            bot &&
            afkRunning
        ) {

            await startCB6Route();

        }

    }
);

// ============================================================
// CHAT
// ============================================================

bot.on(
    "messagestr",
    message => {

        console.log(
            "[MC CHAT] " +
            message
        );

    }
);

// ============================================================
// KICK
// ============================================================

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

    }
);

// ============================================================
// FEHLER
// ============================================================

bot.on(
    "error",
    error => {

        console.error(
            "[MC ERROR]"
        );

        console.error(
            error
        );

    }
);

// ============================================================
// VERBINDUNG ENDE
// ============================================================

bot.on(
    "end",
    () => {

        console.log(
            "[MC] Minecraft Verbindung beendet."
        );

        process.exit(
            0
        );

    }
);

// ============================================================
// NORDEN
// ============================================================

async function lookNorth() {

    if (!bot) {

        return;

    }

    console.log(
        "[ROUTE] Drehe nach Norden."
    );

    await bot.look(
        0,
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
// BEWEGUNG
// ============================================================

async function moveForward(
    duration
) {

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

    const start =
        Date.now();

    while (
        bot &&
        routeRunning &&
        Date.now() -
        start <
        duration
    ) {

        await sleep(
            50
        );

    }

    if (bot) {

        bot.setControlState(
            "forward",
            false
        );

        bot.setControlState(
            "sprint",
            false
        );

    }

}

// ============================================================
// STOPP BEWEGUNG
// ============================================================

function stopMovement() {

    if (!bot) {

        return;

    }

    try {

        bot.clearControlStates();

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

    } catch {}

}

// ============================================================
// SPRUNG
// ============================================================

async function jump() {

    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }

    console.log(
        "[ROUTE] Springe über die Kante..."
    );

    bot.setControlState(
        "jump",
        true
    );

    await sleep(
        350
    );

    if (bot) {

        bot.setControlState(
            "jump",
            false
        );

    }

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

    // ========================================================
    // PORTAL
    // ========================================================

    console.log(
        "[ROUTE] Sende /portal..."
    );

    bot.chat(
        "/portal"
    );

    await sleep(
        4000
    );

    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }

    console.log(
        "[ROUTE] Portalbereich erreicht."
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );

    // ========================================================
    // NORDEN
    // ========================================================

    await lookNorth();

    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }

    // ========================================================
    // ERSTER WEG
    // ========================================================

    console.log(
        "[ROUTE] Starte festen Weg über die Kante."
    );

    await moveForward(
        900
    );

    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }

    console.log(
        "[ROUTE] Kante erreicht."
    );

    // ========================================================
    // SPRUNG
    // ========================================================

    await jump();

    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }

    // ========================================================
    // ÜBER DIE KANTE
    // ========================================================

    await moveForward(
        850
    );

    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }

    stopMovement();

    console.log(
        "[ROUTE] Kante überquert."
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );

    await sleep(
        500
    );

    // ========================================================
    // ENDLAUF
    // ========================================================

    console.log(
        "[ROUTE] Endlauf zum CB6 Portal."
    );

    await moveForward(
        900
    );

    stopMovement();

    if (
        !bot ||
        !routeRunning
    ) {

        return;

    }

    console.log(
        "[ROUTE] CB6 Portal erreicht."
    );

    console.log(
        "[ROUTE] Position: " +
        getPosition()
    );

    // ========================================================
    // 12 SEKUNDEN
    // ========================================================

    console.log(
        "[ROUTE] Warte 12 Sekunden."
    );

    for (
        let i = 12;
        i >= 1;
        i--
    ) {

        console.log(
            "[ROUTE] Noch " +
            i +
            " Sekunden."
        );

        await sleep(
            1000
        );

        if (
            !bot ||
            !routeRunning
        ) {

            return;

        }

    }

    console.log(
        "[ROUTE] 12 Sekunden vorbei."
    );

    // ========================================================
    // HOME
    // ========================================================

    console.log(
        "[ROUTE] Sende /home 55."
    );

    bot.chat(
        "/home 55"
    );

    console.log(
        "[ROUTE] /home 55 gesendet."
    );

    routeRunning =
        false;

    console.log(
        "[ROUTE] CB6 Ablauf abgeschlossen."
    );

}

// ============================================================
// SHUTDOWN
// ============================================================

process.on(
    "SIGTERM",
    () => {

        console.log(
            "[SYSTEM] SIGTERM erhalten."
        );

        afkRunning =
            false;

        routeRunning =
            false;

        stopMovement();

        if (bot) {

            try {

                bot.quit(
                    "AFK Bot beendet"
                );

            } catch {}

        }

        process.exit(
            0
        );

    }
);

process.on(
    "SIGINT",
    () => {

        console.log(
            "[SYSTEM] SIGINT erhalten."
        );

        afkRunning =
            false;

        routeRunning =
            false;

        stopMovement();

        if (bot) {

            try {

                bot.quit(
                    "AFK Bot beendet"
                );

            } catch {}

        }

        process.exit(
            0
        );

    }
);

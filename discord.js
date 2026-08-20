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

const fs = require("fs");
const path = require("path");

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.DISCORD_OWNER_ID;
const MC_USERNAME = process.env.MC_USERNAME;

const AUTH_DIR = path.join(__dirname, "minecraft-auth");

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, {
    recursive: true
  });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let bot = null;
let panelMessage = null;

let afkActive = false;
let minecraftOnline = false;
let minecraftConnecting = false;

let sessionStarted = null;
let lastAction = "Noch keine";
let position = "Unbekannt";

let statistics = {
  movements: 0,
  jumps: 0,
  reconnects: 0,
  disconnects: 0
};

let reconnectTimeout = null;
let movementInterval = null;
let jumpInterval = null;
let panelInterval = null;

console.log("");
console.log("========================================");
console.log("        AFK DISCORD BOT");
console.log("========================================");
console.log("");

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

    panelInterval = setInterval(
      () => {
        updatePanel();
      },
      5000
    );
  }
);

client.on(
  "messageCreate",
  async message => {

    if (message.author.bot) {
      return;
    }

    if (
      message.content
        .trim()
        .toLowerCase() !== "!afk"
    ) {
      return;
    }

    if (
      OWNER_ID &&
      message.author.id !== OWNER_ID
    ) {

      await message.reply(
        "Du hast keine Berechtigung für den AFK Bot."
      );

      return;
    }

    await sendPanel(
      message.channel
    );
  }
);

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isButton()) {
      return;
    }

    if (
      OWNER_ID &&
      interaction.user.id !== OWNER_ID
    ) {

      await interaction.reply({
        content:
          "Du hast keine Berechtigung.",
        flags: 64
      });

      return;
    }

    if (
      interaction.customId ===
      "afk_start"
    ) {

      await startAFK(
        interaction
      );

      return;
    }

    if (
      interaction.customId ===
      "afk_stop"
    ) {

      await stopAFK(
        interaction
      );

      return;
    }

    if (
      interaction.customId ===
      "afk_reconnect"
    ) {

      await reconnectMinecraft(
        interaction
      );

      return;
    }

    if (
      interaction.customId ===
      "afk_refresh"
    ) {

      await interaction.deferUpdate();

      await updatePanel();

      return;
    }

    if (
      interaction.customId ===
      "afk_position"
    ) {

      await interaction.reply({
        content:
          "Position: " +
          position,
        flags: 64
      });

      return;
    }
  }
);

async function startAFK(
  interaction
) {

  if (afkActive) {

    await interaction.reply({
      content:
        "Der AFK Bot läuft bereits.",
      flags: 64
    });

    return;
  }

  if (!MC_USERNAME) {

    await interaction.reply({
      content:
        "MC_USERNAME fehlt in Railway Variables.",
      flags: 64
    });

    console.error(
      "[MC] MC_USERNAME fehlt."
    );

    return;
  }

  resetStatistics();

  afkActive = true;
  minecraftOnline = false;
  minecraftConnecting = true;

  sessionStarted =
    Date.now();

  lastAction =
    "Minecraft wird gestartet";

  console.log("");
  console.log("========================================");
  console.log("        AFK SESSION START");
  console.log("========================================");
  console.log("");

  console.log(
    "[MC] Starte Minecraft direkt im Discord Prozess."
  );

  startMinecraft();

  await interaction.reply({
    content:
      "AFK Bot wird gestartet.",
    flags: 64
  });

  await updatePanel();
}

async function stopAFK(
  interaction
) {

  if (!afkActive) {

    await interaction.reply({
      content:
        "Der AFK Bot läuft momentan nicht.",
      flags: 64
    });

    return;
  }

  afkActive = false;
  minecraftOnline = false;
  minecraftConnecting = false;

  lastAction =
    "AFK Bot gestoppt";

  clearReconnectTimeout();
  stopMovement();

  if (bot) {

    try {

      bot.quit(
        "AFK Bot gestoppt"
      );

    } catch (error) {

      console.error(
        "[MC] Fehler beim Beenden:",
        error
      );
    }
  }

  bot = null;

  await interaction.reply({
    content:
      "AFK Bot wurde gestoppt.",
    flags: 64
  });

  await updatePanel();
}

async function reconnectMinecraft(
  interaction
) {

  if (!afkActive) {

    await interaction.reply({
      content:
        "Der AFK Bot ist nicht aktiv.",
      flags: 64
    });

    return;
  }

  statistics.reconnects++;

  lastAction =
    "Manueller Reconnect";

  minecraftOnline = false;
  minecraftConnecting = true;

  stopMovement();

  if (bot) {

    try {

      bot.quit(
        "Manueller Reconnect"
      );

    } catch (error) {

      console.error(
        "[MC] Fehler beim Reconnect:",
        error
      );
    }
  }

  bot = null;

  clearReconnectTimeout();

  await interaction.reply({
    content:
      "Minecraft wird neu verbunden.",
    flags: 64
  });

  reconnectTimeout =
    setTimeout(
      () => {

        reconnectTimeout =
          null;

        if (!afkActive) {
          return;
        }

        startMinecraft();

      },
      3000
    );

  await updatePanel();
}

function startMinecraft() {

  if (!afkActive) {
    return;
  }

  if (bot) {

    console.log(
      "[MC] Minecraft Bot läuft bereits."
    );

    return;
  }

  if (!MC_USERNAME) {

    console.error(
      "[MC] MC_USERNAME fehlt."
    );

    minecraftConnecting = false;

    lastAction =
      "MC_USERNAME fehlt";

    updatePanel();

    return;
  }

  console.log("");
  console.log("========================================");
  console.log("        MINECRAFT START");
  console.log("========================================");
  console.log("");

  console.log(
    "[MC] Account:",
    MC_USERNAME
  );

  console.log(
    "[MC] Server: griefergames.net"
  );

  console.log(
    "[MC] Version: 1.8.9"
  );

  console.log(
    "[MC] Auth Ordner:",
    AUTH_DIR
  );

  minecraftConnecting = true;
  minecraftOnline = false;

  lastAction =
    "Verbinde mit GrieferGames";

  updatePanel();

  try {

    bot = mineflayer.createBot({

      host:
        "griefergames.net",

      port:
        25565,

      username:
        MC_USERNAME,

      auth:
        "microsoft",

      version:
        "1.8.9",

      profilesFolder:
        AUTH_DIR,

      hideErrors:
        false
    });

    console.log(
      "[MC] Mineflayer Bot erstellt."
    );

  } catch (error) {

    console.error(
      "[MC] Fehler beim Erstellen:",
      error
    );

    bot = null;

    minecraftConnecting = false;
    minecraftOnline = false;

    lastAction =
      "Minecraft Start fehlgeschlagen";

    scheduleReconnect();
    updatePanel();

    return;
  }

  bot.once(
    "login",
    () => {

      console.log("");
      console.log("========================================");
      console.log("        MINECRAFT LOGIN");
      console.log("========================================");
      console.log("");

      console.log(
        "[MC] Login erfolgreich."
      );

      console.log(
        "[MC] Username:",
        bot.username
      );

      minecraftConnecting = true;

      lastAction =
        "Minecraft Login erfolgreich";

      updatePanel();
    }
  );

  bot.once(
    "spawn",
    () => {

      console.log("");
      console.log("========================================");
      console.log("        MINECRAFT SPAWN");
      console.log("========================================");
      console.log("");

      minecraftOnline = true;
      minecraftConnecting = false;

      lastAction =
        "Minecraft ist online";

      updatePosition();

      console.log(
        "[MC] Position:",
        position
      );

      console.log(
        "[MC] AFK System startet."
      );

      startMovement();

      updatePanel();
    }
  );

  bot.on(
    "messagestr",
    message => {

      console.log(
        "[CHAT] " + message
      );

      handleMinecraftChat(
        message
      );
    }
  );

  bot.on(
    "kicked",
    reason => {

      console.log("");
      console.log("========================================");
      console.log("        MINECRAFT GEKICKT");
      console.log("========================================");
      console.log("");

      console.log(
        "[MC] Grund:",
        reason
      );

      minecraftOnline = false;
      minecraftConnecting = false;

      stopMovement();

      lastAction =
        "Minecraft wurde gekickt";

      updatePanel();
    }
  );

  bot.on(
    "error",
    error => {

      console.log("");
      console.log("========================================");
      console.log("        MINECRAFT FEHLER");
      console.log("========================================");
      console.log("");

      console.error(
        error
      );

      minecraftOnline = false;
      minecraftConnecting = false;

      lastAction =
        "Minecraft Fehler";

      updatePanel();
    }
  );

  bot.on(
    "end",
    () => {

      console.log("");
      console.log("========================================");
      console.log("        MINECRAFT VERBINDUNG ENDE");
      console.log("========================================");
      console.log("");

      minecraftOnline = false;
      minecraftConnecting = false;

      stopMovement();

      bot = null;

      if (afkActive) {

        statistics.disconnects++;

        lastAction =
          "Minecraft Verbindung beendet";

        scheduleReconnect();

      } else {

        lastAction =
          "Minecraft beendet";
      }

      updatePanel();
    }
  );

  bot.on(
    "death",
    () => {

      console.log(
        "[MC] Bot ist gestorben."
      );

      lastAction =
        "Bot ist gestorben";

      updatePanel();
    }
  );

  bot.on(
    "health",
    () => {

      if (!bot) {
        return;
      }

      console.log(
        "[MC] Leben:",
        bot.health,
        "| Essen:",
        bot.food
      );
    }
  );
}

function handleMinecraftChat(
  message
) {

  const lower =
    message.toLowerCase();

  if (
    lower.includes("login")
  ) {

    lastAction =
      "Server Login erkannt";

    updatePanel();
  }

  if (
    lower.includes("willkommen")
  ) {

    lastAction =
      "Willkommen auf GrieferGames";

    updatePanel();
  }

  if (
    lower.includes("citybuild")
  ) {

    lastAction =
      "Citybuild Nachricht erkannt";

    updatePanel();
  }
}

function startMovement() {

  if (!bot) {
    return;
  }

  stopMovement();

  lastAction =
    "AFK Bewegung gestartet";

  updatePanel();

  movementInterval =
    setInterval(
      () => {

        if (
          !afkActive ||
          !minecraftOnline ||
          !bot
        ) {
          return;
        }

        updatePosition();

        bot.setControlState(
          "forward",
          true
        );

        statistics.movements++;

        lastAction =
          "Läuft geradeaus";

        updatePanel();

        setTimeout(
          () => {

            if (!bot) {
              return;
            }

            try {

              bot.setControlState(
                "forward",
                false
              );

            } catch (error) {

              console.error(
                "[MC] Bewegungsfehler:",
                error
              );
            }

          },
          3000
        );

      },
      8000
    );

  jumpInterval =
    setInterval(
      () => {

        if (
          !afkActive ||
          !minecraftOnline ||
          !bot
        ) {
          return;
        }

        try {

          bot.setControlState(
            "jump",
            true
          );

          setTimeout(
            () => {

              if (!bot) {
                return;
              }

              try {

                bot.setControlState(
                  "jump",
                  false
                );

              } catch (error) {
              }

            },
            500
          );

          statistics.jumps++;

          lastAction =
            "Springt";

          updatePosition();
          updatePanel();

        } catch (error) {

          console.error(
            "[MC] Sprungfehler:",
            error
          );
        }

      },
      15000
    );
}

function stopMovement() {

  if (
    movementInterval
  ) {

    clearInterval(
      movementInterval
    );

    movementInterval =
      null;
  }

  if (
    jumpInterval
  ) {

    clearInterval(
      jumpInterval
    );

    jumpInterval =
      null;
  }

  if (bot) {

    try {

      bot.setControlState(
        "forward",
        false
      );

      bot.setControlState(
        "jump",
        false
      );

    } catch (error) {
    }
  }
}

function updatePosition() {

  if (
    !bot ||
    !bot.entity ||
    !bot.entity.position
  ) {
    return;
  }

  const pos =
    bot.entity.position;

  position =
    "X " +
    pos.x.toFixed(1) +
    " | Y " +
    pos.y.toFixed(1) +
    " | Z " +
    pos.z.toFixed(1);
}

function scheduleReconnect() {

  if (!afkActive) {
    return;
  }

  if (reconnectTimeout) {
    return;
  }

  lastAction =
    "Reconnect in 10 Sekunden";

  updatePanel();

  reconnectTimeout =
    setTimeout(
      () => {

        reconnectTimeout =
          null;

        if (!afkActive) {
          return;
        }

        statistics.reconnects++;

        lastAction =
          "Automatischer Reconnect";

        startMinecraft();

      },
      10000
    );
}

function clearReconnectTimeout() {

  if (
    reconnectTimeout
  ) {

    clearTimeout(
      reconnectTimeout
    );

    reconnectTimeout =
      null;
  }
}

function resetStatistics() {

  statistics = {
    movements: 0,
    jumps: 0,
    reconnects: 0,
    disconnects: 0
  };

  sessionStarted =
    Date.now();

  position =
    "Unbekannt";

  lastAction =
    "Neue Session";
}

async function sendPanel(
  channel
) {

  const message =
    await channel.send({
      embeds: [
        createEmbed()
      ],

      components: [
        createButtons()
      ]
    });

  panelMessage =
    message;

  console.log(
    "[DISCORD] AFK Panel erstellt."
  );
}

async function updatePanel() {

  if (!panelMessage) {
    return;
  }

  try {

    await panelMessage.edit({
      embeds: [
        createEmbed()
      ],

      components: [
        createButtons()
      ]
    });

  } catch (error) {

    console.log(
      "[DISCORD] Panel konnte nicht aktualisiert werden."
    );
  }
}

function createEmbed() {

  return new EmbedBuilder()

    .setTitle(
      "AFK Bot"
    )

    .setDescription(
      "GrieferGames AFK Kontrollzentrum"
    )

    .addFields(

      {
        name:
          "Status",

        value:
          getStatus(),

        inline:
          true
      },

      {
        name:
          "Server",

        value:
          "GrieferGames",

        inline:
          true
      },

      {
        name:
          "Verbindung",

        value:
          getConnection(),

        inline:
          true
      },

      {
        name:
          "Position",

        value:
          position,

        inline:
          false
      },

      {
        name:
          "Laufzeit",

        value:
          getUptime(),

        inline:
          true
      },

      {
        name:
          "Letzte Aktion",

        value:
          lastAction,

        inline:
          true
      },

      {
        name:
          "AFK Statistik",

        value:
          [
            "Bewegungen: **" +
            statistics.movements +
            "**",

            "Sprünge: **" +
            statistics.jumps +
            "**",

            "Reconnects: **" +
            statistics.reconnects +
            "**",

            "Disconnects: **" +
            statistics.disconnects +
            "**"
          ].join("\n"),

        inline:
          false
      }
    )

    .setFooter({
      text:
        "AFK Control"
    })

    .setTimestamp();
}

function createButtons() {

  return new ActionRowBuilder()

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
}

function getStatus() {

  if (
    afkActive &&
    minecraftOnline
  ) {

    return "🟢 **AFK AKTIV**";
  }

  if (
    afkActive &&
    minecraftConnecting
  ) {

    return "🟡 **VERBINDET**";
  }

  return "🔴 **OFFLINE**";
}

function getConnection() {

  if (
    minecraftOnline
  ) {

    return "🟢 Online";
  }

  if (
    minecraftConnecting
  ) {

    return "🟡 Verbindung...";
  }

  return "🔴 Offline";
}

function getUptime() {

  if (!sessionStarted) {
    return "00:00:00";
  }

  return formatDuration(
    Date.now() -
    sessionStarted
  );
}

function formatDuration(
  milliseconds
) {

  let seconds =
    Math.floor(
      milliseconds / 1000
    );

  const hours =
    Math.floor(
      seconds / 3600
    );

  seconds =
    seconds % 3600;

  const minutes =
    Math.floor(
      seconds / 60
    );

  seconds =
    seconds % 60;

  return (
    String(hours).padStart(
      2,
      "0"
    ) +
    ":" +
    String(minutes).padStart(
      2,
      "0"
    ) +
    ":" +
    String(seconds).padStart(
      2,
      "0"
    )
  );
}

if (!TOKEN) {

  console.error(
    "DISCORD_TOKEN fehlt."
  );

  process.exit(1);
}

if (!MC_USERNAME) {

  console.log(
    "[MC] Hinweis: MC_USERNAME ist noch nicht gesetzt."
  );
}

client.login(
  TOKEN
);

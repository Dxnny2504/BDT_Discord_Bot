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
const path = require("path");
const fs = require("fs");

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.DISCORD_OWNER_ID;
const MC_USERNAME = process.env.MC_USERNAME;

const AUTH_FOLDER = path.join(
  __dirname,
  "minecraft-auth"
);

if (!fs.existsSync(AUTH_FOLDER)) {
  fs.mkdirSync(AUTH_FOLDER, {
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

let minecraftBot = null;
let panelMessage = null;

let afkActive = false;
let minecraftOnline = false;
let minecraftConnecting = false;

let sessionStarted = null;

let lastAction = "Noch keine";
let position = "Unbekannt";

let movementTimer = null;
let reconnectTimer = null;

let statistics = {
  movements: 0,
  jumps: 0,
  reconnects: 0,
  disconnects: 0
};

console.log("");
console.log("========================================");
console.log("        GRIEFERGAMES AFK BOT");
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

    const embed =
      createAFKEmbed();

    const buttons =
      createButtons();

    const sent =
      await message.channel.send({
        embeds: [embed],
        components: [buttons]
      });

    panelMessage = sent;

    console.log(
      "[DISCORD] AFK Panel erstellt."
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
      "afk_position"
    ) {

      await interaction.reply({
        content:
          "Aktuelle Position:\n" +
          position,
        flags: 64
      });

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
        "MC_USERNAME fehlt bei Railway unter Variables.",
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
    "[MC] Starte Minecraft Bot."
  );

  startMinecraft();

  await interaction.reply({
    content:
      "AFK Session wurde gestartet.",
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
    "AFK Session gestoppt";

  clearReconnectTimer();

  stopMovement();

  if (minecraftBot) {

    try {

      minecraftBot.quit(
        "AFK Session beendet"
      );

    } catch (error) {

      console.error(
        "[MC] Fehler beim Beenden:",
        error
      );
    }
  }

  minecraftBot = null;

  await interaction.reply({
    content:
      "AFK Session wurde gestoppt.",
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
        "Der AFK Bot ist momentan nicht aktiv.",
      flags: 64
    });

    return;
  }

  statistics.reconnects++;

  lastAction =
    "Minecraft wird neu verbunden";

  minecraftOnline = false;
  minecraftConnecting = true;

  stopMovement();

  if (minecraftBot) {

    try {

      minecraftBot.quit(
        "Reconnect"
      );

    } catch (error) {

      console.error(
        "[MC] Reconnect Fehler:",
        error
      );
    }
  }

  minecraftBot = null;

  clearReconnectTimer();

  await interaction.reply({
    content:
      "Minecraft wird neu verbunden.",
    flags: 64
  });

  reconnectTimer =
    setTimeout(
      () => {

        reconnectTimer = null;

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

  if (minecraftBot) {

    console.log(
      "[MC] Minecraft Bot läuft bereits."
    );

    return;
  }

  minecraftConnecting = true;
  minecraftOnline = false;

  lastAction =
    "Verbinde mit GrieferGames";

  updatePanel();

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

  try {

    minecraftBot =
      mineflayer.createBot({

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
          AUTH_FOLDER,

        hideErrors:
          false
      });

    console.log(
      "[MC] Mineflayer wurde gestartet."
    );

  } catch (error) {

    console.error(
      "[MC] Start Fehler:",
      error
    );

    minecraftBot = null;
    minecraftConnecting = false;

    lastAction =
      "Minecraft Start fehlgeschlagen";

    scheduleReconnect();

    updatePanel();

    return;
  }

  minecraftBot.once(
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
        minecraftBot.username
      );

      lastAction =
        "Minecraft Login erfolgreich";

      updatePanel();
    }
  );

  minecraftBot.once(
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
        "GrieferGames ist online";

      updatePosition();

      console.log(
        "[MC] Position:",
        position
      );

      startMovement();

      updatePanel();
    }
  );

  minecraftBot.on(
    "messagestr",
    message => {

      console.log(
        "[CHAT] " + message
      );

      lastAction =
        "Chat empfangen";

      updatePanel();
    }
  );

  minecraftBot.on(
    "kicked",
    reason => {

      console.log(
        "[MC] Gekickt:",
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

  minecraftBot.on(
    "error",
    error => {

      console.error(
        "[MC] Fehler:",
        error
      );

      minecraftOnline = false;
      minecraftConnecting = false;

      lastAction =
        "Minecraft Fehler";

      updatePanel();
    }
  );

  minecraftBot.on(
    "end",
    () => {

      console.log(
        "[MC] Verbindung beendet."
      );

      minecraftOnline = false;
      minecraftConnecting = false;

      stopMovement();

      minecraftBot = null;

      if (afkActive) {

        statistics.disconnects++;

        lastAction =
          "Verbindung verloren";

        scheduleReconnect();

      } else {

        lastAction =
          "Minecraft beendet";
      }

      updatePanel();
    }
  );
}

function startMovement() {

  stopMovement();

  if (!minecraftBot) {
    return;
  }

  lastAction =
    "AFK Bewegung gestartet";

  movementTimer =
    setInterval(
      () => {

        if (
          !afkActive ||
          !minecraftOnline ||
          !minecraftBot
        ) {
          return;
        }

        try {

          minecraftBot.setControlState(
            "forward",
            true
          );

          statistics.movements++;

          lastAction =
            "Bewegt sich";

          updatePosition();
          updatePanel();

          setTimeout(
            () => {

              if (!minecraftBot) {
                return;
              }

              try {

                minecraftBot.setControlState(
                  "forward",
                  false
                );

              } catch (error) {
              }

            },
            3000
          );

        } catch (error) {

          console.error(
            "[MC] Bewegungsfehler:",
            error
          );
        }

      },
      8000
    );
}

function stopMovement() {

  if (movementTimer) {

    clearInterval(
      movementTimer
    );

    movementTimer = null;
  }

  if (minecraftBot) {

    try {

      minecraftBot.setControlState(
        "forward",
        false
      );

    } catch (error) {
    }
  }
}

function updatePosition() {

  if (
    !minecraftBot ||
    !minecraftBot.entity ||
    !minecraftBot.entity.position
  ) {
    return;
  }

  const pos =
    minecraftBot.entity.position;

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

  if (reconnectTimer) {
    return;
  }

  lastAction =
    "Reconnect in 10 Sekunden";

  updatePanel();

  reconnectTimer =
    setTimeout(
      () => {

        reconnectTimer = null;

        if (!afkActive) {
          return;
        }

        statistics.reconnects++;

        startMinecraft();

      },
      10000
    );
}

function clearReconnectTimer() {

  if (reconnectTimer) {

    clearTimeout(
      reconnectTimer
    );

    reconnectTimer = null;
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
    "Session gestartet";
}

function createAFKEmbed() {

  return new EmbedBuilder()

    .setTitle(
      "🤖 AFK Bot"
    )

    .setDescription(
      "GrieferGames AFK Kontrollzentrum"
    )

    .addFields(

      {
        name:
          "📡 Status",

        value:
          getStatus(),

        inline:
          true
      },

      {
        name:
          "🌐 Server",

        value:
          "GrieferGames",

        inline:
          true
      },

      {
        name:
          "🔌 Verbindung",

        value:
          getConnection(),

        inline:
          true
      },

      {
        name:
          "📍 Position",

        value:
          position,

        inline:
          false
      },

      {
        name:
          "⏱️ Laufzeit",

        value:
          getUptime(),

        inline:
          true
      },

      {
        name:
          "⚡ Letzte Aktion",

        value:
          lastAction,

        inline:
          true
      },

      {
        name:
          "📊 AFK Statistik",

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

  if (minecraftOnline) {
    return "🟢 Online";
  }

  if (minecraftConnecting) {
    return "🟡 Verbindung...";
  }

  return "🔴 Offline";
}

function getUptime() {

  if (!sessionStarted) {
    return "00:00:00";
  }

  const seconds =
    Math.floor(
      (Date.now() -
        sessionStarted) /
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

  const remainingSeconds =
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
    String(remainingSeconds).padStart(
      2,
      "0"
    )
  );
}

async function updatePanel() {

  if (!panelMessage) {
    return;
  }

  try {

    await panelMessage.edit({
      embeds: [
        createAFKEmbed()
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

if (!TOKEN) {

  console.error(
    "[DISCORD] DISCORD_TOKEN fehlt!"
  );

  process.exit(1);
}

if (!MC_USERNAME) {

  console.log(
    "[MC] MC_USERNAME ist noch nicht gesetzt."
  );
}

client.login(
  TOKEN
);

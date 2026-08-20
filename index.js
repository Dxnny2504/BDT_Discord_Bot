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

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.DISCORD_OWNER_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let mcBot = null;
let panelMessage = null;

let afkActive = false;
let mcOnline = false;
let mcConnecting = false;
let reconnecting = false;

let sessionStarted = null;
let lastActivity = null;
let lastAction = "Keine Aktion";
let currentPosition = "Unbekannt";

let movementTimer = null;
let jumpTimer = null;
let positionTimer = null;
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

client.once("clientReady", () => {
  console.log(
    "[DISCORD] Bot online: " +
    client.user.tag
  );

  console.log(
    "[DISCORD] Schreibe !afk um das Panel zu öffnen."
  );
});

client.on(
  "messageCreate",
  async (message) => {
    if (message.author.bot) {
      return;
    }

    if (
      message.content
        .trim()
        .toLowerCase() === "!afk"
    ) {
      if (
        message.author.id !== OWNER_ID
      ) {
        await message.reply(
          "❌ Du hast dafür keine Berechtigung."
        );

        return;
      }

      await sendPanel(
        message.channel
      );
    }
  }
);

client.on(
  "interactionCreate",
  async (interaction) => {
    if (!interaction.isButton()) {
      return;
    }

    if (
      interaction.user.id !== OWNER_ID
    ) {
      await interaction.reply({
        content:
          "❌ Du hast dafür keine Berechtigung.",
        ephemeral: true
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
          "📍 Position: " +
          currentPosition,
        ephemeral: true
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
        "⚠️ Der AFK Bot läuft bereits.",
      ephemeral: true
    });

    return;
  }

  resetStatistics();

  afkActive = true;
  mcOnline = false;
  mcConnecting = true;
  reconnecting = false;

  sessionStarted =
    Date.now();

  lastActivity =
    Date.now();

  lastAction =
    "Minecraft wird gestartet";

  await interaction.reply({
    content:
      "🟢 AFK Bot wird gestartet.",
    ephemeral: true
  });

  console.log("");
  console.log("========================================");
  console.log("        AFK SESSION START");
  console.log("========================================");
  console.log("");

  createMinecraftBot();

  await updatePanel();
}

async function stopAFK(
  interaction
) {
  if (!afkActive) {
    await interaction.reply({
      content:
        "ℹ️ Der AFK Bot läuft momentan nicht.",
      ephemeral: true
    });

    return;
  }

  afkActive = false;
  mcOnline = false;
  mcConnecting = false;
  reconnecting = false;

  stopAFKMovement();

  if (reconnectTimer) {
    clearTimeout(
      reconnectTimer
    );

    reconnectTimer = null;
  }

  lastAction =
    "Bot gestoppt";

  if (mcBot) {
    try {
      mcBot.quit(
        "AFK Bot gestoppt"
      );
    } catch (error) {
      console.log(
        "[MC] Fehler beim Beenden:"
      );

      console.log(
        error
      );
    }
  }

  mcBot = null;

  await interaction.reply({
    content:
      "🔴 AFK Bot wurde gestoppt.",
    ephemeral: true
  });

  await updatePanel();
}

async function reconnectMinecraft(
  interaction
) {
  if (!afkActive) {
    await interaction.reply({
      content:
        "⚠️ Der AFK Bot ist nicht aktiv.",
      ephemeral: true
    });

    return;
  }

  statistics.reconnects++;

  lastAction =
    "Manueller Reconnect";

  mcOnline = false;
  mcConnecting = true;

  stopAFKMovement();

  if (mcBot) {
    try {
      mcBot.quit(
        "Reconnect"
      );
    } catch (error) {
    }
  }

  mcBot = null;

  await interaction.reply({
    content:
      "🔄 Reconnect wird gestartet.",
    ephemeral: true
  });

  setTimeout(() => {
    if (afkActive) {
      createMinecraftBot();
    }
  }, 3000);

  await updatePanel();
}

function createMinecraftBot() {
  if (!afkActive) {
    return;
  }

  if (mcBot) {
    return;
  }

  console.log(
    "[MC] Erstelle Minecraft Bot..."
  );

  mcConnecting = true;
  mcOnline = false;

  lastAction =
    "Verbinde mit GrieferGames";

  mcBot = mineflayer.createBot({
    host: "griefergames.net",
    port: 25565,
    username: "r.guse858@gmail.com",
    auth: "microsoft",
    version: "1.8.9",
    profilesFolder: "./minecraft-auth"
  });

  mcBot.once(
    "login",
    () => {
      console.log(
        "[MC] Minecraft Login erfolgreich."
      );

      lastAction =
        "Minecraft Login erfolgreich";

      updatePanel();
    }
  );

  mcBot.once(
    "spawn",
    () => {
      console.log(
        "[MC] Minecraft Welt geladen."
      );

      mcOnline = true;
      mcConnecting = false;

      lastActivity =
        Date.now();

      lastAction =
        "Minecraft online";

      updatePosition();

      updatePanel();

      setTimeout(() => {
        if (
          afkActive &&
          mcBot
        ) {
          enterCB6();
        }
      }, 3000);
    }
  );

  mcBot.on(
    "respawn",
    () => {
      console.log(
        "[MC] Respawn erkannt."
      );

      updatePosition();

      setTimeout(() => {
        if (
          afkActive &&
          mcBot
        ) {
          startAFKMovement();
        }
      }, 5000);
    }
  );

  mcBot.on(
    "messagestr",
    (message) => {
      console.log(
        "[CHAT] " +
        message
      );

      handleMinecraftChat(
        message
      );
    }
  );

  mcBot.on(
    "kicked",
    (reason) => {
      console.log(
        "[MC] KICK:"
      );

      console.log(
        reason
      );

      mcOnline = false;
      mcConnecting = false;

      stopAFKMovement();

      if (afkActive) {
        statistics.disconnects++;

        lastAction =
          "Vom Server getrennt";

        updatePanel();

        scheduleReconnect();
      }
    }
  );

  mcBot.on(
    "end",
    () => {
      console.log(
        "[MC] Verbindung beendet."
      );

      mcOnline = false;
      mcConnecting = false;

      stopAFKMovement();

      mcBot = null;

      if (afkActive) {
        statistics.disconnects++;

        lastAction =
          "Verbindung verloren";

        updatePanel();

        scheduleReconnect();

        return;
      }

      lastAction =
        "Minecraft getrennt";

      updatePanel();
    }
  );

  mcBot.on(
    "error",
    (error) => {
      console.log(
        "[MC] Fehler:"
      );

      console.log(
        error
      );

      lastAction =
        "Minecraft Fehler";

      updatePanel();
    }
  );
}

function enterCB6() {
  if (
    !afkActive ||
    !mcBot
  ) {
    return;
  }

  console.log(
    "[CB6] Sende /portal..."
  );

  lastAction =
    "Öffne Citybuild Auswahl";

  updatePanel();

  mcBot.chat(
    "/portal"
  );

  setTimeout(() => {
    if (
      !afkActive ||
      !mcBot
    ) {
      return;
    }

    console.log(
      "[CB6] Sende /home 55..."
    );

    lastAction =
      "Sende /home 55";

    mcBot.chat(
      "/home 55"
    );

    setTimeout(() => {
      if (
        !afkActive ||
        !mcBot
      ) {
        return;
      }

      updatePosition();

      lastAction =
        "CB6 erreicht";

      startAFKMovement();

      updatePanel();

    }, 7000);

  }, 5000);
}

function startAFKMovement() {
  if (
    !afkActive ||
    !mcBot
  ) {
    return;
  }

  stopAFKMovement();

  console.log(
    "[AFK] Bewegungssystem gestartet."
  );

  movementTimer =
    setInterval(() => {
      performMovement();
    }, randomBetween(
      12000,
      22000
    ));

  jumpTimer =
    setInterval(() => {
      performJump();
    }, randomBetween(
      30000,
      60000
    ));

  positionTimer =
    setInterval(() => {
      updatePosition();
    }, 10000);

  performMovement();
}

function stopAFKMovement() {
  if (
    movementTimer
  ) {
    clearInterval(
      movementTimer
    );

    movementTimer = null;
  }

  if (
    jumpTimer
  ) {
    clearInterval(
      jumpTimer
    );

    jumpTimer = null;
  }

  if (
    positionTimer
  ) {
    clearInterval(
      positionTimer
    );

    positionTimer = null;
  }

  if (mcBot) {
    try {
      mcBot.clearControlStates();
    } catch (error) {
    }
  }
}

function performMovement() {
  if (
    !afkActive ||
    !mcBot ||
    !mcOnline
  ) {
    return;
  }

  const direction =
    Math.random() > 0.5
      ? "left"
      : "right";

  const duration =
    randomBetween(
      600,
      1400
    );

  console.log(
    "[AFK] Bewegung: " +
    direction
  );

  lastActivity =
    Date.now();

  lastAction =
    "Bewegung";

  statistics.movements++;

  try {
    mcBot.setControlState(
      direction,
      true
    );

    setTimeout(() => {
      if (!mcBot) {
        return;
      }

      try {
        mcBot.setControlState(
          direction,
          false
        );
      } catch (error) {
      }
    }, duration);

  } catch (error) {
    console.log(
      "[AFK] Bewegungsfehler:"
    );

    console.log(
      error
    );
  }

  updatePanel();
}

function performJump() {
  if (
    !afkActive ||
    !mcBot ||
    !mcOnline
  ) {
    return;
  }

  console.log(
    "[AFK] Sprung"
  );

  lastActivity =
    Date.now();

  lastAction =
    "Sprung";

  statistics.jumps++;

  try {
    mcBot.setControlState(
      "jump",
      true
    );

    setTimeout(() => {
      if (!mcBot) {
        return;
      }

      try {
        mcBot.setControlState(
          "jump",
          false
        );
      } catch (error) {
      }
    }, 500);

  } catch (error) {
  }

  updatePanel();
}

function updatePosition() {
  if (
    !mcBot ||
    !mcBot.entity
  ) {
    return;
  }

  const x =
    mcBot.entity.position.x.toFixed(3);

  const y =
    mcBot.entity.position.y.toFixed(3);

  const z =
    mcBot.entity.position.z.toFixed(3);

  currentPosition =
    x +
    " / " +
    y +
    " / " +
    z;

  console.log(
    "[AFK] Position: " +
    currentPosition
  );
}

function handleMinecraftChat(
  message
) {
  const text =
    String(message)
      .replace(
        /§[0-9a-fk-or]/gi,
        ""
      )
      .toLowerCase();

  if (
    text.includes(
      "du wurdest wegen inaktivität"
    )
  ) {
    console.log(
      "[AFK] AFK Hinweis erkannt."
    );

    lastAction =
      "AFK Hinweis erkannt";

    updatePanel();

    return;
  }

  if (
    text.includes(
      "du wurdest gekickt"
    )
  ) {
    console.log(
      "[AFK] Kick Nachricht erkannt."
    );

    lastAction =
      "Kick erkannt";

    updatePanel();

    return;
  }
}

function scheduleReconnect() {
  if (
    !afkActive
  ) {
    return;
  }

  if (
    reconnectTimer
  ) {
    return;
  }

  reconnecting = true;

  lastAction =
    "Reconnect in 10 Sekunden";

  updatePanel();

  reconnectTimer =
    setTimeout(() => {
      reconnectTimer =
        null;

      reconnecting =
        false;

      if (
        !afkActive
      ) {
        return;
      }

      statistics.reconnects++;

      lastAction =
        "Automatischer Reconnect";

      createMinecraftBot();

      updatePanel();

    }, 10000);
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

  lastActivity =
    Date.now();

  currentPosition =
    "Unbekannt";

  lastAction =
    "Neue Session";
}

async function sendPanel(
  channel
) {
  const embed =
    createEmbed();

  const buttons =
    createButtons();

  const message =
    await channel.send({
      embeds: [
        embed
      ],
      components: [
        buttons
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
      "🤖 GrieferGames AFK Bot"
    )
    .setDescription(
      "Dein persönliches AFK Kontrollzentrum"
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
          "🌐 Citybuild",
        value:
          "CB6",
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
          currentPosition,
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
          "🕐 Aktivität",
        value:
          getLastActivity(),
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
        "BlitzControl • AFK System"
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
    mcOnline
  ) {
    return "🟢 **AFK AKTIV**";
  }

  if (
    afkActive &&
    mcConnecting
  ) {
    return "🟡 **VERBINDET**";
  }

  return "🔴 **OFFLINE**";
}

function getConnection() {
  if (mcOnline) {
    return "🟢 Stabil";
  }

  if (mcConnecting) {
    return "🟡 Verbindung...";
  }

  if (reconnecting) {
    return "🟠 Reconnect...";
  }

  return "🔴 Getrennt";
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

function getLastActivity() {
  if (!lastActivity) {
    return "Noch keine";
  }

  return (
    formatDuration(
      Date.now() -
      lastActivity
    ) +
    " her"
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
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0")
  );
}

function randomBetween(
  minimum,
  maximum
) {
  return Math.floor(
    Math.random() *
      (
        maximum -
        minimum +
        1
      )
  ) + minimum;
}

if (!TOKEN) {
  console.error(
    "DISCORD_TOKEN fehlt."
  );

  process.exit(1);
}

if (!OWNER_ID) {
  console.error(
    "DISCORD_OWNER_ID fehlt."
  );

  process.exit(1);
}

client.login(
  TOKEN
);

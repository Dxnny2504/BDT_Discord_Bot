require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const {
  spawn
} = require("child_process");

const path = require("path");

const TOKEN =
  process.env.DISCORD_TOKEN;

const OWNER_ID =
  process.env.DISCORD_OWNER_ID;

const client =
  new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

let minecraftProcess = null;
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
  }
);

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

    if (
      !interaction.isButton()
    ) {
      return;
    }

    if (
      OWNER_ID &&
      interaction.user.id !== OWNER_ID
    ) {
      await interaction.reply({
        content:
          "Du hast keine Berechtigung.",
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
          "📍 Position: " +
          position,
        ephemeral: true
      });

      return;
    }
  }
);

async function startAFK(
  interaction
) {

  if (
    afkActive
  ) {
    await interaction.reply({
      content:
        "Der AFK Bot läuft bereits.",
      ephemeral: true
    });

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

  startMinecraftProcess();

  await interaction.reply({
    content:
      "🟢 AFK Bot wird gestartet.",
    ephemeral: true
  });

  await updatePanel();
}

async function stopAFK(
  interaction
) {

  if (
    !afkActive
  ) {
    await interaction.reply({
      content:
        "Der AFK Bot läuft momentan nicht.",
      ephemeral: true
    });

    return;
  }

  afkActive = false;
  minecraftOnline = false;
  minecraftConnecting = false;

  lastAction =
    "AFK Bot gestoppt";

  clearReconnectTimeout();

  stopMinecraftProcess();

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

  if (
    !afkActive
  ) {
    await interaction.reply({
      content:
        "Der AFK Bot ist nicht aktiv.",
      ephemeral: true
    });

    return;
  }

  statistics.reconnects++;

  lastAction =
    "Manueller Reconnect";

  minecraftOnline = false;
  minecraftConnecting = true;

  stopMinecraftProcess();

  await interaction.reply({
    content:
      "🔄 Minecraft wird neu verbunden.",
    ephemeral: true
  });

  clearReconnectTimeout();

  reconnectTimeout =
    setTimeout(
      () => {

        reconnectTimeout =
          null;

        if (
          !afkActive
        ) {
          return;
        }

        startMinecraftProcess();

      },
      3000
    );

  await updatePanel();
}

function startMinecraftProcess() {

  if (
    minecraftProcess
  ) {
    console.log(
      "[MC] Prozess läuft bereits."
    );

    return;
  }

  const minecraftFile =
    path.join(
      __dirname,
      "index.js"
    );

  console.log(
    "[MC] Starte Minecraft Prozess:"
  );

  console.log(
    minecraftFile
  );

  minecraftConnecting =
    true;

  minecraftOnline =
    false;

  lastAction =
    "Verbinde mit GrieferGames";

  minecraftProcess =
    spawn(
      process.execPath,
      [
        minecraftFile
      ],
      {
        cwd:
          __dirname,

        env:
          process.env,

        stdio: [
          "pipe",
          "pipe",
          "pipe"
        ]
      }
    );

  minecraftProcess.stdout.on(
    "data",
    data => {

      const output =
        data.toString();

      process.stdout.write(
        "[MC] " +
        output
      );

      parseMinecraftOutput(
        output
      );
    }
  );

  minecraftProcess.stderr.on(
    "data",
    data => {

      const output =
        data.toString();

      process.stderr.write(
        "[MC ERROR] " +
        output
      );
    }
  );

  minecraftProcess.on(
    "error",
    error => {

      console.error(
        "[MC] Prozessfehler:"
      );

      console.error(
        error
      );

      minecraftProcess =
        null;

      minecraftOnline =
        false;

      minecraftConnecting =
        false;

      if (
        afkActive
      ) {
        scheduleReconnect();
      }

      updatePanel();
    }
  );

  minecraftProcess.on(
    "exit",
    (code, signal) => {

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

      minecraftProcess =
        null;

      minecraftOnline =
        false;

      minecraftConnecting =
        false;

      if (
        afkActive
      ) {

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
}

function stopMinecraftProcess() {

  clearReconnectTimeout();

  if (
    !minecraftProcess
  ) {
    return;
  }

  console.log(
    "[MC] Beende Minecraft Prozess."
  );

  try {

    minecraftProcess.kill(
      "SIGTERM"
    );

  } catch (
    error
  ) {

    console.error(
      "[MC] Fehler beim Beenden:"
    );

    console.error(
      error
    );
  }

  minecraftProcess =
    null;

  minecraftOnline =
    false;

  minecraftConnecting =
    false;
}

function scheduleReconnect() {

  if (
    !afkActive
  ) {
    return;
  }

  if (
    reconnectTimeout
  ) {
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

        if (
          !afkActive
        ) {
          return;
        }

        statistics.reconnects++;

        lastAction =
          "Automatischer Reconnect";

        startMinecraftProcess();

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

function parseMinecraftOutput(
  output
) {

  const lines =
    output
      .split("\n")
      .map(
        line =>
          line.trim()
      )
      .filter(
        line =>
          line.length > 0
      );

  for (
    const line of lines
  ) {

    if (
      !line.startsWith(
        "AFK_STATUS:"
      )
    ) {
      continue;
    }

    const json =
      line.substring(
        "AFK_STATUS:".length
      );

    try {

      const data =
        JSON.parse(
          json
        );

      if (
        data.online !==
        undefined
      ) {
        minecraftOnline =
          data.online;
      }

      if (
        data.connecting !==
        undefined
      ) {
        minecraftConnecting =
          data.connecting;
      }

      if (
        data.position
      ) {
        position =
          data.position;
      }

      if (
        data.action
      ) {
        lastAction =
          data.action;
      }

      if (
        data.movements !==
        undefined
      ) {
        statistics.movements =
          data.movements;
      }

      if (
        data.jumps !==
        undefined
      ) {
        statistics.jumps =
          data.jumps;
      }

      updatePanel();

    } catch (
      error
    ) {

      console.log(
        "[DISCORD] Status konnte nicht gelesen werden."
      );
    }
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

  if (
    !panelMessage
  ) {
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

  } catch (
    error
  ) {

    console.log(
      "[DISCORD] Panel konnte nicht aktualisiert werden."
    );
  }
}

function createEmbed() {

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

  if (
    !sessionStarted
  ) {
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

if (
  !TOKEN
) {
  console.error(
    "DISCORD_TOKEN fehlt."
  );

  process.exit(1);
}

client.login(
  TOKEN
);

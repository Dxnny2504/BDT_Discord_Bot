require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const { spawn, exec } = require("child_process");

const TOKEN = process.env.DISCORD_TOKEN;
const OWNER_ID = process.env.DISCORD_OWNER_ID;

const DATABASE_FILE = path.join(
  __dirname,
  "bdt.json"
);

const MINECRAFT_FILE = path.join(
  __dirname,
  "index.js"
);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let minecraftProcess = null;
let activeCheck = false;
let currentPanelMessage = null;
let bdtSaveDetected = false;

console.log("");
console.log("========================================");
console.log("        BDT DISCORD BOT");
console.log("========================================");
console.log("");

client.once("clientReady", () => {
  console.log(
    "[DISCORD] Bot online: " +
      client.user.tag
  );

  console.log(
    "[DISCORD] Warte auf Befehle..."
  );
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) {
    return;
  }

  if (!message.content.startsWith("!")) {
    return;
  }

  const args =
    message.content
      .slice(1)
      .trim()
      .split(/\s+/);

  const command =
    args
      .shift()
      ?.toLowerCase();

  if (command === "bdt") {
    console.log(
      "[DISCORD] !bdt erkannt."
    );

    await sendBDTPanel(
      message.channel
    );

    return;
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) {
    return;
  }

  const customId =
    interaction.customId;

  console.log(
    "[DISCORD] Button: " +
      customId
  );

  const geschuetzt =
    customId === "bdt_pruefen" ||
    customId === "bdt_neu";

  if (
    geschuetzt &&
    interaction.user.id !== OWNER_ID
  ) {
    await interaction.reply({
      content:
        "❌ Du hast dafür keine Berechtigung.",
      ephemeral: true
    });

    console.log(
      "[AUTH] Zugriff verweigert für " +
        interaction.user.tag +
        " (" +
        interaction.user.id +
        ")"
    );

    return;
  }

  if (
    customId === "bdt_pruefen" ||
    customId === "bdt_neu"
  ) {
    await handleBDTCheck(
      interaction
    );

    return;
  }

  if (
    customId === "bdt_letzter"
  ) {
    await handleLastBDT(
      interaction
    );

    return;
  }
});

async function handleBDTCheck(
  interaction
) {
  if (activeCheck) {
    await interaction.reply({
      content:
        "⏳ Der Minecraft Account führt bereits einen BDT Check durch.",
      ephemeral: true
    });

    return;
  }

  await interaction.reply({
    content:
      "🧱 Der Minecraft Account wird gestartet und führt den BDT Check durch.",
    ephemeral: true
  });

  console.log("");
  console.log("========================================");
  console.log("        MINECRAFT CHECK START");
  console.log("========================================");
  console.log("");

  currentPanelMessage =
    interaction.message;

  startMinecraftCheck(
    interaction.message
  );
}

function startMinecraftCheck(
  panelMessage
) {
  if (activeCheck) {
    return;
  }

  activeCheck = true;
  bdtSaveDetected = false;

  console.log(
    "[MC] Starte index.js..."
  );

  if (
    !fs.existsSync(
      MINECRAFT_FILE
    )
  ) {
    console.error(
      "[MC] index.js wurde nicht gefunden."
    );

    activeCheck = false;
    return;
  }

  minecraftProcess =
    spawn(
      process.execPath,
      [
        MINECRAFT_FILE
      ],
      {
        cwd:
          __dirname,
        env:
          process.env,
        stdio:
          [
            "ignore",
            "pipe",
            "pipe"
          ],
        windowsHide:
          true
      }
    );

  console.log(
    "[MC] Prozess gestartet. PID: " +
      minecraftProcess.pid
  );

  minecraftProcess.stdout.on(
    "data",
    async (data) => {
      const output =
        data.toString();

      process.stdout.write(
        "[MC] " +
          output
      );

      if (
        !bdtSaveDetected &&
        output.includes(
          "BDT GESPEICHERT"
        )
      ) {
        bdtSaveDetected = true;

        console.log("");
        console.log(
          "[MC] BDT Speicherung erkannt."
        );

        await updatePanel(
          panelMessage
        );

        console.log(
          "[MC] Warte 2 Sekunden und beende den Minecraft Prozess."
        );

        setTimeout(() => {
          stopMinecraftCheck();
        }, 2000);
      }
    }
  );

  minecraftProcess.stderr.on(
    "data",
    (data) => {
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
    (error) => {
      console.error(
        "[MC] Prozessfehler:"
      );

      console.error(
        error
      );

      activeCheck = false;
      minecraftProcess = null;
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

      activeCheck = false;
      minecraftProcess = null;
      currentPanelMessage = null;
    }
  );
}

function stopMinecraftCheck() {
  if (
    !minecraftProcess
  ) {
    activeCheck = false;
    return;
  }

  const pid =
    minecraftProcess.pid;

  if (!pid) {
    activeCheck = false;
    minecraftProcess = null;
    return;
  }

  console.log("");
  console.log("========================================");
  console.log("        MINECRAFT BOT BEENDEN");
  console.log("========================================");
  console.log("");

  console.log(
    "[MC] PID: " +
      pid
  );

  if (
    process.platform === "win32"
  ) {
    exec(
      `taskkill /PID ${pid} /T /F`,
      (error, stdout, stderr) => {

        if (error) {
          console.error(
            "[MC] taskkill Fehler:"
          );

          console.error(
            error
          );

          console.error(
            stderr
          );

          return;
        }

        console.log(
          "[MC] Minecraft Prozessbaum erfolgreich beendet."
        );

        if (stdout) {
          console.log(
            stdout.trim()
          );
        }

        activeCheck = false;
        minecraftProcess = null;
        currentPanelMessage = null;
      }
    );

    return;
  }

  try {
    minecraftProcess.kill(
      "SIGTERM"
    );

    console.log(
      "[MC] Prozess beendet."
    );

  } catch (error) {
    console.error(
      "[MC] Fehler beim Beenden:"
    );

    console.error(
      error
    );
  }

  activeCheck = false;
  minecraftProcess = null;
  currentPanelMessage = null;
}

async function handleLastBDT(
  interaction
) {
  const data =
    loadBDTData();

  if (!data) {
    await interaction.reply({
      content:
        "📅 Es wurde bisher noch kein BDT gespeichert.",
      ephemeral: true
    });

    return;
  }

  const embed =
    createBDTEmbed(
      data
    );

  await interaction.reply({
    embeds: [
      embed
    ],
    ephemeral: true
  });
}

async function updatePanel(
  panelMessage
) {
  try {
    if (!panelMessage) {
      return;
    }

    const data =
      loadBDTData();

    if (!data) {
      console.log(
        "[DISCORD] Keine BDT Daten gefunden."
      );

      return;
    }

    const embed =
      createBDTEmbed(
        data
      );

    const buttons =
      createButtons();

    await panelMessage.edit({
      embeds: [
        embed
      ],
      components: [
        buttons
      ]
    });

    console.log(
      "[DISCORD] BDT Panel aktualisiert."
    );

  } catch (error) {
    console.error(
      "[DISCORD] Panel Fehler:"
    );

    console.error(
      error
    );
  }
}

async function sendBDTPanel(
  channel
) {
  const data =
    loadBDTData();

  const embed =
    createBDTEmbed(
      data || {}
    );

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

  console.log(
    "[DISCORD] BDT Panel gesendet."
  );

  return message;
}

function createBDTEmbed(
  data
) {
  const block =
    data &&
    data.block
      ? data.block
      : "Noch nicht geprüft";

  const belohnung =
    data &&
    data.belohnung
      ? data.belohnung
      : "Noch nicht geprüft";

  const datum =
    data &&
    data.datum
      ? formatDatum(
          data.datum
        )
      : "Noch keine";

  return new EmbedBuilder()
    .setTitle(
      "🧱 Block des Tages"
    )
    .addFields(
      {
        name:
          "🧱 Block",
        value:
          block,
        inline:
          true
      },
      {
        name:
          "🎁 Belohnung",
        value:
          belohnung,
        inline:
          true
      },
      {
        name:
          "⏰ Letzte Prüfung",
        value:
          datum,
        inline:
          false
      }
    )
    .setFooter({
      text:
        "BlitzControl • BDT"
    })
    .setTimestamp();
}

function createButtons() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "bdt_pruefen"
        )
        .setLabel(
          "BDT prüfen"
        )
        .setEmoji(
          "🧱"
        )
        .setStyle(
          ButtonStyle.Primary
        ),

      new ButtonBuilder()
        .setCustomId(
          "bdt_letzter"
        )
        .setLabel(
          "Letzten BDT"
        )
        .setEmoji(
          "📅"
        )
        .setStyle(
          ButtonStyle.Secondary
        ),

      new ButtonBuilder()
        .setCustomId(
          "bdt_neu"
        )
        .setLabel(
          "Neu prüfen"
        )
        .setEmoji(
          "🔄"
        )
        .setStyle(
          ButtonStyle.Success
        )
    );
}

function loadBDTData() {
  if (
    !fs.existsSync(
      DATABASE_FILE
    )
  ) {
    return null;
  }

  try {
    const content =
      fs.readFileSync(
        DATABASE_FILE,
        "utf8"
      );

    const database =
      JSON.parse(
        content
      );

    if (
      !database ||
      !Array.isArray(
        database.eintraege
      ) ||
      database.eintraege.length === 0
    ) {
      return null;
    }

    return database.eintraege[
      database.eintraege.length - 1
    ];

  } catch (error) {
    console.error(
      "[BDT] Datenbank Fehler:"
    );

    console.error(
      error
    );

    return null;
  }
}

function formatDatum(
  datum
) {
  const teile =
    datum.split("-");

  if (
    teile.length !== 3
  ) {
    return datum;
  }

  return (
    teile[2] +
    "." +
    teile[1] +
    "." +
    teile[0]
  );
}

if (!TOKEN) {
  console.error(
    "FEHLER: DISCORD_TOKEN fehlt."
  );

  process.exit(1);
}

if (!OWNER_ID) {
  console.error(
    "FEHLER: DISCORD_OWNER_ID fehlt."
  );

  process.exit(1);
}

client.login(
  TOKEN
);
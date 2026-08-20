require("dotenv").config();

const {
  Client,
  GatewayIntentBits
} = require("discord.js");

const TOKEN =
  process.env.DISCORD_TOKEN;

const client =
  new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

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
        .toLowerCase() === "!afk"
    ) {

      await message.reply(
        "AFK Bot ist online."
      );

      console.log(
        "[DISCORD] !afk empfangen."
      );
    }
  }
);

if (!TOKEN) {

  console.error(
    "[DISCORD] DISCORD_TOKEN fehlt!"
  );

  process.exit(1);
}

client.login(TOKEN);

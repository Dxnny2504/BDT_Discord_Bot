require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mineflayer = require("mineflayer");

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const DISCORD_TOKEN =
    process.env.DISCORD_TOKEN;

const DISCORD_OWNER_ID =
    process.env.DISCORD_OWNER_ID;

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

const MC_AUTH_DIR =
    path.join(
        process.cwd(),
        "minecraft-auth"
    );

let bot = null;
let starting = false;
let afkRunning = false;
let routeRunning = false;
let panelMessage = null;

let startedAt = null;

const mineflayer = require("mineflayer");
const fs = require("fs");
const path = require("path");
const {
  pathfinder,
  Movements,
  goals
} = require("mineflayer-pathfinder");

const bot = mineflayer.createBot({
  host: "griefergames.net",
  port: 25565,
  username: "r.guse858@gmail.com",
  auth: "microsoft",
  version: "1.8.9",
  profilesFolder: "./minecraft-auth"
});

bot.loadPlugin(pathfinder);

const DATABASE_FILE = path.join(
  __dirname,
  "bdt.json"
);

let portalRoomReached = false;
let citybuildReached = false;
let homeCommandSent = false;
let npcSearchStarted = false;
let npcClicked = false;
let bdtMenuRead = false;

console.log("========================================");
console.log("        BDT BOT STARTET");
console.log("        MINECRAFT 1.8.9");
console.log("========================================");

initializeDatabase();

bot.once("login", () => {
  console.log("");
  console.log("Minecraft Login erfolgreich.");
  console.log("GrieferGames Verbindung hergestellt.");
  console.log("");
});

bot.once("spawn", () => {
  console.log("");
  console.log("========================================");
  console.log("        BOT IM HUB");
  console.log("========================================");
  console.log("");

  printPosition("HUB");

  const movements = new Movements(bot);

  movements.canDig = false;
  movements.allow1by1towers = false;
  movements.allowParkour = true;
  movements.allowSprinting = true;

  bot.pathfinder.setMovements(movements);

  setTimeout(() => {
    console.log("");
    console.log("[PORTAL] Sende /portal...");
    bot.chat("/portal");
  }, 3000);
});

bot.on("respawn", () => {
  console.log("");
  console.log("========================================");
  console.log("        RESPAWN ERKANNT");
  console.log("========================================");
  console.log("");

  printPosition("RESPAWN");

  if (!portalRoomReached) {
    portalRoomReached = true;

    console.log(
      "[PORTAL] Warte auf die Portalraum Position..."
    );

    setTimeout(() => {
      startPortalRouteCheck();
    }, 3000);

    return;
  }

  if (!citybuildReached) {
    citybuildReached = true;

    bot.pathfinder.stop();
    bot.clearControlStates();

    console.log("");
    console.log("========================================");
    console.log("        CITYBUILD ERREICHT");
    console.log("========================================");
    console.log("");

    printPosition("CITYBUILD");

    console.log(
      "[CB6] Sende /home 55..."
    );

    setTimeout(() => {
      sendHomeCommand();
    }, 3000);
  }
});

bot.on("messagestr", (message) => {
  console.log("[CHAT] " + message);
});

bot.on("windowOpen", (window) => {
  console.log("");
  console.log("========================================");
  console.log("        MENÜ GEÖFFNET");
  console.log("========================================");
  console.log("");

  console.log(
    "[WINDOW] Typ: " +
      window.type
  );

  console.log(
    "[WINDOW] Titel: " +
      cleanText(window.title)
  );

  console.log(
    "[WINDOW] Slots: " +
      window.slots.length
  );

  if (
    cleanText(window.title)
      .toLowerCase()
      .includes("block des tages")
  ) {
    console.log(
      "[BDT] Echtes BDT Menü erkannt."
    );

    readBDTMenu(window);
  } else {
    console.log(
      "[WINDOW] Kein BDT Menü."
    );
  }
});

bot.on("windowClose", (window) => {
  console.log(
    "[WINDOW] Fenster geschlossen: " +
      cleanText(window.title)
  );
});

bot.on("kicked", (reason) => {
  console.log("");
  console.log("========================================");
  console.log("        BOT GEKICKT");
  console.log("========================================");
  console.log(reason);
});

bot.on("error", (error) => {
  console.log("");
  console.log("========================================");
  console.log("        BOT FEHLER");
  console.log("========================================");
  console.log(error);
});

function initializeDatabase() {
  if (!fs.existsSync(DATABASE_FILE)) {
    const initialDatabase = {
      eintraege: []
    };

    fs.writeFileSync(
      DATABASE_FILE,
      JSON.stringify(
        initialDatabase,
        null,
        2
      ),
      "utf8"
    );

    console.log(
      "[DATENBANK] bdt.json erstellt."
    );

    return;
  }

  console.log(
    "[DATENBANK] bdt.json geladen."
  );
}

function loadDatabase() {
  try {
    const content =
      fs.readFileSync(
        DATABASE_FILE,
        "utf8"
      );

    const database =
      JSON.parse(content);

    if (
      !database ||
      !Array.isArray(
        database.eintraege
      )
    ) {
      return {
        eintraege: []
      };
    }

    return database;
  } catch (error) {
    console.log(
      "[DATENBANK] Fehler beim Lesen:"
    );

    console.log(error);

    return {
      eintraege: []
    };
  }
}

function saveDatabase(database) {
  fs.writeFileSync(
    DATABASE_FILE,
    JSON.stringify(
      database,
      null,
      2
    ),
    "utf8"
  );
}

function saveBDTData(
  block,
  belohnung
) {
  const database =
    loadDatabase();

  const heute =
    getCurrentDate();

  const existingEntry =
    database.eintraege.find(
      entry =>
        entry.datum === heute
    );

  if (existingEntry) {
    existingEntry.block = block;
    existingEntry.belohnung =
      belohnung;

    existingEntry.aktualisiert =
      new Date().toISOString();
  } else {
    database.eintraege.push({
      datum: heute,
      block: block,
      belohnung: belohnung,
      erstellt:
        new Date().toISOString()
    });
  }

  saveDatabase(database);

  console.log("");
  console.log("========================================");
  console.log("        BDT GESPEICHERT");
  console.log("========================================");
  console.log("");

  console.log(
    "Datum: " +
      heute
  );

  console.log(
    "Block: " +
      block
  );

  console.log(
    "Belohnung: " +
      belohnung
  );

  console.log("");
  console.log(
    "[DATENBANK] Gespeichert in bdt.json."
  );
  console.log("");
}

function getCurrentDate() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      now.getDate()
    ).padStart(2, "0");

  return (
    year +
    "-" +
    month +
    "-" +
    day
  );
}

function readBDTMenu(window) {
  if (bdtMenuRead) {
    return;
  }

  bdtMenuRead = true;

  console.log("");
  console.log("========================================");
  console.log("        BDT MENÜ ANALYSIEREN");
  console.log("========================================");
  console.log("");

  let heutigerBlock = null;

  const sinnvolleItems = [];

  for (
    let i = 0;
    i < window.slots.length;
    i++
  ) {
    const item =
      window.slots[i];

    if (!item) {
      continue;
    }

    const name =
      cleanText(
        item.name || ""
      );

    const displayName =
      cleanText(
        item.displayName || ""
      );

    /*
     * Gray Stained Glass Pane
     * ist reine Dekoration.
     */

    if (
      name ===
        "stained_glass_pane" ||
      displayName
        .toLowerCase()
        .includes(
          "gray stained glass pane"
        )
    ) {
      continue;
    }

    /*
     * Persönliche Inventaritems
     * werden nicht als BDT Belohnung
     * interpretiert.
     */

    if (
      displayName
        .toLowerCase()
        .includes("yeezys")
    ) {
      continue;
    }

    sinnvolleItems.push({
      slot: i,
      name: name,
      displayName:
        displayName,
      item: item
    });

    console.log(
      "[BDT ITEM] Slot " +
        i +
        " | " +
        name +
        " | " +
        displayName
    );

    /*
     * Der heutige Block wird anhand
     * des BDT Items erkannt.
     */

    if (
      name === "dirt" &&
      displayName
        .toLowerCase()
        .includes(
          "podzol"
        )
    ) {
      heutigerBlock =
        displayName;

      console.log(
        "[BDT] Heutiger Block erkannt: " +
          heutigerBlock
      );
    }
  }

  if (
    !heutigerBlock
  ) {
    console.log(
      "[BDT] Heutiger Block wurde nicht erkannt."
    );

    return;
  }

  /*
   * Die Belohnung wird aktuell
   * bewusst nicht aus irgendeinem
   * beliebigen Item abgeleitet.
   *
   * Für heute kennen wir die
   * bestätigte BDT Belohnung:
   *
   * 2x verzauberter Block (Podsol)
   */

  const belohnung =
    "2x verzauberter Block (" +
    heutigerBlock +
    ")";

  console.log("");
  console.log("========================================");
  console.log("        BDT ERKANNT");
  console.log("========================================");
  console.log("");

  console.log(
    "Block: " +
      heutigerBlock
  );

  console.log(
    "Belohnung: " +
      belohnung
  );

  saveBDTData(
    heutigerBlock,
    belohnung
  );
}

function printPosition(name) {
  if (!bot.entity) {
    return;
  }

  console.log(
    "[" +
      name +
      "] X " +
      bot.entity.position.x.toFixed(3) +
      " Y " +
      bot.entity.position.y.toFixed(3) +
      " Z " +
      bot.entity.position.z.toFixed(3)
  );
}

function startPortalRouteCheck() {
  if (!bot.entity) {
    setTimeout(
      startPortalRouteCheck,
      1000
    );

    return;
  }

  const x =
    bot.entity.position.x;

  const y =
    bot.entity.position.y;

  const z =
    bot.entity.position.z;

  console.log("");
  console.log("========================================");
  console.log("        PORTALRAUM");
  console.log("========================================");

  printPosition(
    "PORTALRAUM"
  );

  const distanceFromStart =
    Math.sqrt(
      Math.pow(x - 325, 2) +
      Math.pow(y - 67, 2) +
      Math.pow(z - 280, 2)
    );

  if (
    distanceFromStart > 5
  ) {
    console.log(
      "[PORTAL] Noch nicht an der Startposition."
    );

    setTimeout(
      startPortalRouteCheck,
      1000
    );

    return;
  }

  console.log(
    "[PORTAL] Startposition erkannt."
  );

  geheZu(
    309.348,
    67.000,
    276.376,
    () => {

      console.log("");
      console.log(
        "[PORTAL] Portalpunkt erreicht."
      );

      printPosition(
        "PORTALPUNKT"
      );

      console.log("");
      console.log(
        "[PORTAL] Warte 13 Sekunden..."
      );

      countdownBeforePortal();
    }
  );
}

function countdownBeforePortal() {
  let remaining = 13;

  console.log(
    "[PORTAL] Noch " +
      remaining +
      " Sekunden."
  );

  const interval =
    setInterval(() => {

      remaining--;

      if (
        remaining > 0
      ) {

        console.log(
          "[PORTAL] Noch " +
            remaining +
            " Sekunden."
        );

        return;
      }

      clearInterval(
        interval
      );

      console.log("");
      console.log(
        "[PORTAL] Cooldown vorbei."
      );

      console.log(
        "[PORTAL] Laufe ins CB6 Portal."
      );

      walkIntoPortal();

    }, 1000);
}

function walkIntoPortal() {
  if (!bot.entity) {
    return;
  }

  const targetX =
    307.000;

  const targetZ =
    276.535;

  const dx =
    targetX -
    bot.entity.position.x;

  const dz =
    targetZ -
    bot.entity.position.z;

  const yaw =
    Math.atan2(dz, dx) -
    Math.PI / 2;

  bot.pathfinder.stop();

  bot.look(
    yaw,
    0,
    true
  );

  bot.setControlState(
    "forward",
    true
  );

  bot.setControlState(
    "sprint",
    false
  );

  bot.setControlState(
    "jump",
    false
  );

  setTimeout(() => {

    if (
      !citybuildReached
    ) {

      bot.clearControlStates();

      console.log(
        "[PORTAL] Sicherheitsstopp."
      );

      printPosition(
        "POSITION"
      );
    }

  }, 15000);
}

function sendHomeCommand() {
  if (
    homeCommandSent
  ) {
    return;
  }

  homeCommandSent =
    true;

  console.log("");
  console.log("========================================");
  console.log("        HOME 55");
  console.log("========================================");
  console.log("");

  console.log(
    "[HOME] Sende /home 55..."
  );

  bot.chat(
    "/home 55"
  );

  console.log(
    "[HOME] Befehl gesendet."
  );

  setTimeout(() => {

    if (
      !npcSearchStarted
    ) {

      npcSearchStarted =
        true;

      console.log(
        "[HOME] Warte auf Teleport..."
      );

      setTimeout(() => {
        searchForBDTNpc();
      }, 5000);
    }

  }, 5000);
}

function searchForBDTNpc() {
  console.log("");
  console.log("========================================");
  console.log("        BDT NPC SUCHEN");
  console.log("========================================");
  console.log("");

  printPosition(
    "HOME POSITION"
  );

  const entities =
    Object.values(
      bot.entities
    );

  let closestEntity =
    null;

  let closestDistance =
    Infinity;

  for (
    const entity of entities
  ) {

    if (!entity) {
      continue;
    }

    if (
      entity ===
      bot.entity
    ) {
      continue;
    }

    const distance =
      bot.entity.position.distanceTo(
        entity.position
      );

    if (
      distance <= 10
    ) {

      console.log(
        "[ENTITY] " +
          entity.type +
          " | " +
          entity.username +
          " | Entfernung: " +
          distance.toFixed(3)
      );

      if (
        distance <
        closestDistance
      ) {

        closestDistance =
          distance;

        closestEntity =
          entity;
      }
    }
  }

  if (
    !closestEntity
  ) {

    console.log(
      "[NPC] Keine Entity gefunden."
    );

    return;
  }

  console.log("");
  console.log(
    "[NPC] Naheste Entity gefunden."
  );

  console.log(
    "[NPC] Typ: " +
      closestEntity.type
  );

  console.log(
    "[NPC] Name: " +
      closestEntity.username
  );

  console.log(
    "[NPC] Entfernung: " +
      closestDistance.toFixed(3)
  );

  clickNpc(
    closestEntity
  );
}

function clickNpc(
  entity
) {

  if (
    npcClicked
  ) {
    return;
  }

  npcClicked =
    true;

  console.log("");
  console.log("========================================");
  console.log("        NPC KLICKEN");
  console.log("========================================");
  console.log("");

  try {

    bot.lookAt(
      entity.position.offset(
        0,
        1,
        0
      ),
      true
    );

    setTimeout(() => {

      console.log(
        "[NPC] Aktiviere Entity..."
      );

      bot.activateEntity(
        entity
      );

      console.log(
        "[NPC] Entity aktiviert."
      );

    }, 500);

  } catch (
    error
  ) {

    console.log(
      "[NPC] Fehler beim Klicken:"
    );

    console.log(
      error
    );
  }
}

function geheZu(
  x,
  y,
  z,
  callback
) {

  const ziel =
    new goals.GoalNear(
      x,
      y,
      z,
      0.5
    );

  let finished =
    false;

  console.log(
    "[WEG] Laufe zu " +
      x.toFixed(3) +
      " / " +
      y.toFixed(3) +
      " / " +
      z.toFixed(3)
  );

  bot.pathfinder.setGoal(
    ziel
  );

  const interval =
    setInterval(() => {

      if (
        finished ||
        !bot.entity
      ) {
        return;
      }

      const dx =
        x -
        bot.entity.position.x;

      const dy =
        y -
        bot.entity.position.y;

      const dz =
        z -
        bot.entity.position.z;

      const distance =
        Math.sqrt(
          dx * dx +
          dy * dy +
          dz * dz
        );

      if (
        distance <= 0.6
      ) {

        finished =
          true;

        clearInterval(
          interval
        );

        bot.pathfinder.stop();

        console.log(
          "[WEG] Ziel erreicht. Entfernung: " +
            distance.toFixed(3)
        );

        printPosition(
          "POSITION"
        );

        callback();
      }

    }, 250);

  setTimeout(() => {

    if (
      finished
    ) {
      return;
    }

    finished =
      true;

    clearInterval(
      interval
    );

    bot.pathfinder.stop();

    console.log("");
    console.log(
      "[WEG] Sicherheitsstopp nach 60 Sekunden."
    );

    printPosition(
      "POSITION"
    );

  }, 60000);
}

function cleanText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replace(
      /§[0-9a-fk-or]/gi,
      ""
    )
    .trim();
}
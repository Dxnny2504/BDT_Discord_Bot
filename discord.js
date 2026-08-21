discordClient.on(
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
                .toLowerCase() !==
            "!afk"
        ) {
            return;
        }

        if (
            DISCORD_OWNER_ID &&
            message.author.id !==
            DISCORD_OWNER_ID
        ) {
            return;
        }

        console.log(
            "[DISCORD] !afk empfangen."
        );

        try {

            panelMessage =
                await message.channel.send(
                    createPanel()
                );

            console.log(
                "[DISCORD] AFK Panel erstellt."
            );

        } catch (error) {

            console.error(
                "[DISCORD ERROR]"
            );

            console.error(error);

        }

    }
);

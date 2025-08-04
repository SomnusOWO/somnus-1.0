/*
 * Comprehensive Discord bot example
 *
 * This script demonstrates how you could extend a basic Discord bot to include many of the
 * features offered by mainstream bots such as MEE6, Carl‑bot and YAGPDB. It uses the
 * discord.js library for interactions with Discord’s API. The code is organised into
 * small helper functions and event handlers to keep it maintainable. Note that you’ll
 * need to install dependencies (discord.js v14 or later) and create a Discord
 * application/bot through the Discord Developer Portal. After installing the dependencies
 * (e.g. `npm install discord.js`), rename this file to `index.js` and replace
 * the placeholder `YOUR_BOT_TOKEN` with your bot’s token.
 */

const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const fs = require('fs');

// === Configuration ===
const PREFIX = '!'; // command prefix
const WELCOME_CHANNEL_ID = 'YOUR_WELCOME_CHANNEL_ID';
const LOG_CHANNEL_ID = 'YOUR_MOD_LOG_CHANNEL_ID';
const REACTION_ROLE_MESSAGE_ID = 'MESSAGE_ID_FOR_ROLES';
const REACTION_ROLE_MAP = {
  '😀': 'ROLE_ID_FOR_SMILE',
  '🎮': 'ROLE_ID_FOR_GAMER',
  // Add more emoji→role mappings here
};

// Load or initialise the leveling database
const LEVEL_DB_FILE = './levels.json';
let levels = {};
try {
  levels = JSON.parse(fs.readFileSync(LEVEL_DB_FILE));
} catch (e) {
  levels = {};
}

// Helper to save the database
function saveLevels() {
  fs.writeFileSync(LEVEL_DB_FILE, JSON.stringify(levels, null, 2));
}

// Calculates the XP needed to reach the next level
function getXpForLevel(level) {
  return 5 * Math.pow(level, 2) + 50 * level + 100;
}

// === Bot setup ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Collection for commands
client.commands = new Collection();

// === Command implementations ===

function addCommand(name, description, execute) {
  client.commands.set(name, { name, description, execute });
}

// Kick command
addCommand('kick', 'Kick a user. Usage: !kick @user [reason]', async (msg, args) => {
  if (!msg.member.permissions.has('KickMembers')) return msg.reply('你沒有權限使用此命令。');
  const target = msg.mentions.members.first();
  if (!target) return msg.reply('請提及要踢出的使用者。');
  const reason = args.slice(1).join(' ') || '未提供原因';
  try {
    await target.kick(reason);
    msg.channel.send(`已踢出 ${target.user.tag}。原因：${reason}`);
  } catch (err) {
    console.error(err);
    msg.reply('無法踢出該使用者。');
  }
});

// Ban command
addCommand('ban', 'Ban a user. Usage: !ban @user [reason]', async (msg, args) => {
  if (!msg.member.permissions.has('BanMembers')) return msg.reply('你沒有權限使用此命令。');
  const target = msg.mentions.members.first();
  if (!target) return msg.reply('請提及要封禁的使用者。');
  const reason = args.slice(1).join(' ') || '未提供原因';
  try {
    await target.ban({ reason });
    msg.channel.send(`已封禁 ${target.user.tag}。原因：${reason}`);
  } catch (err) {
    console.error(err);
    msg.reply('無法封禁該使用者。');
  }
});

// Mute command (timeout)
addCommand('mute', 'Mute a user for a period. Usage: !mute @user [minutes] [reason]', async (msg, args) => {
  if (!msg.member.permissions.has('ModerateMembers')) return msg.reply('你沒有權限使用此命令。');
  const target = msg.mentions.members.first();
  const minutes = parseInt(args[1], 10);
  if (!target || isNaN(minutes)) return msg.reply('使用範例：!mute @user 10 停權十分鐘');
  const reason = args.slice(2).join(' ') || '未提供原因';
  try {
    await target.timeout(minutes * 60 * 1000, reason);
    msg.channel.send(`已將 ${target.user.tag} 靜音 ${minutes} 分鐘。原因：${reason}`);
  } catch (err) {
    console.error(err);
    msg.reply('無法靜音該使用者。');
  }
});

// Level command
addCommand('level', '查看你的等級和 XP。', (msg) => {
  const userId = msg.author.id;
  const userData = levels[userId] || { xp: 0, level: 0 };
  msg.reply(`你的等級：${userData.level}。XP：${userData.xp}/${getXpForLevel(userData.level + 1)}`);
});

// Ping command
addCommand('ping', 'Bot latency check.', async (msg) => {
  const m = await msg.channel.send('Pinging…');
  m.edit(`Pong! 延遲：${m.createdTimestamp - msg.createdTimestamp}ms`);
});

// Reaction Role command (to set up the reaction role message)
addCommand('setuproles', 'Set up reaction roles (admin only).', async (msg) => {
  if (!msg.member.permissions.has('Administrator')) return;
  let content = '反應來取得角色\n';
  for (const [emoji, roleId] of Object.entries(REACTION_ROLE_MAP)) {
    const role = msg.guild.roles.cache.get(roleId);
    if (role) content += `${emoji} → ${role.name}\n`;
  }
  const reactionMsg = await msg.channel.send(content);
  for (const emoji of Object.keys(REACTION_ROLE_MAP)) {
    await reactionMsg.react(emoji);
  }
  msg.channel.send('已建立反應身分組訊息。');
});

// Economy system: show balance
const economy = {};
function saveEconomy() {
  fs.writeFileSync('./economy.json', JSON.stringify(economy, null, 2));
}
addCommand('balance', '查看你的貨幣餘額。', (msg) => {
  const userId = msg.author.id;
  const balance = economy[userId] || 0;
  msg.reply(`你有 ${balance} 金幣。`);
});
addCommand('daily', '領取每日獎勵。', (msg) => {
  const userId = msg.author.id;
  economy[userId] = (economy[userId] || 0) + 100;
  saveEconomy();
  msg.reply('你領取了每日 100 金幣！');
});

// Giveaway command (simple example)
addCommand('giveaway', '舉辦抽獎。Usage: !giveaway 1m 3 讚美我的服務器', async (msg, args) => {
  if (!msg.member.permissions.has('ManageMessages')) return msg.reply('你沒有權限舉辦抽獎。');
  const durationStr = args[0];
  const winnerCount = parseInt(args[1], 10);
  const prize = args.slice(2).join(' ') || '神秘獎品';
  if (!durationStr || isNaN(winnerCount)) return msg.reply('使用範例：!giveaway 1m 1 超棒獎品');
  const durationMs = parseDuration(durationStr);
  const embed = {
    title: '🎉 抽獎！',
    description: `獎品：${prize}\n持續時間：${durationStr}\n抽出 ${winnerCount} 名得主！\n點擊 🎉 參與。`,
  };
  const giveawayMsg = await msg.channel.send({ embeds: [embed] });
  await giveawayMsg.react('🎉');
  setTimeout(async () => {
    const fetchedMsg = await giveawayMsg.fetch();
    const reactions = fetchedMsg.reactions.cache.get('🎉');
    const users = await reactions.users.fetch();
    const participants = users.filter((u) => !u.bot).map((u) => u);
    if (participants.length === 0) return msg.channel.send('沒有人參加抽獎。');
    const winners = [];
    for (let i = 0; i < Math.min(winnerCount, participants.length); i++) {
      const randomIndex = Math.floor(Math.random() * participants.length);
      winners.push(participants.splice(randomIndex, 1)[0]);
    }
    msg.channel.send(`恭喜 ${winners.map((w) => w.toString()).join(', ')} 贏得 ${prize}！`);
  }, durationMs);
});

// === Utility functions ===

function parseDuration(str) {
  const match = str.match(/(\d+)(s|m|h|d)/);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return num * 1000;
    case 'm': return num * 60 * 1000;
    case 'h': return num * 60 * 60 * 1000;
    case 'd': return num * 24 * 60 * 60 * 1000;
    default: return 0;
  }
}

// === Event handlers ===

client.on(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// Welcome new members
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (channel) channel.send(`歡迎 ${member} 加入伺服器！`);
    await member.send('歡迎你加入！如果有任何問題，請隨時詢問。');
  } catch (err) {
    console.error('無法發送歡迎訊息：', err);
  }
});

// Reaction role assignment
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (reaction.message.id !== REACTION_ROLE_MESSAGE_ID) return;
  if (user.bot) return;
  const roleId = REACTION_ROLE_MAP[reaction.emoji.name];
  if (!roleId) return;
  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);
  await member.roles.add(roleId);
});
client.on(Events.MessageReactionRemove, async (reaction, user) => {
  if (reaction.message.id !== REACTION_ROLE_MESSAGE_ID) return;
  if (user.bot) return;
  const roleId = REACTION_ROLE_MAP[reaction.emoji.name];
  if (!roleId) return;
  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);
  await member.roles.remove(roleId);
});

// Message handler for commands and leveling
client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  // Leveling logic
  const userId = msg.author.id;
  if (!levels[userId]) levels[userId] = { xp: 0, level: 0 };
  const userData = levels[userId];
  userData.xp += 10; // grant XP per message
  const nextLevelXp = getXpForLevel(userData.level + 1);
  if (userData.xp >= nextLevelXp) {
    userData.level++;
    userData.xp -= nextLevelXp;
    msg.channel.send(`${msg.author} 恭喜你升到等級 ${userData.level}！`);
  }
  saveLevels();

  // Command processing
  if (!msg.content.startsWith(PREFIX)) return;
  const args = msg.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();
  const command = client.commands.get(cmd);
  if (command) {
    try {
      await command.execute(msg, args);
    } catch (err) {
      console.error(err);
      msg.reply('執行命令時發生錯誤。');
    }
  }
});

// === Start the bot ===
client.login('YOUR_BOT_TOKEN');
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Hercai } = require('hercai');
const Tesseract = require('tesseract.js');
const fetch = require('node-fetch');
const { allowed_channel_ids, token, image2textChannels, clientId, guildId } = require('./config.json');

const herc = new Hercai();
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ]
});

// Statistics object
const stats = {
  commandsUsed: 0,
  imagesProcessed: 0,
  pollCommandsUsed: 0,
};

// Register slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll')
    .addStringOption(option => 
      option.setName('question')
        .setDescription('The poll question')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('options')
        .setDescription('Comma-separated poll options')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Display bot statistics')
]
  .map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

client.once('ready', () => {
  console.log(`bot is ready! ${client.user.tag}!`);
  console.log(`Code by HEX`);
  console.log(`discord.gg/eastark`);
});

async function extractTextFromImage(url) {
  try {
    const image = await fetch(url).then(res => res.buffer());
    const textFromImage = await Tesseract.recognize(image, 'eng');
    return textFromImage.data.text;
  } catch (error) {
    return "Error ";
  }
}

client.on('messageCreate', async message => {
  if (message.author.bot || (!allowed_channel_ids.includes(message.channel.id) && !image2textChannels.includes(message.channel.id))) return;

  stats.commandsUsed++;

  let fullContent = message.content;

  if (message.attachments.size > 0 && image2textChannels.includes(message.channel.id)) {
    const attachment = message.attachments.first();
    if (attachment.contentType && attachment.contentType.startsWith('image/')) {
      try {
        stats.imagesProcessed++;
        const extractedText = await extractTextFromImage(attachment.url);
        await message.reply(`Extracted Text: ${extractedText}`);
      } catch (error) {
        await message.reply('Sorry, I had trouble reading that image.');
      }
    }
    return;
  }

  if (message.attachments.size > 0 && allowed_channel_ids.includes(message.channel.id)) {
    const attachment = message.attachments.first();
    if (attachment.contentType && attachment.contentType.startsWith('image/')) {
      try {
        const textFromImage = await extractTextFromImage(attachment.url);
        fullContent += ` [Image Content: ${textFromImage}]`;
        stats.imagesProcessed++;
      } catch (error) {
        await message.reply('Sorry, I had trouble reading that image.');
        return;
      }
    }
  }

  try {
    const response = await herc.question({ model: "v3-beta", content: fullContent });
    await message.reply(response.reply);
  } catch (error) {
    await message.reply('Sorry, I ran into a bit of trouble trying to respond.');
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'poll') {
    stats.pollCommandsUsed++;
    const question = options.getString('question');
    const optionsString = options.getString('options');
    const pollOptions = optionsString.split(',').map(opt => opt.trim());

    let pollMessage = `**${question}**\n\n`;
    const emojiOptions = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭', '🇮', '🇯'];

    for (let i = 0; i < pollOptions.length; i++) {
      pollMessage += `${emojiOptions[i]} ${pollOptions[i]}\n`;
    }

    const poll = await interaction.reply({ content: pollMessage, fetchReply: true });
    for (let i = 0; i < pollOptions.length; i++) {
      await poll.react(emojiOptions[i]);
    }
  } else if (commandName === 'stats') {
    const statsMessage = `
      **Bot Statistics:**
      - Total commands used: ${stats.commandsUsed}
      - Images processed: ${stats.imagesProcessed}
      - Poll commands used: ${stats.pollCommandsUsed}
    `;
    await interaction.reply(statsMessage);
  }
});

client.login(token);

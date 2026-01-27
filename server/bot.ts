import { Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits, EmbedBuilder, REST, Routes, ActivityType, TextChannel, ThreadChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import OpenAI from "openai";
import { storage } from "./storage";

// Initialize OpenAI with Replit AI Integrations
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.ThreadMember],
});

const ADMIN_ID = "1385342457570394187";

// State for tickets
const ticketStates = new Map<string, { step: string; reason?: string }>();

// Bot customization state
let botConfig = {
  statusType: ActivityType.Streaming,
  statusText: "Gère {server_count} serveurs",
};

client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  updateStatus();
  registerCommands();
});

client.on("guildMemberAdd", async (member) => {
  const isOwner = member.id === ADMIN_ID;
  const isStaff = await storage.getStaff(member.id);
  
  if (isOwner || isStaff) {
    const welcomeChannel = member.guild.channels.cache.find(c => 
      c.type === ChannelType.GuildText && (
      c.name.toLowerCase().includes("discussion") || 
      c.name.toLowerCase().includes("bienvenue") ||
      c.name.toLowerCase().includes("chat") ||
      c.name.toLowerCase().includes("général")
      )
    ) as TextChannel;

    if (welcomeChannel) {
      const message = isOwner 
        ? `Bienvenue à mon créateur <@${member.id}> !` 
        : `Bienvenue à mon staff <@${member.id}> !`;
      
      await welcomeChannel.send({ content: `@here ${message}` });
    }
  }
});

function updateStatus() {
  if (!client.user) return;
  const count = client.guilds.cache.size;
  const text = botConfig.statusText.replace("{server_count}", count.toString());
  client.user.setActivity(text, { type: botConfig.statusType as any, url: "https://discord.gg/9sK3YG9aAY" });
}

async function registerCommands() {
  const commands = [
    {
      name: "ticket",
      description: "Envoyer l'embed de création de ticket",
      options: [
        { name: "titre", description: "Titre de l'embed", type: 3, required: true },
        { name: "description", description: "Description de l'embed", type: 3, required: true },
        { name: "image", description: "URL du thumbnail", type: 3, required: false },
      ],
    },
    {
      name: "accès",
      description: "Donner l'accès staff (Admin seulement)",
      options: [{ name: "utilisateur", description: "Utilisateur", type: 6, required: true }],
    },
    {
      name: "leave",
      description: "Retirer l'accès staff (Admin seulement)",
      options: [{ name: "utilisateur", description: "Utilisateur", type: 6, required: true }],
    },
    {
      name: "bot",
      description: "Configurer le bot (Admin seulement)",
      options: [
        {
          name: "setname",
          description: "Changer le nom du bot",
          type: 1,
          options: [{ name: "name", description: "Nouveau nom", type: 3, required: true }],
        },
        {
          name: "setavatar",
          description: "Changer l'avatar du bot",
          type: 1,
          options: [{ name: "url", description: "URL de l'image", type: 3, required: true }],
        },
        {
          name: "setstatus",
          description: "Changer le statut du bot",
          type: 1,
          options: [
            { name: "type", description: "Type (PLAYING, WATCHING, STREAMING)", type: 3, required: true, choices: [{ name: "Play", value: "PLAYING" }, { name: "Watch", value: "WATCHING" }, { name: "Stream", value: "STREAMING" }] },
            { name: "text", description: "Texte du statut", type: 3, required: true }
          ],
        },
      ],
    },
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

  try {
    console.log("Started refreshing application (/) commands.");
    await rest.put(Routes.applicationCommands(client.user!.id), { body: commands });
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
}

client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === "create_ticket") {
      const guild = interaction.guild;
      if (!guild) return;

      try {
        await interaction.deferReply({ ephemeral: true });

        const channel = await guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            { id: client.user!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
          ],
        });

        ticketStates.set(channel.id, { step: "init" });
        await interaction.editReply({ content: `Ticket créé: ${channel.toString()}` });
        
        setTimeout(async () => {
          try {
            await channel.send(`Bonjour ${interaction.user.toString()}, quel est le but du ticket ?`);
          } catch (err) {
            console.error("Failed to send welcome message:", err);
          }
        }, 1000);
      } catch (error: any) {
        console.error("Channel creation error:", error);
        if (interaction.deferred) {
          await interaction.editReply({ content: `Erreur: ${error.message || "Erreur inconnue"}` });
        }
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ticket") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: "Vous devez être administrateur pour utiliser cette commande.", ephemeral: true });
      return;
    }

    const titre = interaction.options.getString("titre", true);
    const description = interaction.options.getString("description", true);
    const image = interaction.options.getString("image");

    const embed = new EmbedBuilder()
      .setTitle(titre)
      .setDescription(description)
      .setColor("#2b2d31");

    if (image) embed.setThumbnail(image);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("create_ticket")
        .setLabel("Ouvrir un ticket")
        .setEmoji("🎫")
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ content: "Embed envoyé !", ephemeral: true });
    if (interaction.channel && 'send' in interaction.channel) {
      await (interaction.channel as TextChannel).send({ embeds: [embed], components: [row] });
    }
  }

  if (interaction.commandName === "accès") {
    const isOwner = interaction.user.id === ADMIN_ID;
    const isStaff = await storage.getStaff(interaction.user.id);

    if (!isOwner && !isStaff) {
      await interaction.reply({ content: "Seul l'administrateur ou le staff peut utiliser cette commande.", ephemeral: true });
      return;
    }
    
    const user = interaction.options.getUser("utilisateur", true);
    await storage.addStaff({ id: user.id, username: user.username });
    
    // Auto-add staff to all existing ticket channels
    const ticketChannels = interaction.guild?.channels.cache.filter(c => 
      c.name.toLowerCase().startsWith("ticket") && c.type === ChannelType.GuildText
    );

    if (ticketChannels) {
      for (const channel of Array.from(ticketChannels.values())) {
        await (channel as TextChannel).permissionOverwrites.edit(user.id, {
          ViewChannel: true,
          SendMessages: true
        }).catch(console.error);
      }
    }

    await interaction.reply(`Accès staff accordé à ${user.tag} sur tous les tickets.`);
  }

  if (interaction.commandName === "leave") {
    const isOwner = interaction.user.id === ADMIN_ID;
    const isStaff = await storage.getStaff(interaction.user.id);

    if (!isOwner && !isStaff) {
      await interaction.reply({ content: "Seul l'administrateur ou le staff peut utiliser cette commande.", ephemeral: true });
      return;
    }
    
    await interaction.reply({ content: "Le bot va quitter le serveur. Au revoir !" });
    await interaction.guild?.leave();
  }

  if (interaction.commandName === "bot") {
      if (interaction.user.id !== ADMIN_ID) {
          await interaction.reply({ content: "Vous n'avez pas la permission.", ephemeral: true });
          return;
      }

      const subCommand = interaction.options.getSubcommand();
      
      try {
        if (subCommand === "setname") {
            const name = interaction.options.getString("name", true);
            await client.user?.setUsername(name);
            await interaction.reply(`Nom changé pour: ${name}`);
        } else if (subCommand === "setavatar") {
            const url = interaction.options.getString("url", true);
            await client.user?.setAvatar(url);
            await interaction.reply("Avatar changé.");
        } else if (subCommand === "setstatus") {
            const type = interaction.options.getString("type", true);
            const text = interaction.options.getString("text", true);
            
            let activityType = ActivityType.Playing;
            if (type === "WATCHING") activityType = ActivityType.Watching;
            if (type === "STREAMING") activityType = ActivityType.Streaming;
            
            botConfig.statusType = activityType;
            botConfig.statusText = text;
            updateStatus();
            await interaction.reply("Statut mis à jour.");
        }
      } catch (err: any) {
          await interaction.reply({ content: `Erreur: ${err.message}`, ephemeral: true });
      }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Handle +server, +inv, +add, +list, +del commands
  const isOwner = message.author.id === ADMIN_ID;
  const isStaff = await storage.getStaff(message.author.id);

  if (isOwner || isStaff) {
    if (message.content === "+server") {
      const guilds = client.guilds.cache.map(g => `- ${g.name} (${g.id})`).join("\n") || "Aucun serveur.";
      await message.reply(`Liste des serveurs :\n${guilds}`);
      return;
    }
    if (message.content.startsWith("+inv ")) {
      const guildId = message.content.split(" ")[1];
      const guild = client.guilds.cache.get(guildId);
      if (!guild) {
        await message.reply("Serveur introuvable.");
        return;
      }
      try {
        const channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText) as TextChannel;
        if (!channel) {
          await message.reply("Aucun salon textuel trouvé pour créer une invitation.");
          return;
        }
        const invite = await channel.createInvite({ maxAge: 0, maxUses: 0 });
        await message.reply(`Invitation pour ${guild.name} : ${invite.url}`);
      } catch (err: any) {
        await message.reply(`Erreur lors de la création de l'invitation : ${err.message}`);
      }
      return;
    }
  }

  if (isOwner) {
    if (message.content.startsWith("+add ")) {
      const user = message.mentions.users.first();
      if (user) {
        await storage.addStaff({ id: user.id, username: user.username });
        await message.reply(`Staff ajouté: ${user.tag}`);
      }
      return;
    }
    if (message.content === "+list") {
      const allStaff = await storage.getAllStaff();
      const list = allStaff.map(s => `- ${s.username} (${s.id})`).join("\n") || "Aucun staff.";
      await message.reply(`Liste du staff:\n${list}`);
      return;
    }
    if (message.content.startsWith("+del ")) {
      const user = message.mentions.users.first();
      if (user) {
        await storage.removeStaff(user.id);
        await message.reply(`Staff retiré: ${user.tag}`);
      }
      return;
    }
  }

  // Handle +avatar command
  if (message.content.startsWith("+avatar") && message.author.id === ADMIN_ID) {
    const attachment = message.attachments.first();
    if (attachment) {
      try {
        await client.user?.setAvatar(attachment.url);
        await message.reply("Avatar mis à jour avec succès !");
      } catch (err: any) {
        await message.reply(`Erreur lors de la mise à jour de l'avatar: ${err.message}`);
      }
      return;
    }
  }

  // Respond in ANY channel that contains "ticket"
  const isTicketChannel = message.channel instanceof TextChannel && message.channel.name.toLowerCase().includes("ticket");
  const state = ticketStates.get(message.channelId);
  
  if (!isTicketChannel && !state) return;

  // AI Processing
  try {
      const allChannels = message.guild?.channels.cache.map(c => ({ id: c.id, name: c.name, type: c.type })) || [];
      const allStaffMembers = await storage.getAllStaff();
      const staffMentions = allStaffMembers.map(s => `<@${s.id}>`).join(", ");

      const messages = [
          { role: "system", content: `
            Tu es un bot modérateur Discord intelligent et assistant de recrutement. 
            Ton but est d'aider l'utilisateur, gérer des plaintes, des candidatures ou répondre à des questions sur le serveur.
            
            Contexte actuel:
            - Étape: ${state?.step || "conversation"}
            - Owner ID: ${message.guild?.ownerId}
            - Staff Actuel: ${staffMentions}
            - Salons: ${JSON.stringify(allChannels)}
            
            Règles:
            1. **ACCÈS STAFF** : Les membres du staff ont accès à TOUS les tickets du serveur. Mentionne-les si nécessaire.
            2. **CANDIDATURES** : Demande une fiche complète, analyse. Si top -> ping owner (<@${message.guild?.ownerId}>). Si flop -> explique pourquoi poliment.
            3. **SANCTIONS RÉELLES** : Tu décides TOI-MÊME de la sanction. Analyse le message. Si c'est grave (insulte, spam, etc.), choisis BAN, KICK ou MUTE. Ne demande pas, décide. PAS BESOIN DE CAPTURES D'ÉCRAN obligatoires, base-toi sur le texte.
            4. **AIDE SALONS** : Indique le bon salon via <#ID>.
            5. **REPONSE** : Toujours en JSON.
            
            Format JSON:
            {
              "reply": "Message",
              "action": "NONE" | "BAN" | "KICK" | "MUTE" | "DELETE_TICKET" | "PING_OWNER",
              "targetUserId": "ID de l'utilisateur à sanctionner",
              "reason": "Raison de la sanction",
              "newStep": "step"
            }
          ` as const },
          { role: "user", content: `Message: "${message.content}". UserID: ${message.author.id}` as const }
      ];

      const completion = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: messages as any,
          response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      
      if (result.reply) await message.channel.send(result.reply);

      if (result.newStep && state) {
          state.step = result.newStep;
          ticketStates.set(message.channelId, state);
      }

      // ACTIONS RÉELLES
      const guild = message.guild;
      const targetId = result.targetUserId || message.author.id;
      const member = await guild?.members.fetch(targetId).catch(() => null);

      if (result.action === "BAN" && member?.bannable) {
          await member.ban({ reason: result.reason });
          await message.channel.send(`[SYSTEM] ${member.user.tag} a été BAN pour: ${result.reason}`);
      } else if (result.action === "KICK" && member?.kickable) {
          await member.kick(result.reason);
          await message.channel.send(`[SYSTEM] ${member.user.tag} a été KICK pour: ${result.reason}`);
      } else if (result.action === "MUTE" && member?.moderatable) {
          await member.timeout(24 * 60 * 60 * 1000, result.reason); // 24h
          await message.channel.send(`[SYSTEM] ${member.user.tag} a été MUTE (24h) pour: ${result.reason}`);
      } else if (result.action === "DELETE_TICKET") {
          setTimeout(() => message.channel.delete().catch(() => {}), 5000);
      } else if (result.action === "PING_OWNER") {
          await message.channel.send(`Candidature validée. Notification <@${guild?.ownerId}>.`);
      }

  } catch (error) {
      console.error("AI Error:", error);
  }
});

export function startBot() {
    if (!process.env.DISCORD_TOKEN) return;
    client.login(process.env.DISCORD_TOKEN).catch(console.error);
}

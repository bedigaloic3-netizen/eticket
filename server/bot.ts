import { Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits, EmbedBuilder, REST, Routes, ActivityType, TextChannel, ThreadChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import OpenAI from "openai";

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
  ],
  partials: [Partials.Channel, Partials.Message, Partials.ThreadMember],
});

const ADMIN_ID = "1385342457570394187";

// State for tickets (could be in DB, using memory for MVP)
// Map<ChannelID, TicketState>
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
      name: "bot",
      description: "Configurer le bot (Admin seulement)",
      options: [
        {
          name: "setname",
          description: "Changer le nom du bot",
          type: 1, // Subcommand
          options: [{ name: "name", description: "Nouveau nom", type: 3, required: true }],
        },
        {
          name: "setavatar",
          description: "Changer l'avatar du bot",
          type: 1,
          options: [{ name: "url", description: "URL de l'image", type: 3, required: true }],
        },
        {
          name: "setbanner",
          description: "Changer la bannière du bot",
          type: 1, // Subcommand is technically not supported for banner directly via API easily on user accounts, but bots don't have banners in the same way. We'll skip or simulate.
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
    if (interaction.user.id !== ADMIN_ID) {
      await interaction.reply({ content: "Seul l'administrateur peut configurer l'embed.", ephemeral: true });
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
    await interaction.channel?.send({ embeds: [embed], components: [row] });
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
    } else {
      await message.reply("Veuillez envoyer une image avec la commande.");
      return;
    }
  }

  // Check if this channel is a ticket
  const state = ticketStates.get(message.channelId);
  if (!state) return; // Not a tracked ticket channel

  // AI Processing
  try {
      // Get all channels for the AI to analyze structure if needed
      const allChannels = message.guild?.channels.cache.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type
      })) || [];

      const messages = [
          { role: "system", content: `
            Tu es un bot modérateur Discord intelligent et assistant de recrutement. 
            Ton but est d'aider l'utilisateur, gérer des plaintes, des candidatures ou répondre à des questions sur le serveur.
            
            Contexte actuel:
            - Étape du ticket: ${state.step}
            - ID Propriétaire du serveur (Owner): ${message.guild?.ownerId}
            - Liste des salons du serveur: ${JSON.stringify(allChannels)}
            
            Règles de comportement:
            1. **CANDIDATURES** :
               - Si l'utilisateur exprime vouloir postuler ou demande un rôle :
                 - Envoie une fiche de recrutement complète avec des questions précises sur son expérience, ses motivations et ses disponibilités.
                 - Une fois que l'utilisateur a répondu, analyse les réponses.
                 - Si l'IA juge la candidature excellente : Indique que c'est parfait et mentionne explicitement que tu vas ping l'owner (<@${message.guild?.ownerId}>) pour validation finale.
                 - Si l'IA juge la candidature insuffisante : Explique poliment pourquoi "ce n'est pas bien" (manque de détails, réponses floues, etc.).
            
            2. **QUESTIONS SUR LE SERVEUR** :
               - Si l'utilisateur demande des raisons de Ban, de Mute ou le fonctionnement du serveur : Réponds de manière claire et informative.
            
            3. **AIDE SUR LES SALONS** :
               - Si l'utilisateur demande où faire quelque chose ou quel est un certain salon :
                 - Analyse la liste des salons fournie ci-dessus.
                 - Identifie le salon le plus approprié.
                 - Rédige la réponse en mentionnant le salon (ex: <#ID_DU_SALON>).
            
            4. **PLAINTES** :
               - Demande des preuves (vidéos, screens) et propose une sanction  (Ban, Kick, Mute).
            
            5. **SUPPRESSION** :
               - Si l'utilisateur demande de fermer/supprimer le ticket.
            
            Format de réponse JSON uniquement:
            {
              "reply": "Ta réponse textuelle ici",
              "action": "NONE" | "BAN" | "KICK" | "MUTE" | "DELETE_TICKET" | "PING_OWNER",
              "targetUser": "ID ou nom si applicable",
              "newStep": "nom_de_la_nouvelle_etape"
            }
          ` as const },
          { role: "user", content: `Message de l'utilisateur: "${message.content}". Attachments: ${message.attachments.size}. UserID: ${message.author.id}` as const }
      ];

      const completion = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: messages as any,
          response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
      
      if (result.reply) {
          await message.channel.send(result.reply);
      }

      if (result.newStep) {
          state.step = result.newStep;
          ticketStates.set(message.channelId, state);
      }

      // Handle actions
      if (result.action === "DELETE_TICKET") {
          await message.channel.send("Suppression du ticket dans 5 secondes...");
          setTimeout(() => message.channel.delete().catch(() => {}), 5000);
      }

      if (result.action === "PING_OWNER") {
          const ownerId = message.guild?.ownerId;
          if (ownerId) {
            await message.channel.send(`[SYSTEM] Candidature validée. Notification envoyée à l'Owner <@${ownerId}>.`);
          }
      }
      
      if (["BAN", "KICK", "MUTE"].includes(result.action)) {
          await message.channel.send(`[SYSTEM] Sanction appliquée: ${result.action} pour ${result.targetUser || "l'utilisateur concerné"}. (Simulation)`);
      }

  } catch (error) {
      console.error("AI Error:", error);
      await message.channel.send("Une erreur est survenue lors du traitement de votre demande.");
  }
});


export function startBot() {
    if (!process.env.DISCORD_TOKEN) {
        console.warn("DISCORD_TOKEN is missing. Bot will not start.");
        return;
    }
    client.login(process.env.DISCORD_TOKEN).catch(console.error);
}

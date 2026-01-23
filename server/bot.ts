import { Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits, EmbedBuilder, REST, Routes, ActivityType, TextChannel, ThreadChannel } from "discord.js";
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
  statusText: "GERE {server_count} serveurs",
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
  client.user.setActivity(text, { type: botConfig.statusType as any, url: "https://www.twitch.tv/discord" });
}

async function registerCommands() {
  const commands = [
    {
      name: "ticket",
      description: "Ouvrir un ticket",
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
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ticket") {
    // Create private thread/channel
    const guild = interaction.guild;
    if (!guild) return;

    try {
        // Create a private thread if possible, or a private channel
        // For simplicity in this MVP, let's create a private channel in a "Tickets" category if it exists, or just a channel
        // Best practice: Private Thread in a support channel.
        // But user asked for "fils privés visibles que pas la personne qui ouvre".
        // Let's assume we create a channel for now as threads require a parent channel.

        const channel = await guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                },
                {
                    id: client.user!.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                }
            ],
        });

        await interaction.reply({ content: `Ticket créé: ${channel.toString()}`, ephemeral: true });
        
        await channel.send(`Bonjour ${interaction.user.toString()}, quel est le but du ticket ?`);
        ticketStates.set(channel.id, { step: "init" });

    } catch (error) {
        console.error(error);
        await interaction.reply({ content: "Erreur lors de la création du ticket.", ephemeral: true });
    }
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

  // Check if this channel is a ticket
  const state = ticketStates.get(message.channelId);
  if (!state) return; // Not a tracked ticket channel

  // AI Processing
  try {
      const messages = [
          { role: "system", content: `
            Tu es un bot modérateur Discord intelligent. 
            Ton but est d'aider l'utilisateur ou de gérer des plaintes.
            
            Contexte actuel:
            Step: ${state.step}
            
            Règles:
            1. Si step="init", l'utilisateur vient de donner la raison du ticket. Analyse-la. 
               - Si c'est une plainte contre quelqu'un, demande des preuves (vidéo, screen).
               - Si c'est une question, réponds-y.
            2. Si c'est une plainte et que l'utilisateur envoie des preuves (liens ou attachments), analyse-les (simulé) et décide d'une sanction (Ban, Kick, Mute, Warn) ou Deban.
            3. Si l'utilisateur demande de supprimer le ticket, confirme et supprime.
            
            Format de réponse JSON uniquement:
            {
              "reply": "Ta réponse à l'utilisateur",
              "action": "NONE" | "BAN" | "KICK" | "MUTE" | "DELETE_TICKET",
              "targetUser": "username ou ID si sanction",
              "newStep": "next_step_name"
            }
          ` as const },
          { role: "user", content: `Message de l'utilisateur: "${message.content}". Attachments: ${message.attachments.size}` as const }
      ];

      const completion = await openai.chat.completions.create({
          model: "gpt-5.1", // Or use gpt-4o-mini
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
      
      // Real sanction logic would require parsing user mentions/IDs and having permissions
      // For MVP, we'll simulate the sanction message
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

import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const botUsername = process.env.BOT_USERNAME;  // Example: my_fact_bot

const bot = new TelegramBot(botToken, { polling: true });

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";

  // Ignore messages without text (stickers, images, etc.)
  if (!text) return;

  // Check if message mentions the bot
  const entities = msg.entities || [];
  const isMentioned = entities.some(
    (e) =>
      e.type === "mention" &&
      text.substring(e.offset, e.offset + e.length).toLowerCase() ===
        `@${botUsername.toLowerCase()}`
  );

  if (!isMentioned) return; // Not for bot → ignore

  console.log("Bot mentioned in group:", text);

  // Remove @botUsername from the message
  const cleanMessage = text.replace(new RegExp(`@${botUsername}`, "gi"), "").trim();

  try {
    const response:any = await axios.post(`${process.env.BACKEND_URL}/api/factCheck`, {
      userId: msg.from.id,
      groupId: chatId,
      message: cleanMessage
    });

    // Reply back to the group
    bot.sendMessage(chatId, response.data.reply, {
      reply_to_message_id: msg.message_id,
    });

  } catch (error) {
    console.error("Backend error:", error.message);
    bot.sendMessage(chatId, "❌ Error processing your request.");
  }
});

console.log("Telegram group bot running...");

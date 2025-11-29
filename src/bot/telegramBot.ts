import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN!;
const botUsername = process.env.BOT_USERNAME!.toLowerCase(); // example: "chainbreakbot"
const backendUrl = process.env.BACKEND_URL!;

export const bot = new TelegramBot(botToken, { polling: true });

console.log("🚀 Telegram bot is running...");

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  const chatType = msg.chat.type;

  // Ignore empty messages
  if (!text.trim()) return;

  // =====================================================================
  // 1️⃣ Detect chat_name for DM or Group
  // =====================================================================
  const chat_name =
    msg.chat.title ||                // Group name
    msg.chat.username ||             // DM username (@krishna)
    msg.chat.first_name ||           // DM first name
    "Unknown";

  // =====================================================================
  // 2️⃣ If private chat → always process
  // =====================================================================
  const isDM = chatType === "private";

  // =====================================================================
  // 3️⃣ If group → process ONLY when bot is mentioned
  // =====================================================================
  let isMentioned = false;

  if (!isDM) {
    const entities = msg.entities || [];
    isMentioned = entities.some(
      (e) =>
        e.type === "mention" &&
        text.substring(e.offset, e.offset + e.length).toLowerCase() ===
          `@${botUsername}`
    );

    if (!isMentioned) return; // ignore group messages not for bot
  }

  console.log(
    isDM
      ? `💬 DM message received: "${text}"`
      : `👥 Group mention received: "${text}"`
  );

  // =====================================================================
  // 4️⃣ Clean message (remove @botname only for groups)
  // =====================================================================
  const cleanMessage = isDM
    ? text.trim()
    : text.replace(new RegExp(`@${botUsername}`, "gi"), "").trim();

  try {
    // =====================================================================
    // 5️⃣ Send to Backend
    // =====================================================================
    const response = await axios.post(`${backendUrl}/api/factCheck`, {
      userId: msg.from.id,
      groupId: isDM ? null : chatId,
      message: cleanMessage,
      chat_name,
    });

    // =====================================================================
    // 6️⃣ Respond back
    // =====================================================================
    const replyText = response.data.reply || "No reply from server.";

    bot.sendMessage(chatId, replyText, {
      reply_to_message_id: msg.message_id,
    });

  } catch (error: any) {
    console.error("❌ Backend error:", error.message);
    bot.sendMessage(chatId, "⚠️ Error processing your request.");
  }
});

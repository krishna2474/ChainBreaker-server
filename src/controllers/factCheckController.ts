import { Request, Response } from "express";
import { db } from "../db/index";
import { eq, desc } from "drizzle-orm";
import { appChat, appRumour, appMessageLog } from "../drizzle/schema";
import aiAgent from "../lib/aiAgent";    // 👈 AI Agent here

export const factCheck = async (req: Request, res: Response) => {
  try {
    console.log("\n🔥 Incoming Fact Check Request ------------------------------");
    console.log("Req Body:", req.body);

    const { message, groupId, userId, chat_name } = req.body;

    if (!message) {
      console.log("❌ Missing message content");
      return res.status(400).json({ error: "Message is required" });
    }

    // Detect DM or Group
    const chat_id = groupId ?? userId;
    console.log("🆔 Computed chat_id =", chat_id);

    if (!chat_id) {
      return res.status(400).json({ error: "chat_id or groupId/userId is required" });
    }

    // ============================================================
    // 1️⃣ UPSERT CHAT
    // ============================================================

    console.log(`🔍 Checking chat existence for chat_id = ${chat_id} ...`);

    let chatRow = await db.query.appChat.findFirst({
      where: eq(appChat.chatId, String(chat_id)),
    });

    if (chatRow) {
      console.log("✔ Chat exists:", chatRow);

      chatRow = await db
        .update(appChat)
        .set({ chatName: chat_name })
        .where(eq(appChat.chatId, String(chat_id)))
        .returning()
        .then((r) => r[0]);

      console.log("🔄 Updated Chat Row:", chatRow);
    } else {
      console.log("➕ Chat does not exist, inserting new chat...");

      chatRow = await db
        .insert(appChat)
        .values({
          chatId: String(chat_id),
          chatName: chat_name ?? null,
        })
        .returning()
        .then((r) => r[0]);

      console.log("✨ New Chat Created:", chatRow);
    }

    // ============================================================
    // 2️⃣ CHECK EXISTING RUMOUR
    // ============================================================

    console.log("🔍 Searching for existing rumour in DB...");

    const existingRumour = await db.query.appRumour.findFirst({
      where: eq(appRumour.msgContent, message),
      with: {
        appRumourMatches: true,
      },
    });

    if (existingRumour) {
      console.log("⚠ Rumour already exists:", existingRumour.id);

      const lastMsg = await db.query.appMessageLog.findFirst({
        where: eq(appMessageLog.chatTableId, chatRow.id),
        orderBy: (ml) => desc(ml.createdAt),
      });

      console.log("📦 Previous AI response:", lastMsg?.aiResponse);

      return res.json({
        success: true,
        reused: true,
        reply: lastMsg?.aiResponse ?? "Found previous rumour but no stored reply.",
      });
    }

    // ============================================================
    // 3️⃣ RUN AI FACT CHECKING
    // ============================================================

    console.log("🤖 Calling AI Agent...");

    const verdict = await aiAgent.factCheckAgent(message);
    const ai_response = aiAgent.formatVerdict(verdict);

    console.log("🤖 AI Verdict:", verdict);
    console.log("📝 Formatted:", ai_response);

    // ============================================================
    // 4️⃣ STORE NEW RUMOUR
    // ============================================================

    console.log("📝 Storing new rumour in DB...");

    const newRumour = await db
      .insert(appRumour)
      .values({
        chatTableId: chatRow.id,
        msgContent: message,
        status: verdict.conclusion,
        factCheckResult: JSON.stringify(verdict),
        factCheckSource: verdict.sources?.[0]?.url ?? null,
        embedding: null,
      })
      .returning()
      .then((r) => r[0]);

    console.log("✨ New Rumour Inserted:", newRumour);

    // ============================================================
    // 5️⃣ STORE MESSAGE LOG
    // ============================================================

    console.log("📝 Storing AI response in messageLog...");

    await db.insert(appMessageLog).values({
      messageId: newRumour.id,
      chatTableId: chatRow.id,
      content: message,
      aiResponse: ai_response,
      processed: true,
    });

    console.log("📦 MessageLog entry created");
    console.log("✅ Returning AI response to client");

    return res.json({
      success: true,
      reused: false,
      reply: ai_response,
      rumourId: newRumour.id,
    });

  } catch (error) {
    console.error("❌ FactCheck Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

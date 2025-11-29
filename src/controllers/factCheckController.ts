// src/controllers/factCheckController.ts
import { Request, Response } from "express";
import { db } from "../db/index";
import { eq, desc } from "drizzle-orm";
import { appChat, appRumour, appMessageLog } from "../drizzle/schema";
import { factCheckAgent, formatVerdict, FactCheckVerdict } from "../lib/aiAgent";

export const factCheck = async (req: Request, res: Response) => {
  try {
    console.log("\n🔥 Incoming Fact Check Request ------------------------------");
    console.log("Req Body:", req.body);

    const { message, groupId, userId, chat_name } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const chat_id = groupId ?? userId;
    console.log("🆔 Computed chat_id =", chat_id);

    if (!chat_id) {
      return res.status(400).json({ error: "groupId or userId required" });
    }

    // 1️⃣ UPSERT CHAT
    let chatRow = await db.query.appChat.findFirst({
      where: eq(appChat.chatId, String(chat_id)),
    });

    if (chatRow) {
      console.log("✔ Existing chat found");
      chatRow = await db
        .update(appChat)
        .set({ chatName: chat_name || chatRow.chatName })
        .where(eq(appChat.chatId, String(chat_id)))
        .returning()
        .then((r) => r[0]);
    } else {
      console.log("➕ Creating new chat row...");
      chatRow = await db
        .insert(appChat)
        .values({
          chatId: String(chat_id),
          chatName: chat_name ?? null,
        })
        .returning()
        .then((r) => r[0]);
    }

    console.log("📌 Chat Row:", chatRow);

    // 2️⃣ CHECK EXISTING RUMOUR
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

      return res.json({
        success: true,
        reused: true,
        reply: lastMsg?.aiResponse ?? "⚠ Rumour seen earlier, but no saved reply.",
      });
    }

    // 3️⃣ RUN ENHANCED AI AGENT
    console.log("🤖 Running ENHANCED AI Agent...");
    const verdict: FactCheckVerdict = await factCheckAgent(message); 
    const ai_response = formatVerdict(verdict);

    console.log("🤖 AI Verdict:", verdict);

    // 4️⃣ INSERT RUMOUR
    const newRumour = await db
      .insert(appRumour)
      .values({
        chatTableId: chatRow.id,
        msgContent: message,
        status: verdict.verdict,
        factCheckResult: JSON.stringify(verdict),
        factCheckSource: verdict.sources?.[0]?.url ?? null,
        embedding: null,
      })
      .returning()
      .then((r) => r[0]);

    console.log("🆕 Rumour Created:", newRumour);

    // 5️⃣ LOG MESSAGE
    await db.insert(appMessageLog).values({
      messageId: newRumour.id,
      chatTableId: chatRow.id,
      content: message,
      aiResponse: ai_response,
      processed: true,
    });

    console.log("📦 MessageLog saved");

    // 6️⃣ RESPONSE
    return res.json({
      success: true,
      reused: false,
      reply: ai_response,
      rumourId: newRumour.id,
      toolCalls: verdict.toolCalls || 0,
    });

  } catch (err) {
    console.error("❌ FactCheck Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export default factCheck;

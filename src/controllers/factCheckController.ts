// src/controllers/factCheckController.ts

import { Request, Response } from "express";
import { db } from "../db/index";
import { eq, desc } from "drizzle-orm";
import {
  appChat,
  appRumour,
  appMessageLog,
  appRumourMatch,
} from "../drizzle/schema";
import {
  factCheckAgent,
  formatVerdict,
  FactCheckVerdict,
} from "../lib/aiAgent";
import axios from "axios";

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

    // ------------------------------------------------------
    // 1️⃣ UPSERT CHAT
    // ------------------------------------------------------
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

    const normalized = message.trim().toLowerCase();

    // ------------------------------------------------------
    // 2️⃣ CHECK IF RUMOUR MATCH ALREADY EXISTS
    // ------------------------------------------------------
    let matchRow: any = await db.query.appRumourMatch.findFirst({
      where: eq(appRumourMatch.normalized, normalized),
      with: { appRumour: true },
    });

    if (matchRow) {
      console.log("⚠ Rumour match FOUND:", matchRow.id);

      const updated = await db
        .update(appRumourMatch)
        .set({ count: (matchRow.count ?? 1) + 1 })
        .where(eq(appRumourMatch.id, matchRow.id))
        .returning()
        .then((r) => r[0]);

      console.log("🔁 Updated Match Count =", updated.count);

      // 🔥 2B: If count >= 3 → broadcast to all chats
      if (updated.count >= 3 && updated.broadcasted === false) {
        console.log("🚨 Threshold reached! Broadcasting rumour...");

        await db
          .update(appRumourMatch)
          .set({ broadcasted: true })
          .where(eq(appRumourMatch.id, updated.id));

        const allChats = await db.query.appChat.findMany();
        const broadcastText = `🚨 *Repeated Rumour Detected*\n\n"${matchRow.normalized}"\n\nThis rumour has been reported multiple times.`;

        for (const c of allChats) {
          try {
            await axios({
              method: "POST",
              url: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
              data: {
                chat_id: String(c.chatId),
                text: broadcastText,
                parse_mode: "Markdown",
              },
              timeout: 10000,
            });
          } catch (err: any) {
            console.error("❌ Broadcast send failed:", {
              chatId: c.chatId,
              error: err.response?.data || err.message,
            });
          }
        }
      }

      // ------------------------------------------------------
      // 🔥 2C: REUSE OR REGENERATE AI RESPONSE
      // ------------------------------------------------------
      const lastMsg = await db.query.appMessageLog.findFirst({
        where: eq(appMessageLog.chatTableId, chatRow.id),
        orderBy: (ml) => desc(ml.createdAt),
      });

      // If no previous response → regenerate with AI
      if (!lastMsg?.aiResponse) {
        console.log("⚠ No previous AI reply found. Re-running factCheckAgent...");

        const verdict: FactCheckVerdict = await factCheckAgent(message);
        const fresh_ai_response = formatVerdict(verdict);

        await db.insert(appMessageLog).values({
          messageId: matchRow.rumourId,
          chatTableId: chatRow.id,
          content: message,
          aiResponse: fresh_ai_response,
          processed: true,
        });

        return res.json({
          success: true,
          reused: false,
          regenerated: true,
          reply: fresh_ai_response,
          toolCalls: verdict.toolCalls || 0,
        });
      }

      // Otherwise reuse old one
      return res.json({
        success: true,
        reused: true,
        reply: lastMsg.aiResponse,
      });
    }

    // ------------------------------------------------------
    // 3️⃣ NEW RUMOUR_MATCH ENTRY
    // ------------------------------------------------------
    console.log("➕ Creating new rumour_match...");
    const newMatch = await db
      .insert(appRumourMatch)
      .values({
        normalized,
        similarity: 100,
        rumourId: null,
      })
      .returning()
      .then((r) => r[0]);

    console.log("📌 New RumourMatch:", newMatch.id);

    // ------------------------------------------------------
    // 4️⃣ RUN AI AGENT
    // ------------------------------------------------------
    console.log("🤖 Running ENHANCED AI Agent...");
    const verdict: FactCheckVerdict = await factCheckAgent(message);
    const ai_response = formatVerdict(verdict);

    console.log("🤖 AI Verdict:", verdict);

    // ------------------------------------------------------
    // 5️⃣ INSERT NEW RUMOUR
    // ------------------------------------------------------
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

    console.log("🆕 Rumour Created:", newRumour.id);

    // link rumourMatch → rumour
    await db
      .update(appRumourMatch)
      .set({ rumourId: newRumour.id })
      .where(eq(appRumourMatch.normalized, normalized));

    // ------------------------------------------------------
    // 6️⃣ LOG MESSAGE
    // ------------------------------------------------------
    await db.insert(appMessageLog).values({
      messageId: newRumour.id,
      chatTableId: chatRow.id,
      content: message,
      aiResponse: ai_response,
      processed: true,
    });

    console.log("📦 MessageLog saved");

    // ------------------------------------------------------
    // 7️⃣ RESPONSE
    // ------------------------------------------------------
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

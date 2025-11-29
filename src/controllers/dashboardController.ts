import { db } from "../db/index";

export const dashboardController = async (req, res) => {
  try {
    // Example: Fetch some dashboard data from the database
    // i want to fetch all data from all tables and send
    const chats = await db.query.appChat.findMany();
    const rumours = await db.query.appRumour.findMany()
    const messageLogs = await db.query.appMessageLog.findMany();

    res.json({
      chats,
      rumours,
      messageLogs
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};  
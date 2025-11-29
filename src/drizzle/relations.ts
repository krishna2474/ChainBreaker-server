import { relations } from "drizzle-orm/relations";
import { appRumour, appRumourMatch, appChat, appMessageLog } from "./schema";

export const appRumourMatchRelations = relations(appRumourMatch, ({one}) => ({
	appRumour: one(appRumour, {
		fields: [appRumourMatch.rumourId],
		references: [appRumour.id]
	}),
}));

export const appRumourRelations = relations(appRumour, ({one, many}) => ({
	appRumourMatches: many(appRumourMatch),
	appChat: one(appChat, {
		fields: [appRumour.chatTableId],
		references: [appChat.id]
	}),
}));

export const appMessageLogRelations = relations(appMessageLog, ({one}) => ({
	appChat: one(appChat, {
		fields: [appMessageLog.chatTableId],
		references: [appChat.id]
	}),
}));

export const appChatRelations = relations(appChat, ({many}) => ({
	appMessageLogs: many(appMessageLog),
	appRumours: many(appRumour),
}));
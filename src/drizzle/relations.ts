import { relations } from "drizzle-orm/relations";
import { appChat, appMessageLog, appRumour, appRumourMatch } from "./schema";

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

export const appRumourRelations = relations(appRumour, ({one, many}) => ({
	appChat: one(appChat, {
		fields: [appRumour.chatTableId],
		references: [appChat.id]
	}),
	appRumourMatches: many(appRumourMatch),
}));

export const appRumourMatchRelations = relations(appRumourMatch, ({one}) => ({
	appRumour: one(appRumour, {
		fields: [appRumourMatch.rumourId],
		references: [appRumour.id]
	}),
}));
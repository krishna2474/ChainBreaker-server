import { relations } from "drizzle-orm/relations";
import { ssoProvidersInAuth, ssoDomainsInAuth, samlProvidersInAuth, usersInAuth, userProfile, mfaFactorsInAuth, sessionsInAuth, refreshTokensInAuth, profiles, flowStateInAuth, samlRelayStatesInAuth, mfaAmrClaimsInAuth, identitiesInAuth, oneTimeTokensInAuth, mfaChallengesInAuth, oauthClientsInAuth, oauthConsentsInAuth, oauthAuthorizationsInAuth, chat, rumour, rumourMatch, messageLog } from "./schema";

export const ssoDomainsInAuthRelations = relations(ssoDomainsInAuth, ({one}) => ({
	ssoProvidersInAuth: one(ssoProvidersInAuth, {
		fields: [ssoDomainsInAuth.ssoProviderId],
		references: [ssoProvidersInAuth.id]
	}),
}));

export const ssoProvidersInAuthRelations = relations(ssoProvidersInAuth, ({many}) => ({
	ssoDomainsInAuths: many(ssoDomainsInAuth),
	samlProvidersInAuths: many(samlProvidersInAuth),
	samlRelayStatesInAuths: many(samlRelayStatesInAuth),
}));

export const samlProvidersInAuthRelations = relations(samlProvidersInAuth, ({one}) => ({
	ssoProvidersInAuth: one(ssoProvidersInAuth, {
		fields: [samlProvidersInAuth.ssoProviderId],
		references: [ssoProvidersInAuth.id]
	}),
}));

export const userProfileRelations = relations(userProfile, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [userProfile.id],
		references: [usersInAuth.id]
	}),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	userProfiles: many(userProfile),
	mfaFactorsInAuths: many(mfaFactorsInAuth),
	profiles: many(profiles),
	identitiesInAuths: many(identitiesInAuth),
	oneTimeTokensInAuths: many(oneTimeTokensInAuth),
	sessionsInAuths: many(sessionsInAuth),
	oauthConsentsInAuths: many(oauthConsentsInAuth),
	oauthAuthorizationsInAuths: many(oauthAuthorizationsInAuth),
}));

export const mfaFactorsInAuthRelations = relations(mfaFactorsInAuth, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [mfaFactorsInAuth.userId],
		references: [usersInAuth.id]
	}),
	mfaChallengesInAuths: many(mfaChallengesInAuth),
}));

export const refreshTokensInAuthRelations = relations(refreshTokensInAuth, ({one}) => ({
	sessionsInAuth: one(sessionsInAuth, {
		fields: [refreshTokensInAuth.sessionId],
		references: [sessionsInAuth.id]
	}),
}));

export const sessionsInAuthRelations = relations(sessionsInAuth, ({one, many}) => ({
	refreshTokensInAuths: many(refreshTokensInAuth),
	mfaAmrClaimsInAuths: many(mfaAmrClaimsInAuth),
	oauthClientsInAuth: one(oauthClientsInAuth, {
		fields: [sessionsInAuth.oauthClientId],
		references: [oauthClientsInAuth.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [sessionsInAuth.userId],
		references: [usersInAuth.id]
	}),
}));

export const profilesRelations = relations(profiles, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
}));

export const samlRelayStatesInAuthRelations = relations(samlRelayStatesInAuth, ({one}) => ({
	flowStateInAuth: one(flowStateInAuth, {
		fields: [samlRelayStatesInAuth.flowStateId],
		references: [flowStateInAuth.id]
	}),
	ssoProvidersInAuth: one(ssoProvidersInAuth, {
		fields: [samlRelayStatesInAuth.ssoProviderId],
		references: [ssoProvidersInAuth.id]
	}),
}));

export const flowStateInAuthRelations = relations(flowStateInAuth, ({many}) => ({
	samlRelayStatesInAuths: many(samlRelayStatesInAuth),
}));

export const mfaAmrClaimsInAuthRelations = relations(mfaAmrClaimsInAuth, ({one}) => ({
	sessionsInAuth: one(sessionsInAuth, {
		fields: [mfaAmrClaimsInAuth.sessionId],
		references: [sessionsInAuth.id]
	}),
}));

export const identitiesInAuthRelations = relations(identitiesInAuth, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [identitiesInAuth.userId],
		references: [usersInAuth.id]
	}),
}));

export const oneTimeTokensInAuthRelations = relations(oneTimeTokensInAuth, ({one}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [oneTimeTokensInAuth.userId],
		references: [usersInAuth.id]
	}),
}));

export const mfaChallengesInAuthRelations = relations(mfaChallengesInAuth, ({one}) => ({
	mfaFactorsInAuth: one(mfaFactorsInAuth, {
		fields: [mfaChallengesInAuth.factorId],
		references: [mfaFactorsInAuth.id]
	}),
}));

export const oauthClientsInAuthRelations = relations(oauthClientsInAuth, ({many}) => ({
	sessionsInAuths: many(sessionsInAuth),
	oauthConsentsInAuths: many(oauthConsentsInAuth),
	oauthAuthorizationsInAuths: many(oauthAuthorizationsInAuth),
}));

export const oauthConsentsInAuthRelations = relations(oauthConsentsInAuth, ({one}) => ({
	oauthClientsInAuth: one(oauthClientsInAuth, {
		fields: [oauthConsentsInAuth.clientId],
		references: [oauthClientsInAuth.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [oauthConsentsInAuth.userId],
		references: [usersInAuth.id]
	}),
}));

export const oauthAuthorizationsInAuthRelations = relations(oauthAuthorizationsInAuth, ({one}) => ({
	oauthClientsInAuth: one(oauthClientsInAuth, {
		fields: [oauthAuthorizationsInAuth.clientId],
		references: [oauthClientsInAuth.id]
	}),
	usersInAuth: one(usersInAuth, {
		fields: [oauthAuthorizationsInAuth.userId],
		references: [usersInAuth.id]
	}),
}));

export const rumourRelations = relations(rumour, ({one, many}) => ({
	chat: one(chat, {
		fields: [rumour.chatTableId],
		references: [chat.id]
	}),
	rumourMatches: many(rumourMatch),
}));

export const chatRelations = relations(chat, ({many}) => ({
	rumours: many(rumour),
	messageLogs: many(messageLog),
}));

export const rumourMatchRelations = relations(rumourMatch, ({one}) => ({
	rumour: one(rumour, {
		fields: [rumourMatch.rumourid],
		references: [rumour.id]
	}),
}));

export const messageLogRelations = relations(messageLog, ({one}) => ({
	chat: one(chat, {
		fields: [messageLog.chatTableId],
		references: [chat.id]
	}),
}));
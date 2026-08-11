import { pgTable, serial, timestamp, index, unique, pgPolicy, uuid, varchar, integer, text, jsonb, foreignKey, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const decisionMakers = pgTable("decision_makers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 32 }).notNull(),
	name: varchar({ length: 64 }).notNull(),
	title: varchar({ length: 128 }).notNull(),
	faction: varchar({ length: 32 }).notNull(),
	factionLabel: varchar("faction_label", { length: 32 }).notNull(),
	weight: integer().default(10).notNull(),
	floor: integer().default(1).notNull(),
	room: varchar({ length: 32 }).notNull(),
	avatar: varchar({ length: 8 }).default('👤').notNull(),
	coreNeeds: text("core_needs").notNull(),
	painPoints: text("pain_points").notNull(),
	personalPreferences: text("personal_preferences").notNull(),
	bonusKeywords: jsonb("bonus_keywords").default([]).notNull(),
	tabooPhrases: jsonb("taboo_phrases").default([]).notNull(),
	difficultyMin: integer("difficulty_min").default(1).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("decision_makers_difficulty_idx").using("btree", table.difficultyMin.asc().nullsLast().op("int4_ops")),
	index("decision_makers_faction_idx").using("btree", table.faction.asc().nullsLast().op("text_ops")),
	unique("decision_makers_code_unique").on(table.code),
	pgPolicy("decision_makers_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
]);

export const gameSessions = pgTable("game_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: varchar("user_id", { length: 64 }).default('guest').notNull(),
	userName: varchar("user_name", { length: 64 }).default('销售新兵').notNull(),
	scenarioId: uuid("scenario_id").notNull(),
	productId: uuid("product_id"),
	difficulty: integer().default(1).notNull(),
	mode: varchar({ length: 32 }).default('ai_dialog').notNull(),
	multiplayer: boolean().default(false).notNull(),
	currentRound: integer("current_round").default(1).notNull(),
	maxRound: integer("max_round").default(10).notNull(),
	totalScore: integer("total_score").default(50).notNull(),
	winProbability: integer("win_probability").default(50).notNull(),
	status: varchar({ length: 32 }).default('playing').notNull(),
	won: boolean(),
	finalReport: jsonb("final_report"),
	personalityType: varchar("personality_type", { length: 64 }),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("game_sessions_created_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("game_sessions_scenario_idx").using("btree", table.scenarioId.asc().nullsLast().op("uuid_ops")),
	index("game_sessions_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("game_sessions_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.scenarioId],
			foreignColumns: [projectScenarios.id],
			name: "game_sessions_scenario_id_project_scenarios_id_fk"
		}).onDelete("cascade"),
	pgPolicy("game_sessions_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
]);

export const projectScenarios = pgTable("project_scenarios", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 32 }).notNull(),
	title: varchar({ length: 128 }).notNull(),
	industry: varchar({ length: 64 }).notNull(),
	projectType: varchar("project_type", { length: 64 }).notNull(),
	budgetWan: integer("budget_wan").notNull(),
	durationMonths: integer("duration_months").default(6).notNull(),
	technicalRisk: varchar("technical_risk", { length: 32 }).notNull(),
	competitorName: varchar("competitor_name", { length: 64 }).notNull(),
	competitorAdvantages: text("competitor_advantages").notNull(),
	decisionMakerIds: jsonb("decision_maker_ids").default([]).notNull(),
	difficulty: integer().default(1).notNull(),
	description: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("project_scenarios_difficulty_idx").using("btree", table.difficulty.asc().nullsLast().op("int4_ops")),
	index("project_scenarios_industry_idx").using("btree", table.industry.asc().nullsLast().op("text_ops")),
	unique("project_scenarios_code_unique").on(table.code),
	pgPolicy("project_scenarios_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
]);

export const affinityScores = pgTable("affinity_scores", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	decisionMakerId: uuid("decision_maker_id").notNull(),
	playerAffinity: integer("player_affinity").default(50).notNull(),
	competitorAffinity: integer("competitor_affinity").default(50).notNull(),
	lastChangeReason: text("last_change_reason"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("affinity_dm_idx").using("btree", table.decisionMakerId.asc().nullsLast().op("uuid_ops")),
	index("affinity_session_idx").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [gameSessions.id],
			name: "affinity_scores_session_id_game_sessions_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.decisionMakerId],
			foreignColumns: [decisionMakers.id],
			name: "affinity_scores_decision_maker_id_decision_makers_id_fk"
		}).onDelete("cascade"),
	pgPolicy("affinity_scores_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
]);

export const productKnowledge = pgTable("product_knowledge", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	ownerId: varchar("owner_id", { length: 64 }).default('guest').notNull(),
	productName: varchar("product_name", { length: 128 }).notNull(),
	category: varchar({ length: 64 }).default('通用').notNull(),
	technicalParams: jsonb("technical_params").default({}).notNull(),
	prohibitedDescriptions: jsonb("prohibited_descriptions").default([]).notNull(),
	keySellingPoints: jsonb("key_selling_points").default([]).notNull(),
	targetIndustries: jsonb("target_industries").default([]).notNull(),
	source: varchar({ length: 32 }).default('manual').notNull(),
	fileUrl: text("file_url"),
	rawContent: text("raw_content"),
	summary: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("product_knowledge_category_idx").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("product_knowledge_owner_idx").using("btree", table.ownerId.asc().nullsLast().op("text_ops")),
	pgPolicy("product_knowledge_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
]);

export const chatMessages = pgTable("chat_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	decisionMakerId: uuid("decision_maker_id"),
	round: integer().default(1).notNull(),
	sender: varchar({ length: 16 }).notNull(),
	content: text().notNull(),
	actionType: varchar("action_type", { length: 32 }),
	affinityDelta: integer("affinity_delta"),
	scoreDelta: integer("score_delta"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("chat_dm_idx").using("btree", table.decisionMakerId.asc().nullsLast().op("uuid_ops")),
	index("chat_round_idx").using("btree", table.round.asc().nullsLast().op("int4_ops")),
	index("chat_session_idx").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [gameSessions.id],
			name: "chat_messages_session_id_game_sessions_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.decisionMakerId],
			foreignColumns: [decisionMakers.id],
			name: "chat_messages_decision_maker_id_decision_makers_id_fk"
		}).onDelete("set null"),
	pgPolicy("chat_messages_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
]);

export const gameRuntimeStates = pgTable("game_runtime_states", {
	sessionId: uuid("session_id").primaryKey().notNull(),
	scenarioCode: varchar("scenario_code", { length: 32 }).notNull(),
	actionPoints: integer("action_points").default(28).notNull(),
	dimensions: jsonb().default({}).notNull(),
	npcAffinity: jsonb("npc_affinity").default({}).notNull(),
	unlockedNpcIds: jsonb("unlocked_npc_ids").default([]).notNull(),
	unlockedClues: jsonb("unlocked_clues").default([]).notNull(),
	conversationMemories: jsonb("conversation_memories").default({}).notNull(),
	lastAction: varchar("last_action", { length: 64 }),
	version: integer().default(1).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
		columns: [table.sessionId],
		foreignColumns: [gameSessions.id],
		name: "game_runtime_states_session_id_game_sessions_id_fk"
	}).onDelete("cascade"),
]);

export const gameEvents = pgTable("game_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	npcKey: varchar("npc_key", { length: 128 }),
	round: integer().notNull(),
	eventType: varchar("event_type", { length: 64 }).notNull(),
	payload: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("game_events_session_idx").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	index("game_events_npc_idx").using("btree", table.npcKey.asc().nullsLast().op("text_ops")),
	foreignKey({
		columns: [table.sessionId],
		foreignColumns: [gameSessions.id],
		name: "game_events_session_id_game_sessions_id_fk"
	}).onDelete("cascade"),
]);

export const playerAbility = pgTable("player_ability", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: varchar("user_id", { length: 64 }).notNull(),
	sessionsPlayed: integer("sessions_played").default(0).notNull(),
	sessionsWon: integer("sessions_won").default(0).notNull(),
	winRate: integer("win_rate").default(0).notNull(),
	avgTotalScore: integer("avg_total_score").default(0).notNull(),
	bestScore: integer("best_score").default(0).notNull(),
	abilityPersonality: integer("ability_personality").default(0).notNull(),
	abilityResearch: integer("ability_research").default(0).notNull(),
	abilityLayered: integer("ability_layered").default(0).notNull(),
	abilityPitch: integer("ability_pitch").default(0).notNull(),
	abilityCompetitor: integer("ability_competitor").default(0).notNull(),
	abilityBidding: integer("ability_bidding").default(0).notNull(),
	abilityProduct: integer("ability_product").default(0).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("player_ability_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("player_ability_user_id_unique").on(table.userId),
	pgPolicy("player_ability_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true`  }),
]);

// =====================================================
// 多身份权限系统 6 张表
// =====================================================

// 1) 行业分类表
export const industries = pgTable("industries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 32 }).notNull(),
	name: varchar({ length: 64 }).notNull(),
	icon: varchar({ length: 8 }).default('🏛️').notNull(),
	description: text(),
	subCategories: jsonb("sub_categories").default([]).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	unique("industries_code_unique").on(table.code),
	pgPolicy("industries_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true` }),
]);

// 2) 产品分类表
export const productCategories = pgTable("product_categories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 32 }).notNull(),
	name: varchar({ length: 64 }).notNull(),
	parentCode: varchar("parent_code", { length: 32 }),
	icon: varchar({ length: 8 }).default('📦').notNull(),
	description: text(),
	typicalScenarios: jsonb("typical_scenarios").default([]).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
}, (table) => [
	unique("product_categories_code_unique").on(table.code),
	index("product_categories_parent_idx").using("btree", table.parentCode.asc().nullsLast().op("text_ops")),
	pgPolicy("product_categories_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true` }),
]);

// 3) 标准场景案例表
export const scenarioTemplates = pgTable("scenario_templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 64 }).notNull(),
	title: varchar({ length: 128 }).notNull(),
	industryCode: varchar("industry_code", { length: 32 }).notNull(),
	productCategoryCode: varchar("product_category_code", { length: 32 }).notNull(),
	budgetWan: integer("budget_wan").notNull(),
	durationMonths: integer("duration_months").default(12).notNull(),
	technicalDifficulties: jsonb("technical_difficulties").default([]).notNull(),
	clientDemands: jsonb("client_demands").default([]).notNull(),
	decisionMakerProfile: jsonb("decision_maker_profile").notNull(),
	competitors: jsonb().default([]).notNull(),
	tags: jsonb().default([]).notNull(),
	difficulty: integer().default(3).notNull(),
	description: text(),
	isPreset: boolean("is_preset").default(true).notNull(),
	createdBy: varchar("created_by", { length: 64 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("scenario_templates_code_unique").on(table.code),
	index("scenario_templates_industry_idx").using("btree", table.industryCode.asc().nullsLast().op("text_ops")),
	pgPolicy("scenario_templates_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true` }),
]);

// 4) 企业信息表
export const enterprises = pgTable("enterprises", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 64 }).notNull(),
	name: varchar({ length: 128 }).notNull(),
	shortName: varchar("short_name", { length: 64 }),
	industryCode: varchar("industry_code", { length: 32 }),
	scale: varchar({ length: 32 }),
	region: varchar({ length: 64 }),
	contactName: varchar("contact_name", { length: 64 }),
	contactPhone: varchar("contact_phone", { length: 32 }),
	adminUserId: varchar("admin_user_id", { length: 64 }),
	productScopes: jsonb("product_scopes").default([]).notNull(),
	licenseCount: integer("license_count").default(0).notNull(),
	expireAt: timestamp("expire_at", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("enterprises_code_unique").on(table.code),
	index("enterprises_admin_idx").using("btree", table.adminUserId.asc().nullsLast().op("text_ops")),
	pgPolicy("enterprises_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true` }),
]);

// 5) 邀请码记录表
export const inviteCodes = pgTable("invite_codes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 32 }).notNull(),
	enterpriseId: uuid("enterprise_id"),
	createdBy: varchar("created_by", { length: 64 }).notNull(),
	role: varchar({ length: 32 }).default('enterprise_employee').notNull(),
	maxUses: integer("max_uses").default(1).notNull(),
	usedCount: integer("used_count").default(0).notNull(),
	expireAt: timestamp("expire_at", { withTimezone: true, mode: 'string' }).notNull(),
	usedBy: jsonb("used_by").default([]).notNull(),
	productScopes: jsonb("product_scopes").default([]).notNull(),
	note: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("invite_codes_code_unique").on(table.code),
	index("invite_codes_enterprise_idx").using("btree", table.enterpriseId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
		columns: [table.enterpriseId],
		foreignColumns: [enterprises.id],
		name: "invite_codes_enterprise_id_enterprises_id_fk"
	}).onDelete("cascade"),
	pgPolicy("invite_codes_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true` }),
]);

// 6) 用户身份表
export const userIdentities = pgTable("user_identities", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: varchar("user_id", { length: 64 }).notNull(),
	phone: varchar({ length: 32 }),
	email: varchar({ length: 128 }),
	displayName: varchar("display_name", { length: 64 }).notNull(),
	avatar: varchar({ length: 8 }).default('👤').notNull(),
	role: varchar({ length: 32 }).notNull(),
	subRole: varchar("sub_role", { length: 32 }),
	enterpriseId: uuid("enterprise_id"),
	inviteCode: varchar("invite_code", { length: 32 }),
	level: integer().default(1).notNull(),
	totalPoints: integer("total_points").default(0).notNull(),
	permissions: jsonb().default([]).notNull(),
	status: varchar({ length: 32 }).default('active').notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_identities_phone_idx").using("btree", table.phone.asc().nullsLast().op("text_ops")),
	index("user_identities_role_idx").using("btree", table.role.asc().nullsLast().op("text_ops")),
	index("user_identities_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("user_identities_user_id_unique").on(table.userId),
	foreignKey({
		columns: [table.enterpriseId],
		foreignColumns: [enterprises.id],
		name: "user_identities_enterprise_id_enterprises_id_fk"
	}).onDelete("set null"),
	pgPolicy("user_identities_allow_all", { as: "permissive", for: "all", to: ["public"], using: sql`true`, withCheck: sql`true` }),
]);

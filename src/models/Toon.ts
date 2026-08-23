import { index, integer, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { decks } from './Deck';
import { artStyleEnum, ratioEnum, toonFormulaSourceEnum } from './Enums';
import { cardnews } from './Namespace';
import { organizations, users } from './Org';

/**
 * 인스타툰 생성에 필요한 세 가지 저장물.
 *
 * 캐릭터·공식·스토리보드를 나눠 두는 이유는 셋의 수명이 다르기 때문이다.
 * 캐릭터는 계정 하나에 하나뿐이고 몇 달을 산다. 공식은 몇 개를 두고 갈아 쓴다.
 * 스토리보드는 덱 하나짜리 일회용이다. 한 테이블에 넣으면 캐릭터를 고칠 때마다
 * 지난 스토리보드가 함께 흔들린다.
 */

/** 컷마다 흔들리면 안 되는 것들. `lib/toon/character.ts`의 스키마와 같은 모양이다. */
export type ToonAppearance = {
  ageRange: string;
  hair: string;
  outfit: string;
  face: string;
  distinctive: string[];
};

/**
 * 주인공.
 *
 * `anchorPrompt`를 **저장한다**는 점이 이 테이블의 핵심이다. 생김새 항목에서
 * 매번 다시 조립하면 항목 하나를 고쳤을 때 과거 덱까지 다른 인물이 되고,
 * 그게 언제 바뀌었는지 아무도 모른다. 저장해 두면 "캐릭터를 고쳤다"가
 * 명시적인 행동이 된다.
 */
export const toonCharacters = cardnews.table(
  'toon_characters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    appearance: jsonb('appearance').$type<ToonAppearance>().notNull(),
    artStyle: artStyleEnum('art_style').notNull().default('soft-webtoon'),
    /** 매 컷 프롬프트 맨 앞에 글자 그대로 붙는 영문 문장. */
    anchorPrompt: text('anchor_prompt').notNull(),
    /**
     * 이 캐릭터의 모든 컷이 공유하는 시드.
     *
     * 무작위가 아니라 이름에서 유도한다. 무작위로 뽑으면 같은 캐릭터를 다시
     * 만들 방법이 없고, "그때 그 그림"으로 돌아갈 수 없다.
     */
    seed: integer('seed').notNull(),
    /**
     * 캐릭터 시트 이미지의 스토리지 경로. 있으면 image-to-image로 매 컷에
     * 함께 넣는다 — 일관성 장치 셋 중 가장 강한 것이다.
     */
    referencePath: text('reference_path'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('toon_characters_org_idx').on(t.orgId, t.createdAt)],
);

/** 한 박자. 레퍼런스에서 가져오는 것은 이 배열뿐이다 — 대사도 소재도 아니다. */
export type ToonStoryBeat = {
  sceneType: string;
  purpose: string;
  tension: number;
};

/**
 * 전개 공식.
 *
 * `design_learnings`가 참고 이미지에 대해 하는 일을 이야기 구조에 대해 한다.
 * `rightsConfirmedAt`을 같은 이유로 들고 있다: 남의 콘텐츠를 분석에 넣었다는
 * 사실과, 그래도 된다고 누군가 확인했다는 사실이 함께 남아야 한다.
 */
export const toonFormulas = cardnews.table(
  'toon_formulas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    source: toonFormulaSourceEnum('source').notNull().default('learned'),
    beats: jsonb('beats').$type<ToonStoryBeat[]>().notNull(),
    /** 문장이 아니라 골격. 40자 상한이 저작권 가드레일이다. */
    hookPatterns: jsonb('hook_patterns').$type<string[]>().notNull().default([]),
    toneTags: jsonb('tone_tags').$type<string[]>().notNull().default([]),
    pacing: text('pacing').notNull().default('steady'),
    summary: text('summary').notNull(),
    /**
     * 분석에 넣은 레퍼런스 장수. 이미지 자체는 보관하지 않는다 — 구조를 읽어
     * 내려고 잠깐 들고 있었을 뿐이고, 남겨 둘 이유가 없다.
     */
    referenceCount: integer('reference_count').notNull().default(0),
    /** 레퍼런스를 분석에 써도 된다고 확인한 시각. */
    rightsConfirmedAt: timestamp('rights_confirmed_at', { withTimezone: true }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('toon_formulas_org_idx').on(t.orgId, t.createdAt)],
);

/** 한 컷. `lib/toon/schema.ts`의 `ToonCut`과 같은 모양이다. */
export type ToonStoryboardCut = {
  cutNumber: number;
  sceneType: string;
  imagePrompt: string;
  characterEmotion: string;
  narration: string | null;
  dialogue: { speaker: string; text: string; anchor: string; tone: string }[];
  visualFocus: string | null;
};

/**
 * 만들어진 스토리보드.
 *
 * 덱과 따로 두는 이유: 패널은 *렌더된 결과*를 들고 있고 스토리보드는 *그리라고
 * 시킨 내용*을 들고 있다. 컷 하나를 다시 그릴 때 필요한 것은 후자이고,
 * 패널에서 역으로 복원할 수 없다.
 */
export const toonStoryboards = cardnews.table(
  'toon_storyboards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** 이 스토리보드로 만들어진 덱. 생성 전이거나 실패하면 null. */
    deckId: uuid('deck_id').references(() => decks.id, { onDelete: 'set null' }),
    characterId: uuid('character_id')
      .notNull()
      .references(() => toonCharacters.id, { onDelete: 'cascade' }),
    /** 공식 없이 만들 수도 있다. 그때는 기본 박자 흐름을 쓴다. */
    formulaId: uuid('formula_id').references(() => toonFormulas.id, { onDelete: 'set null' }),
    topic: text('topic').notNull(),
    ratio: ratioEnum('ratio').notNull(),
    hook: text('hook').notNull(),
    logline: text('logline').notNull(),
    cuts: jsonb('cuts').$type<ToonStoryboardCut[]>().notNull(),
    caption: text('caption').notNull().default(''),
    hashtags: jsonb('hashtags').$type<string[]>().notNull().default([]),
    /**
     * 일관성·조판 경고. 실패가 아니라 사람이 봐야 할 것들이다 —
     * 장면 프롬프트가 인물 외모를 다시 지정하려 했다든가, 대사가 넘쳤다든가.
     */
    warnings: jsonb('warnings').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('toon_storyboards_org_idx').on(t.orgId, t.createdAt),
    index('toon_storyboards_deck_idx').on(t.deckId),
  ],
);

export type ToonCharacter = typeof toonCharacters.$inferSelect;
export type NewToonCharacter = typeof toonCharacters.$inferInsert;
export type ToonFormula = typeof toonFormulas.$inferSelect;
export type NewToonFormula = typeof toonFormulas.$inferInsert;
export type ToonStoryboard = typeof toonStoryboards.$inferSelect;
export type NewToonStoryboard = typeof toonStoryboards.$inferInsert;
export type ArtStyle = (typeof artStyleEnum.enumValues)[number];

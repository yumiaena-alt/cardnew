import * as z from 'zod';
import { channelEnum, ratioEnum } from '@/models/Enums';

/**
 * Zod schemas for saving the board sheet.
 *
 * The sheet is free text by design — a user pastes a month of rows from
 * anywhere — so the boundary tolerates loose values rather than rejecting them.
 * What it will not tolerate is unbounded size or unknown channels, since both
 * reach the database.
 */

/** A month of rows is the working set the Board is designed around. */
const MAX_SHEET_ROWS = 200;

const sheetRowSchema = z.object({
  topic: z.string().max(500),
  channels: z.array(z.enum(channelEnum.enumValues)).max(channelEnum.enumValues.length),
  scheduledAt: z.string().max(40),
  notes: z.string().max(2000),
});

export const saveBoardSchema = z.object({
  boardId: z.uuid(),
  rows: z.array(sheetRowSchema).max(MAX_SHEET_ROWS),
  /**
   * Ratio each channel renders at, so the sheet decides its own fan-out shape.
   * Partial on purpose: the sheet offers a subset of the channels the schema
   * knows about, and requiring every one would break the moment a channel is
   * added to the database before it is added to the grid.
   */
  channelRatios: z.partialRecord(z.enum(channelEnum.enumValues), z.enum(ratioEnum.enumValues)),
});

export type SheetRowInput = z.infer<typeof sheetRowSchema>;
export type SaveBoardInput = z.infer<typeof saveBoardSchema>;

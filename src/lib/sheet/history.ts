/**
 * Undo/redo stack for the Board sheet.
 *
 * Stores whole snapshots rather than diffs. Board rows are small (tens of rows,
 * not thousands), so snapshots stay cheap and every operation — paste, fill,
 * multi-cell edit — becomes undoable without per-operation inverse logic.
 */

/** Matches the `⌘Z` depth promised in the PRD. */
const DEFAULT_HISTORY_LIMIT = 20;

export type History<T> = {
  present: T;
  past: readonly T[];
  future: readonly T[];
  limit: number;
};

/**
 * Creates an empty history around an initial state.
 *
 * @param present - Starting state.
 * @param limit - Maximum undo depth.
 * @returns A history with no past or future.
 */
export function createHistory<T>(present: T, limit = DEFAULT_HISTORY_LIMIT): History<T> {
  return { present, past: [], future: [], limit };
}

/**
 * Records a new state, dropping the oldest entry once the limit is reached.
 *
 * Pushing clears the redo stack: once the user edits after undoing, the
 * abandoned branch is gone, which is what spreadsheet users expect.
 *
 * @param history - Current history.
 * @param next - State to become the present.
 * @returns Updated history.
 */
export function push<T>(history: History<T>, next: T): History<T> {
  const past = [...history.past, history.present];

  return {
    ...history,
    present: next,
    past: past.length > history.limit ? past.slice(past.length - history.limit) : past,
    future: [],
  };
}

/**
 * Steps back one state. Returns the history unchanged when there is nothing to
 * undo, so callers can bind the key without guarding.
 *
 * @param history - Current history.
 * @returns Updated history.
 */
export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);

  if (previous === undefined) {
    return history;
  }

  return {
    ...history,
    present: previous,
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future],
  };
}

/**
 * Steps forward one state. Returns the history unchanged when there is nothing
 * to redo.
 *
 * @param history - Current history.
 * @returns Updated history.
 */
export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;

  if (next === undefined) {
    return history;
  }

  return {
    ...history,
    present: next,
    past: [...history.past, history.present],
    future: rest,
  };
}

/**
 * Reports whether undo is available.
 *
 * @param history - Current history.
 * @returns True when at least one past state exists.
 */
export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

/**
 * Reports whether redo is available.
 *
 * @param history - Current history.
 * @returns True when at least one future state exists.
 */
export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

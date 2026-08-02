import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, push, redo, undo } from './history';

describe(createHistory, () => {
  it('starts with no past or future', () => {
    const history = createHistory('a');

    expect(history.present).toBe('a');
    expect(canUndo(history)).toBeFalsy();
    expect(canRedo(history)).toBeFalsy();
  });
});

describe(push, () => {
  it('moves the previous state into the past', () => {
    const history = push(createHistory('a'), 'b');

    expect(history.present).toBe('b');
    expect(history.past).toStrictEqual(['a']);
  });

  it('drops the oldest state past the limit', () => {
    let history = createHistory('a', 2);
    for (const value of ['b', 'c', 'd']) {
      history = push(history, value);
    }

    expect(history.past).toStrictEqual(['b', 'c']);
    expect(history.present).toBe('d');
  });

  it('clears the redo branch', () => {
    const history = push(undo(push(createHistory('a'), 'b')), 'c');

    expect(canRedo(history)).toBeFalsy();
    expect(history.present).toBe('c');
  });

  it('leaves the original history untouched', () => {
    const original = createHistory('a');
    push(original, 'b');

    expect(original.present).toBe('a');
    expect(original.past).toStrictEqual([]);
  });
});

describe(undo, () => {
  it('restores the previous state', () => {
    const history = undo(push(createHistory('a'), 'b'));

    expect(history.present).toBe('a');
    expect(canRedo(history)).toBeTruthy();
  });

  it('returns the history unchanged when the past is empty', () => {
    const history = createHistory('a');

    expect(undo(history)).toBe(history);
  });

  it('walks back through several states', () => {
    let history = createHistory('a');
    for (const value of ['b', 'c']) {
      history = push(history, value);
    }

    expect(undo(undo(history)).present).toBe('a');
  });
});

describe(redo, () => {
  it('reapplies an undone state', () => {
    const history = redo(undo(push(createHistory('a'), 'b')));

    expect(history.present).toBe('b');
    expect(canRedo(history)).toBeFalsy();
  });

  it('returns the history unchanged when the future is empty', () => {
    const history = push(createHistory('a'), 'b');

    expect(redo(history)).toBe(history);
  });
});

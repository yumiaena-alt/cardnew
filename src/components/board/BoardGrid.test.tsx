import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page, userEvent } from 'vitest/browser';
import messages from '@/locales/en.json';
import { BoardGrid } from './BoardGrid';
import type { FanoutChannelId } from './FanoutCell';
import type { SheetColumn, SheetRow } from './useBoardSheet';
import { useBoardSheet } from './useBoardSheet';

/**
 * The sheet, driven through a real browser.
 *
 * The pure grid maths is covered by `@/lib/sheet` unit tests. What those cannot
 * see is whether the keyboard, the clipboard and the edit lifecycle are wired
 * to them — a sheet whose arrow keys move the wrong way passes every unit test
 * it has. These run the component in Chromium and press the actual keys.
 */

const COLUMNS: readonly SheetColumn[] = [
  { key: 'topic', labelKey: 'column_topic', width: 240 },
  { key: 'notes', labelKey: 'column_notes', width: 200 },
];

const COLUMN_LABELS = { topic: 'Topic', notes: 'Notes' };

const CHANNEL_LABELS: Record<FanoutChannelId, string> = {
  instagram: 'Instagram',
  threads: 'Threads',
  tiktok: 'TikTok',
  blog: 'Blog',
};

const ROWS: readonly SheetRow[] = [
  { topic: 'Summer menu', notes: 'first' },
  { topic: 'Autumn menu', notes: 'second' },
];

/**
 * Renders the grid over real sheet state.
 *
 * @returns The grid under a locale provider.
 */
function Harness() {
  const sheet = useBoardSheet({ columns: COLUMNS, initialRows: ROWS });

  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <BoardGrid
        channelLabels={CHANNEL_LABELS}
        columnLabels={COLUMN_LABELS}
        columns={COLUMNS}
        sheet={sheet}
      />
    </NextIntlClientProvider>
  );
}

/**
 * Reads the cell the grid considers focused.
 *
 * @returns The focused cell's text, or an empty string when none is.
 */
function focusedCellText(): string {
  return document.querySelector('td[tabindex="0"]')?.textContent ?? '';
}

/**
 * Fires a paste carrying tab-separated text at the focused cell.
 *
 * Built as a real ClipboardEvent rather than through the automation clipboard,
 * which needs a permission prompt no headless run can answer.
 *
 * @param text - The clipboard payload.
 */
function pasteText(text: string) {
  const data = new DataTransfer();
  data.setData('text/plain', text);

  document
    .querySelector('td[tabindex="0"]')
    ?.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: data }));
}

/** Row height the grid converts a drag distance into rows with. */
const ROW_HEIGHT = 40;

/**
 * Drags the fill handle down by a number of rows.
 *
 * Real pointer events: the drag is bound to `pointermove` on the window, which
 * a synthetic click cannot reach.
 *
 * @param rows - How many rows to drag over.
 */
function dragFillHandle(rows: number) {
  const handle = document.querySelector('td[tabindex="0"] button');

  // A fully described pointer: React ignores a pointerdown without an id or a
  // primary flag, and the drag never starts.
  handle?.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      isPrimary: true,
      buttons: 1,
      clientY: 0,
    }),
  );
  globalThis.dispatchEvent(
    new PointerEvent('pointermove', { pointerId: 1, clientY: rows * ROW_HEIGHT }),
  );
  globalThis.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
}

describe(BoardGrid, () => {
  it('renders a cell for every column of every row', async () => {
    await render(<Harness />);

    await expect.element(page.getByText('Summer menu')).toBeInTheDocument();
    await expect.element(page.getByText('second')).toBeInTheDocument();
  });

  it('starts with the first cell focused', async () => {
    await render(<Harness />);

    expect(focusedCellText()).toBe('Summer menu');
  });

  it('moves the focused cell with the arrow keys', async () => {
    await render(<Harness />);

    await userEvent.click(page.getByText('Summer menu'));
    await userEvent.keyboard('{ArrowRight}');

    expect(focusedCellText()).toBe('first');

    await userEvent.keyboard('{ArrowDown}');

    expect(focusedCellText()).toBe('second');
  });

  // Typing straight into a selected cell is how a spreadsheet is used; needing
  // a double click first is the difference between a sheet and a form.
  it('replaces a cell by typing over it', async () => {
    await render(<Harness />);

    await userEvent.click(page.getByText('Summer menu'));
    await userEvent.keyboard('Winter menu{Enter}');

    await expect.element(page.getByText('Winter menu')).toBeInTheDocument();
  });

  it('leaves the cell unchanged when the edit is abandoned', async () => {
    await render(<Harness />);

    await userEvent.click(page.getByText('Summer menu'));
    await userEvent.keyboard('Winter{Escape}');

    await expect.element(page.getByText('Summer menu')).toBeInTheDocument();
  });

  it('takes an edit back with undo', async () => {
    await render(<Harness />);

    await userEvent.click(page.getByText('Summer menu'));
    await userEvent.keyboard('Winter menu{Enter}');
    await userEvent.keyboard('{Control>}z{/Control}');

    await expect.element(page.getByText('Summer menu')).toBeInTheDocument();
  });

  it('empties the selected cell with delete', async () => {
    await render(<Harness />);

    await userEvent.click(page.getByText('Autumn menu'));
    await userEvent.keyboard('{Delete}');

    expect(page.getByText('Autumn menu').elements()).toHaveLength(0);
  });

  // Filling down is how one decision becomes a month of them. The handle is a
  // 8px target bound to window-level pointer events, which is exactly the kind
  // of wiring that survives a refactor visually and stops working.
  it('copies the selected cell down when the fill handle is dragged', async () => {
    await render(<Harness />);

    await userEvent.click(page.getByText('Summer menu'));
    dragFillHandle(1);

    // Polled: the drag ends on a raw event, so nothing has awaited React's
    // re-render by the time this line runs.
    await expect.poll(() => page.getByText('Summer menu').elements().length).toBe(2);
  });

  // A month of topics arrives as a paste from a spreadsheet. Losing the tab
  // structure would put a whole row into one cell.
  it('spreads a pasted block across cells and rows', async () => {
    await render(<Harness />);

    await userEvent.click(page.getByText('Summer menu'));
    pasteText('Spring menu\tthird\nWinter menu\tfourth');

    await expect.element(page.getByText('Spring menu')).toBeInTheDocument();
    await expect.element(page.getByText('third')).toBeInTheDocument();
    await expect.element(page.getByText('Winter menu')).toBeInTheDocument();
    await expect.element(page.getByText('fourth')).toBeInTheDocument();
  });
});

import { redirect } from 'next/navigation';

/**
 * The board is a view of the calendar now, not a place of its own.
 *
 * Kept as a redirect because links to it are spread across planning, the deck
 * list and the calendar itself, and a month's sheet is worth reaching by an old
 * bookmark.
 */
export default function BoardPage() {
  redirect('/dashboard/calendar?view=board');
}

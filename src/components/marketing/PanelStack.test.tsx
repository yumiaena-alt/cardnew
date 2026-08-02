import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import { PanelStack } from './PanelStack';

const CUTS = [
  { channelLabel: 'Instagram', ratioLabel: '4:5', aspect: 'aspect-4/5' },
  { channelLabel: 'Reels', ratioLabel: '9:16', aspect: 'aspect-9/16' },
  { channelLabel: 'Threads', ratioLabel: '1:1', aspect: 'aspect-square' },
] as const;

describe(PanelStack, () => {
  it('renders one figure per channel cut', async () => {
    await render(<PanelStack sourceLabel="1 source" generatedLabel="AI generated" cuts={CUTS} />);

    await expect.element(page.getByText('Instagram')).toBeInTheDocument();
    await expect.element(page.getByText('Reels')).toBeInTheDocument();
    await expect.element(page.getByText('Threads')).toBeInTheDocument();
  });

  it('labels each cut with its aspect ratio', async () => {
    await render(<PanelStack sourceLabel="1 source" generatedLabel="AI generated" cuts={CUTS} />);

    await expect.element(page.getByText('4:5')).toBeInTheDocument();
    await expect.element(page.getByText('9:16')).toBeInTheDocument();
  });

  it('marks the source panel', async () => {
    await render(<PanelStack sourceLabel="1 source" generatedLabel="AI generated" cuts={CUTS} />);

    await expect.element(page.getByText('1 source')).toBeInTheDocument();
  });
});

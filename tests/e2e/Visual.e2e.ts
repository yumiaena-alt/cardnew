import { expect, takeSnapshot, test } from '@chromatic-com/playwright';

test.describe('Visual testing', () => {
  test.describe('Marketing page', () => {
    test('should take screenshot of the Korean homepage', async ({ page }, testInfo) => {
      await page.goto('/');

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      await takeSnapshot(page, testInfo);
    });

    test('should take screenshot of the English homepage', async ({ page }, testInfo) => {
      await page.goto('/en');

      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(
        page.getByRole('heading', { name: 'A month of card news, in one sitting.', level: 1 }),
      ).toBeVisible();

      await takeSnapshot(page, testInfo);
    });

    test('should take screenshot of the sign-in page', async ({ page }, testInfo) => {
      await page.goto('/en/sign-in');

      await expect(page.getByText('Email address')).toBeVisible();

      await takeSnapshot(page, testInfo);
    });
  });
});

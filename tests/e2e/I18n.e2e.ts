import { expect, test } from '@playwright/test';

// The marketing copy is still untranslated boilerplate, so the homepage case
// asserts the route the switcher lands on rather than page text. The sign-in
// case can assert real copy because Clerk ships its own localizations.
test.describe('I18n', () => {
  test.describe('Language switching', () => {
    test('switches locale from the dropdown on the homepage', async ({ page }) => {
      // Entering on `/en` rather than `/`: next-intl detects the browser's
      // Accept-Language on the first request, and the test browser asks for
      // en-US, so the unprefixed root would not settle on the default locale.
      await page.goto('/en');

      await page.getByLabel('Change language').selectOption('ko');

      // Korean is the default locale, so `as-needed` drops the prefix.
      await expect(page).toHaveURL(/\/$/u);

      await page.getByLabel('Change language').selectOption('en');

      await expect(page).toHaveURL(/\/en$/u);
    });
  });

  test.describe('Clerk localization', () => {
    // Pinning the browser locale is what makes the unprefixed route resolve to
    // Korean: next-intl reads Accept-Language when no prefix is present.
    test.use({ locale: 'ko-KR' });

    test('renders the sign-in form in the locale the route resolves to', async ({ page }) => {
      await page.goto('/sign-in');

      await expect(page.getByText('이메일 주소')).toBeVisible();

      await page.goto('/en/sign-in');

      await expect(page.getByText('Email address')).toBeVisible();
    });
  });
});

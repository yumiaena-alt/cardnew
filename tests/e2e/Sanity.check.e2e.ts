import { expect, test } from '@playwright/test';

// Checkly is a tool used to monitor deployed environments, such as production or preview environments.
// It runs end-to-end tests with the `.check.e2e.ts` extension after each deployment to ensure that the environment is up and running.
// With Checkly, you can monitor your production environment and run `*.check.e2e.ts` tests regularly at a frequency of your choice.
// If the tests fail, Checkly will notify you via email, Slack, or other channels of your choice.
// On the other hand, E2E tests ending with `*.e2e.ts` are only run before deployment.
// You can run them locally or on CI to ensure that the application is ready for deployment.

test.describe('Sanity', () => {
  test.describe('Marketing page', () => {
    test('should display the hero heading', async ({ page }) => {
      await page.goto('/en');

      await expect(
        page.getByRole('heading', { name: 'A month of card news, in one sitting.', level: 1 }),
      ).toBeVisible();
    });

    test('should offer the sign-up call to action', async ({ page }) => {
      await page.goto('/en');

      await expect(page.getByRole('link', { name: 'Start free' }).first()).toBeVisible();
    });

    test('should jump to the how-it-works section', async ({ page }) => {
      await page.goto('/en');

      await page.getByRole('link', { name: 'See how it works' }).click();

      await expect(
        page.getByRole('heading', { name: 'Three steps, then it is done.' }),
      ).toBeVisible();
    });
  });
});

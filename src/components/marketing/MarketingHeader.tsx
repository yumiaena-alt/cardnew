import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { Link } from '@/libs/I18nNavigation';

const LOGO_MARK_BARS = [0, 1, 2];

/**
 * Marketing header. Deliberately thin — a single line rule instead of a shadow,
 * matching the dashboard shell so the two surfaces read as one product.
 *
 * @returns The marketing site header.
 */
export function MarketingHeader() {
  const t = useTranslations('MarketingHeader');

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 md:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span
            className="flex size-7 items-center justify-center gap-[3px] rounded-md bg-primary px-1.5"
            aria-hidden="true"
          >
            {LOGO_MARK_BARS.map((bar) => (
              <span
                key={bar}
                className="h-3.5 w-[3px] rounded-full bg-primary-foreground"
                style={{ opacity: 1 - bar * 0.28 }}
              />
            ))}
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">
            {t('brand_name')}
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <LocaleSwitcher />

          <Link
            href="/sign-in/"
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t('sign_in')}
          </Link>

          <Link
            href="/sign-up/"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px"
          >
            {t('sign_up')}
          </Link>
        </div>
      </div>
    </header>
  );
}

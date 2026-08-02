import { useTranslations } from 'next-intl';

export function MarketingFooter() {
  const t = useTranslations('MarketingFooter');

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-10 md:flex-row md:items-baseline md:justify-between md:px-6 lg:px-8">
        <p className="text-sm font-medium text-foreground">{t('tagline')}</p>
        <p className="font-mono text-xs text-muted-foreground tabular-nums">
          {t('copyright', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}

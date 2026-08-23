import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FormulaLearnForm } from '@/components/toon/FormulaLearnForm';
import { ToonDeleteButton } from '@/components/toon/ToonDeleteButton';
import { ToonTabs } from '@/components/toon/ToonTabs';
import { getBalance } from '@/features/credit/service';
import { findScope } from '@/features/shared/scope';
import { listFormulas } from '@/features/toon/repository';

type ToonFormulasPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ToonFormulasPage(props: ToonFormulasPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'ToonFormulasPage' });
  const scope = await findScope();

  const [formulas, creditBalance] = scope
    ? await Promise.all([listFormulas(scope), getBalance(scope)])
    : [[], 0];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <ToonTabs />

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {formulas.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {formulas.map((formula) => (
            <li
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"
              key={formula.id}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{formula.name}</span>

                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t('beat_count', { count: formula.beats.length })}
                  </span>

                  <ToonDeleteButton
                    confirmLabel={t('delete_confirm_label', { name: formula.name })}
                    id={formula.id}
                    kind="formula"
                    label={t('delete_label', { name: formula.name })}
                  />
                </span>
              </div>

              <p className="text-sm text-muted-foreground">{formula.summary}</p>

              {/* The tension curve is the formula, in one line. Reading it is
                  how you tell a slow-burn format from a twist-heavy one
                  without opening anything. */}
              <p className="font-mono text-xs text-muted-foreground tabular-nums">
                {formula.beats.map((beat) => beat.tension).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">{t('form_title')}</h2>

        <FormulaLearnForm creditBalance={creditBalance} />
      </section>
    </div>
  );
}

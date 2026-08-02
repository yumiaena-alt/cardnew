import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PanelStack } from '@/components/marketing/PanelStack';
import { Link } from '@/libs/I18nNavigation';

type HomePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: HomePageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'HomePage' });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function HomePage(props: HomePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'HomePage' });

  const features = [
    { key: 'fanout', title: t('feature_fanout_title'), body: t('feature_fanout_body') },
    { key: 'batch', title: t('feature_batch_title'), body: t('feature_batch_body') },
    { key: 'dryrun', title: t('feature_dryrun_title'), body: t('feature_dryrun_body') },
  ];

  const steps = [
    { key: 'topic', title: t('step_topic_title'), body: t('step_topic_body') },
    { key: 'generate', title: t('step_generate_title'), body: t('step_generate_body') },
    { key: 'schedule', title: t('step_schedule_title'), body: t('step_schedule_body') },
  ];

  return (
    <>
      <section
        aria-labelledby="hero-heading"
        className="mx-auto max-w-6xl px-4 pt-16 pb-14 md:px-6 md:pt-24 lg:px-8 lg:pt-28"
      >
        <p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
          {t('eyebrow')}
        </p>

        <h1
          id="hero-heading"
          className="mt-5 max-w-3xl font-display text-[clamp(2.5rem,1.4rem+4.4vw,5rem)] leading-[1.05] font-normal tracking-tight text-balance text-foreground"
        >
          {t('headline')}
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
          {t('subheadline')}
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-up/"
            className="inline-flex h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px"
          >
            {t('cta_primary')}
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex h-11 items-center rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t('cta_secondary')}
          </a>
          <p className="font-mono text-xs text-muted-foreground tabular-nums">{t('trust_note')}</p>
        </div>
      </section>

      <section
        aria-labelledby="fanout-heading"
        className="mx-auto max-w-6xl px-4 pb-20 md:px-6 lg:px-8"
      >
        <h2 id="fanout-heading" className="sr-only">
          {t('fanout_visual_heading')}
        </h2>
        <div className="rounded-xl border border-border bg-muted/40 p-5 md:p-8">
          <PanelStack
            sourceLabel={t('visual_source_label')}
            generatedLabel={t('visual_generated_label')}
            cuts={[
              { channelLabel: t('channel_instagram'), ratioLabel: '4:5', aspect: 'aspect-4/5' },
              { channelLabel: t('channel_reels'), ratioLabel: '9:16', aspect: 'aspect-9/16' },
              { channelLabel: t('channel_threads'), ratioLabel: '1:1', aspect: 'aspect-square' },
            ]}
          />
        </div>
      </section>

      <section
        aria-labelledby="features-heading"
        className="border-y border-border bg-card/60 py-16 md:py-20"
      >
        <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
          <h2
            id="features-heading"
            className="max-w-2xl font-display text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] leading-tight font-normal text-foreground"
          >
            {t('features_heading')}
          </h2>

          <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
            {features.map((feature, index) => (
              <li key={feature.key} className="bg-background p-6 md:p-7">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-heading" className="py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
          <h2
            id="how-heading"
            className="font-display text-[clamp(1.75rem,1.2rem+2vw,2.75rem)] leading-tight font-normal text-foreground"
          >
            {t('how_heading')}
          </h2>

          <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {steps.map((step, index) => (
              <li key={step.key} className="border-t border-border pt-5">
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {t('step_label', { index: index + 1 })}
                </span>
                <h3 className="mt-3 text-base font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="cta-heading" className="pb-24">
        <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-6 rounded-xl border border-border bg-secondary px-6 py-10 md:flex-row md:items-center md:justify-between md:px-10">
            <h2
              id="cta-heading"
              className="max-w-lg font-display text-[clamp(1.5rem,1.1rem+1.6vw,2.25rem)] leading-tight font-normal text-secondary-foreground"
            >
              {t('closing_heading')}
            </h2>
            <Link
              href="/sign-up/"
              className="inline-flex h-11 shrink-0 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px"
            >
              {t('cta_primary')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

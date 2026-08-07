import { Palette } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TemplateCard } from '@/components/template/TemplateCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { findScope } from '@/features/shared/scope';
import { listLearnedTemplates } from '@/features/template/repository';

/** The three colours that say most about whether a design was read right. */
const PALETTE_TOKENS = ['backgroundColor', 'textColor', 'accentColor'] as const;

type TemplateGalleryPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TemplateGalleryPage(props: TemplateGalleryPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'TemplateGalleryPage' });
  const scope = await findScope();
  const learned = scope ? await listLearnedTemplates(scope) : [];

  if (learned.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <EmptyState
          description={t('scaffold_description')}
          icon={Palette}
          title={t('scaffold_title')}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('summary', { count: learned.length })}</p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {learned.map((template) => (
          <li key={template.id}>
            <TemplateCard
              colors={PALETTE_TOKENS.map((token) => template.tokens[token] ?? '#000000')}
              id={template.id}
              name={template.name}
              ratio={template.ratio}
              roles={t('layouts', {
                roles: template.layouts.map((layout) => layout.role).join(' · '),
              })}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

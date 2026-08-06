import { Palette } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import { findScope } from '@/features/shared/scope';
import { listLearnedTemplates } from '@/features/template/repository';

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
          <li
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            key={template.id}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-sm font-medium text-foreground">{template.name}</h2>
              <StatusChip tone="done">{template.ratio}</StatusChip>
            </div>

            {/* The palette it learned, shown as the colours themselves. A hex
                string tells nobody whether the design was read correctly. */}
            <div className="flex gap-1.5">
              {['backgroundColor', 'textColor', 'accentColor'].map((token) => (
                <span
                  className="size-6 rounded-full border border-border"
                  key={token}
                  style={{ backgroundColor: template.tokens[token] }}
                  title={template.tokens[token]}
                />
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {t('layouts', { roles: template.layouts.map((layout) => layout.role).join(' · ') })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { PenLine } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PanelEditorShell } from '@/components/deck/canvas/PanelEditorShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { findPanelByIndex } from '@/features/deck/repository';
import { findScope } from '@/features/shared/scope';
import { parseSlideDoc } from '@/lib/slidedoc/doc';

type PanelEditorPageProps = {
  params: Promise<{ locale: string; deckId: string; index: string }>;
};

/**
 * One card, open on the canvas.
 *
 * The document is parsed rather than trusted on the way out: it has been in a
 * jsonb column since the day it was written, and a card whose stored shape has
 * drifted should fail here instead of half-drawing on the canvas.
 *
 * @param props - Route params naming the deck and which card.
 * @returns The editor screen.
 */
export default async function PanelEditorPage(props: PanelEditorPageProps) {
  const { locale, deckId, index } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'PanelEditorPage' });
  const scope = await findScope();

  if (!scope) {
    notFound();
  }

  const panel = await findPanelByIndex(scope, deckId, Number(index));

  if (!panel) {
    notFound();
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">
          {t('title', { index: panel.index + 1 })}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {panel.doc ? (
        <PanelEditorShell initialDoc={parseSlideDoc(panel.doc)} panelId={panel.id} />
      ) : (
        <EmptyState
          description={t('no_doc_description')}
          icon={PenLine}
          title={t('no_doc_title')}
        />
      )}
    </div>
  );
}

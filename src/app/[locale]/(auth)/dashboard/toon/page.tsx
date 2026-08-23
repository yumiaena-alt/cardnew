import { UserRoundPlus } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ToonCreateForm } from '@/components/toon/ToonCreateForm';
import { ToonTabs } from '@/components/toon/ToonTabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { getBalance } from '@/features/credit/service';
import { findScope } from '@/features/shared/scope';
import { listCharacters, listFormulas } from '@/features/toon/repository';

type ToonCreatePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ToonCreatePage(props: ToonCreatePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'ToonCreatePage' });
  const scope = await findScope();

  const [characters, formulas, creditBalance] = scope
    ? await Promise.all([listCharacters(scope), listFormulas(scope), getBalance(scope)])
    : [[], [], 0];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <ToonTabs />

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* A toon cannot be drawn before there is somebody to draw. Pointing at
          the cast screen is the whole content of this state. */}
      {characters.length === 0 ? (
        <EmptyState
          description={t('no_character_description')}
          icon={UserRoundPlus}
          title={t('no_character_title')}
        />
      ) : (
        <ToonCreateForm
          characters={characters.map((entry) => ({ id: entry.id, name: entry.name }))}
          creditBalance={creditBalance}
          formulas={formulas.map((entry) => ({ id: entry.id, name: entry.name }))}
          noFormulaLabel={t('formula_none')}
        />
      )}
    </div>
  );
}

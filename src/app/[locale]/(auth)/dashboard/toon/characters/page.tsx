import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CharacterForm } from '@/components/toon/CharacterForm';
import { ToonDeleteButton } from '@/components/toon/ToonDeleteButton';
import { ToonTabs } from '@/components/toon/ToonTabs';
import { findScope } from '@/features/shared/scope';
import { listCharacters } from '@/features/toon/repository';
import type { ArtStyleKey } from '@/lib/toon/character';

type ToonCharactersPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ToonCharactersPage(props: ToonCharactersPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'ToonCharactersPage' });
  const scope = await findScope();
  const characters = scope ? await listCharacters(scope) : [];

  // Named one by one rather than looked up from the style key. A dynamic
  // `t(key)` reads to the i18n checker as a key nobody uses.
  const styleLabels: Record<ArtStyleKey, string> = {
    'soft-webtoon': t('style_soft_webtoon'),
    'bold-comic': t('style_bold_comic'),
    'sketch-diary': t('style_sketch_diary'),
    'minimal-line': t('style_minimal_line'),
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <ToonTabs />

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {characters.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {characters.map((character) => (
            <li
              className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4"
              key={character.id}
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">{character.name}</span>
                <span className="text-sm text-muted-foreground">
                  {styleLabels[character.artStyle]} · {character.appearance.hair}
                </span>
                {/* The seed is shown because it is the answer to "why does this
                    one look different from that one" — two characters with the
                    same appearance still draw apart if their seeds differ. */}
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {t('seed', { seed: character.seed })}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {character.referencePath ? (
                  <span className="rounded-full border border-signal/40 bg-signal/10 px-2 py-0.5 text-xs text-foreground">
                    {t('has_sheet')}
                  </span>
                ) : null}

                <ToonDeleteButton
                  confirmLabel={t('delete_confirm_label', { name: character.name })}
                  id={character.id}
                  kind="character"
                  label={t('delete_label', { name: character.name })}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">{t('form_title')}</h2>

        <CharacterForm styleLabels={styleLabels} />
      </section>
    </div>
  );
}

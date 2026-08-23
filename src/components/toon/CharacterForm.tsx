'use client';

import { UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import type { ToonFailureCode } from '@/features/toon/actions';
import { createToonCharacter } from '@/features/toon/actions';
import { ART_STYLE_KEYS, artStyleSchema } from '@/lib/toon/character';
import type { ArtStyleKey } from '@/lib/toon/character';

/**
 * Defining the character every cut is drawn against.
 *
 * The form asks for each part of the appearance separately rather than as one
 * free description, and that is the whole point. A field left to the model is a
 * field the model re-invents on every cut, and it is the re-invented parts that
 * make cut three look like a different person.
 */

/** A sheet is one drawing, and browsers struggle to read much more than this. */
const MAX_SHEET_BYTES = 5 * 1024 * 1024;

/** Distinctive marks are typed as one comma-separated line. Three is the cap. */
const MAX_DISTINCTIVE_MARKS = 3;

type CharacterFormProps = {
  /** Style keys and their labels, resolved on the server so copy stays in i18n. */
  styleLabels: Record<ArtStyleKey, string>;
};

/**
 * Reads a picked file as a data URL.
 *
 * @param file - The picked file.
 * @returns The data URL.
 */
async function toDataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }

  return `data:${file.type};base64,${btoa(binary)}`;
}

/**
 * Creates a character.
 *
 * @param props - Art style labels.
 * @returns The character form.
 */
export function CharacterForm(props: CharacterFormProps) {
  const t = useTranslations('ToonCharactersPage');
  const [name, setName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [hair, setHair] = useState('');
  const [outfit, setOutfit] = useState('');
  const [face, setFace] = useState('');
  const [distinctive, setDistinctive] = useState('');
  const [artStyle, setArtStyle] = useState<ArtStyleKey>('soft-webtoon');
  const [sheet, setSheet] = useState<string | null>(null);
  const [failure, setFailure] = useState<ToonFailureCode | null>(null);
  const [created, setCreated] = useState(false);
  const [isPending, startTransition] = useTransition();

  const ready = [name, ageRange, hair, outfit, face].every((value) => value.trim() !== '');

  const pickSheet = (files: FileList | null) => {
    const file = files?.[0];

    if (!file || file.size > MAX_SHEET_BYTES) {
      return;
    }

    startTransition(async () => {
      setSheet(await toDataUrl(file));
    });
  };

  const submit = () => {
    setFailure(null);
    setCreated(false);

    startTransition(async () => {
      const result = await createToonCharacter({
        name: name.trim(),
        appearance: {
          ageRange: ageRange.trim(),
          hair: hair.trim(),
          outfit: outfit.trim(),
          face: face.trim(),
          distinctive: distinctive
            .split(',')
            .map((mark) => mark.trim())
            .filter((mark) => mark !== '')
            .slice(0, MAX_DISTINCTIVE_MARKS),
        },
        artStyle,
        referenceImage: sheet,
      });

      if (result.ok) {
        setCreated(true);
        setName('');

        return;
      }

      setFailure(result.code);
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Field htmlFor="character-name" label={t('name_label')}>
        <Input
          id="character-name"
          maxLength={40}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder={t('name_placeholder')}
          value={name}
        />
      </Field>

      <Field htmlFor="character-age" hint={t('english_hint')} label={t('age_label')}>
        <Input
          id="character-age"
          maxLength={24}
          onChange={(event) => {
            setAgeRange(event.target.value);
          }}
          placeholder={t('age_placeholder')}
          value={ageRange}
        />
      </Field>

      <Field htmlFor="character-hair" label={t('hair_label')}>
        <Input
          id="character-hair"
          maxLength={60}
          onChange={(event) => {
            setHair(event.target.value);
          }}
          placeholder={t('hair_placeholder')}
          value={hair}
        />
      </Field>

      <Field htmlFor="character-outfit" hint={t('outfit_hint')} label={t('outfit_label')}>
        <Input
          id="character-outfit"
          maxLength={80}
          onChange={(event) => {
            setOutfit(event.target.value);
          }}
          placeholder={t('outfit_placeholder')}
          value={outfit}
        />
      </Field>

      <Field htmlFor="character-face" label={t('face_label')}>
        <Input
          id="character-face"
          maxLength={80}
          onChange={(event) => {
            setFace(event.target.value);
          }}
          placeholder={t('face_placeholder')}
          value={face}
        />
      </Field>

      <Field
        htmlFor="character-distinctive"
        hint={t('distinctive_hint')}
        label={t('distinctive_label')}
      >
        <Input
          id="character-distinctive"
          maxLength={120}
          onChange={(event) => {
            setDistinctive(event.target.value);
          }}
          placeholder={t('distinctive_placeholder')}
          value={distinctive}
        />
      </Field>

      <Field label={t('style_label')}>
        <Select
          aria-label={t('style_label')}
          onValueChange={(value) => {
            const picked = artStyleSchema.safeParse(value);

            if (picked.success) {
              setArtStyle(picked.data);
            }
          }}
          options={ART_STYLE_KEYS.map((key) => ({
            value: key,
            label: props.styleLabels[key],
          }))}
          value={artStyle}
        />
      </Field>

      <Field htmlFor="character-sheet" hint={t('sheet_hint')} label={t('sheet_label')}>
        <input
          accept="image/png,image/jpeg,image/webp"
          className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          id="character-sheet"
          onChange={(event) => {
            pickSheet(event.target.files);
          }}
          type="file"
        />
      </Field>

      {failure ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {t(`error_${failure}`)}
        </p>
      ) : null}

      {created ? (
        <p className="rounded-lg border border-status-done-border bg-status-done p-3 text-sm text-status-done-foreground">
          {t('created')}
        </p>
      ) : null}

      <div>
        <Button disabled={!ready || isPending} onClick={submit} size="lg">
          <UserPlus data-icon="inline-start" />
          {isPending ? t('saving') : t('create_action')}
        </Button>
      </div>
    </div>
  );
}

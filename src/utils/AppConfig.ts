import { enUS, koKR } from '@clerk/localizations';
import type { LocalizationResource } from '@clerk/shared/types';
import type { LocalePrefixMode } from 'next-intl/routing';

/** Locale prefix strategy for next-intl routing. Korean is unprefixed. */
const localePrefix: LocalePrefixMode = 'as-needed';

/** Centralized application configuration */
export const AppConfig = {
  name: 'Panelo',
  i18n: {
    locales: ['ko', 'en'],
    defaultLocale: 'ko',
    localePrefix,
  },
};

const supportedLocales: Record<string, LocalizationResource> = {
  ko: koKR,
  en: enUS,
};

export const ClerkLocalizations = {
  defaultLocale: koKR,
  supportedLocales,
};

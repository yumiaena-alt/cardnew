import { LayoutGrid, Sparkles, Wand2 } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/libs/I18nNavigation';

const SHORTCUTS = [
  { key: 'board', href: '/dashboard/board', icon: LayoutGrid },
  { key: 'deck', href: '/dashboard/deck/new', icon: Wand2 },
  { key: 'template', href: '/dashboard/templates', icon: Sparkles },
] as const;

export default async function DashboardPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'DashboardPage' });

  const labels = {
    board: { title: t('shortcut_board_title'), body: t('shortcut_board_body') },
    deck: { title: t('shortcut_deck_title'), body: t('shortcut_deck_body') },
    template: { title: t('shortcut_template_title'), body: t('shortcut_template_body') },
  };

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('heading')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('subheading')}</p>

      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {SHORTCUTS.map((shortcut) => {
          const Icon = shortcut.icon;
          const label = labels[shortcut.key];

          return (
            <li key={shortcut.key}>
              <Link
                href={shortcut.href}
                className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                <span className="text-base font-semibold text-foreground">{label.title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{label.body}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

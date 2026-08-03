import { setRequestLocale } from 'next-intl/server';
import { AutomationView } from '@/components/social/AutomationView';
import { findScope } from '@/features/shared/scope';
import { listDmAutomations, listSocialAccounts } from '@/features/social/repository';

type AutomationPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AutomationPage(props: AutomationPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  const scope = await findScope();
  const [accounts, automations] = await Promise.all([
    scope ? listSocialAccounts(scope) : Promise.resolve([]),
    scope ? listDmAutomations(scope) : Promise.resolve([]),
  ]);

  return <AutomationView accounts={accounts} automations={automations} />;
}

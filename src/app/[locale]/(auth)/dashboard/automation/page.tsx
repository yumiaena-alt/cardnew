import { setRequestLocale } from 'next-intl/server';
import { ConnectNotice } from '@/components/dashboard/ConnectNotice';
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

  return (
    <div className="flex flex-col gap-6">
      {accounts.length === 0 ? <ConnectNotice surface="automation" /> : null}
      <AutomationView accounts={accounts} automations={automations} />
    </div>
  );
}

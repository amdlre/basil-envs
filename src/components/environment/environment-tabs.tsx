import { Link } from '@/i18n/navigation';
import type { EnvironmentColor } from '@/lib/constants/environment-colors';
import { cn } from '@/lib/utils';

import { AddEnvironmentMenu, type AvailableType } from './add-environment-menu';
import { ENV_COLOR_CLASSES } from './env-colors';
import { ScrollActiveTab } from './scroll-active-tab';

type Tab = { slug: string; name: string; color: EnvironmentColor; variableCount: number };

type Props = {
  projectId: string;
  projectSlug: string;
  tabs: Tab[];
  activeSlug: string | undefined;
  available: AvailableType[];
  label: string;
};

export function EnvironmentTabs({
  projectId,
  projectSlug,
  tabs,
  activeSlug,
  available,
  label,
}: Props) {
  return (
    <div className="flex items-center gap-1 border-b">
      <ScrollActiveTab
        activeKey={activeSlug}
        className="-mb-px min-w-0 [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        <nav aria-label={label}>
          <ul className="flex">
            {tabs.map((tab) => {
              const active = tab.slug === activeSlug;
              const color = ENV_COLOR_CLASSES[tab.color];
              return (
                <li key={tab.slug}>
                  <Link
                    href={`/projects/${projectSlug}?env=${tab.slug}`}
                    scroll={false}
                    replace
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
                      active
                        ? cn('font-medium text-foreground', color.border)
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span className={cn('size-2 rounded-full', color.dot)} aria-hidden />
                    {tab.name}
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-[11px] tabular-nums',
                        active ? 'bg-accent text-accent-foreground' : 'bg-muted',
                      )}
                    >
                      {tab.variableCount}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </ScrollActiveTab>
      <AddEnvironmentMenu projectId={projectId} projectSlug={projectSlug} available={available} />
    </div>
  );
}

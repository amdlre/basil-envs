'use client';

import { useEffect, useRef } from 'react';

/** Keeps the active (aria-current) tab visible in a horizontally scrolling tab bar. */
export function ScrollActiveTab({
  activeKey,
  children,
  className,
}: {
  activeKey: string | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeKey]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

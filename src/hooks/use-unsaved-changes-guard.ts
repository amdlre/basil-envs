'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState } from 'react';

import { setUnsavedChanges } from '@/lib/unsaved-changes';

/**
 * Warns before losing unsaved edits: browser reload/close (native prompt) and in-app link
 * clicks (intercepted in the capture phase, before Next's <Link> handler, then confirmed
 * in our own dialog).
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const router = useRouter();
  const source = useId();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setUnsavedChanges(source, dirty);
    return () => {
      setUnsavedChanges(source, false);
    };
  }, [dirty, source]);

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search)
        return;

      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  const cancel = useCallback(() => {
    setPendingHref(null);
  }, []);

  const confirm = useCallback(() => {
    if (!pendingHref) return;
    setUnsavedChanges(source, false);
    setPendingHref(null);
    router.push(pendingHref);
  }, [pendingHref, router, source]);

  return { pendingNavigation: pendingHref !== null, cancel, confirm };
}

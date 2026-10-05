'use client';

import { toast } from '@amdlre/design-system';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

import { useRouter } from '@/i18n/navigation';
import type { ActionErrorCode } from '@/lib/action-result';

type Failure = { ok: false; error: ActionErrorCode; fieldErrors?: Record<string, string> };

/**
 * Shared client handling for failed Server Action results: applies field errors to the
 * form, shows a destructive toast, and sends expired sessions back to login.
 */
export function useActionFeedback() {
  const tErrors = useTranslations('errors');
  const tCommon = useTranslations('common');
  const router = useRouter();

  return useCallback(
    (result: Failure, setFieldError?: (field: string, message: string) => void) => {
      if (setFieldError) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setFieldError(field, message);
        }
      }
      toast({
        variant: 'destructive',
        title: tCommon('actionFailed'),
        description: tErrors(result.error),
      });
      if (result.error === 'unauthorized') router.push('/login');
    },
    [router, tCommon, tErrors],
  );
}

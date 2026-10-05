'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Label,
  toast,
} from '@amdlre/design-system';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';

import { loginAction } from '@/actions/auth';
import type { ActionErrorCode } from '@/lib/action-result';
import { loginSchema, type LoginInput } from '@/lib/validations/auth';

type Props = { next?: string };

export function LoginForm({ next }: Props) {
  const t = useTranslations('auth.login');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<ActionErrorCode | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const fieldError = (message: string | undefined) =>
    message ? tValidation(message as 'required') : undefined;

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      // On success the action redirects, so a result only comes back on failure.
      const result = await loginAction({ ...values, locale, next });
      if (result.ok) return;

      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        if (field === 'email' || field === 'password') setError(field, { message });
      }
      setFormError(result.error);
      toast({
        variant: 'destructive',
        title: t('failedTitle'),
        description: tErrors(result.error),
      });
      if (result.error === 'invalidCredentials') setFocus('password');
    });
  });

  const emailError = fieldError(errors.email?.message);
  const passwordError = fieldError(errors.password?.message);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {formError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>{t('failedTitle')}</AlertTitle>
          <AlertDescription>{tErrors(formError)}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">{t('email')}</Label>
        <Input
          id="email"
          type="email"
          dir="ltr"
          autoComplete="username"
          autoFocus
          placeholder={t('emailPlaceholder')}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? 'email-error' : undefined}
          {...register('email')}
        />
        {emailError && (
          <p id="email-error" className="text-xs text-destructive">
            {emailError}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('password')}</Label>
        {/* LTR wrapper so the toggle (end-0) and the input's pe-10 resolve to the same side. */}
        <div className="relative" dir="ltr">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            dir="ltr"
            autoComplete="current-password"
            className="pe-10"
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? 'password-error' : undefined}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => {
              setShowPassword((v) => !v);
            }}
            className="absolute inset-y-0 end-0 flex w-10 items-center justify-center rounded-e-md text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
        {passwordError && (
          <p id="password-error" className="text-xs text-destructive">
            {passwordError}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" isLoading={isPending} disabled={isPending}>
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}

export const DEFAULT_SESSION = {
  userId: '00000000-0000-4000-8000-000000000001',
  email: 'admin@test.local',
};

/** Mutable session used by the mocked `@/lib/auth/session` (null = signed out). */
export const session: { current: typeof DEFAULT_SESSION | null } = {
  current: DEFAULT_SESSION,
};

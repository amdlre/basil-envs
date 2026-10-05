type NamedType = { nameEn: string; nameAr: string };

export function localizedTypeName(type: NamedType, locale: string): string {
  return locale === 'ar' ? type.nameAr : type.nameEn;
}

export function localizedTypeDescription(
  type: { descriptionEn: string | null; descriptionAr: string | null },
  locale: string,
): string | null {
  return locale === 'ar' ? type.descriptionAr : type.descriptionEn;
}

/** Delete confirmation accepts the environment's name in either language (exact, trimmed). */
export function matchesEnvironmentName(input: string, type: NamedType): boolean {
  const value = input.trim();
  return value.length > 0 && (value === type.nameEn || value === type.nameAr);
}

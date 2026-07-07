export type MixedLanguageAssessment = {
  languageHandled: Array<'id' | 'en'>;
  uncertaintyVisible: boolean;
  impactSummary: string;
  assumptionMarkedVerified: false;
};

export function assessRecurringGrowthCaveat(text: string): MixedLanguageAssessment {
  const hasIndonesianRevenue = /\bpendapatan\b/i.test(text);
  const hasEnglishCaveat = /one-time asset sale/i.test(text);
  return {
    languageHandled: [
      ...(hasIndonesianRevenue ? ['id' as const] : []),
      ...(hasEnglishCaveat ? ['en' as const] : []),
    ],
    uncertaintyVisible: hasEnglishCaveat,
    impactSummary: hasEnglishCaveat
      ? 'Reported revenue increased, but the source says the increase includes a one-time asset sale, so recurring growth remains unverified.'
      : 'Reported revenue changed, but recurring growth remains unverified without a recurring-revenue disclosure.',
    assumptionMarkedVerified: false,
  };
}

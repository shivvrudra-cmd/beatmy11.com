/**
 * white-ball-config.ts — constants shared by the ODI, T20I and IPL formats. Browser-safe.
 */

/** Decades each international format can spin. ODI data starts in 2004 and T20Is in 2005
 *  (see docs/plans/white-ball-formats.md), so "2000s" covers only the later part of the decade. */
export const INTL_ERAS: Record<'odi' | 't20i', readonly string[]> = {
  odi: ['2000s', '2010s', '2020s'],
  t20i: ['2000s', '2010s', '2020s'],
};
export const INTL_ERA_NAMES: Record<string, string> = { '2000s': '2000s', '2010s': '2010s', '2020s': '2020s' };

/** PROVISIONAL (owner confirmed 10 for IPL on 2026-10-01; ODI and T20I follow it until decided):
 *  only players with at least this many matches in the format are draftable. */
export const WB_MIN_MATCHES: Record<'odi' | 't20i' | 'ipl', number> = { odi: 10, t20i: 10, ipl: 10 };

/** Venues for the five-match series (flavour only). */
export const ODI_VENUES = ["Lord's", 'MCG', 'Wankhede', 'Newlands', 'Kensington Oval'] as const;
export const T20I_VENUES = ['MCG', 'Eden Gardens', 'The Wanderers', "Lord's", 'Kensington Oval'] as const;

/**
 * share-results.ts — the shareable series results, one per scoreline in
 * OUTCOME_BANDS (series.ts).
 *
 * "Share result" links to /r/<slug> (src/pages/r/[result].astro). Each of
 * those pages carries its own link-preview title and image
 * (public/og/<slug>.png, drawn by scripts/gen-og-images.ts), so a shared
 * "I beat the World XI 3–2" shows that scoreline in the preview. The site is
 * static, so previews exist per scoreline rather than per XI.
 */
import { OUTCOME_BANDS } from './series';

export interface ShareResult {
  /** URL and file slug, e.g. "3-2" (user first). */
  slug: string;
  user: number;
  house: number;
  draws: number;
  /** Big line on the preview image, first person from the sharer. */
  imageHeadline: string;
  /** Link-preview title, e.g. "I beat the World XI 3–2". */
  title: string;
  /** Line on the /r page, addressed to the friend who opened the link. */
  challenge: string;
}

function describe(user: number, house: number): Pick<ShareResult, 'imageHeadline' | 'title' | 'challenge'> {
  const score = `${user}–${house}`;
  if (user === 5)
    return {
      imageHeadline: 'I whitewashed the World XI',
      title: `I whitewashed the World XI ${score}`,
      challenge: 'A five–nil whitewash. It almost never happens. Can your XI do it too?',
    };
  if (user > house)
    return {
      imageHeadline: 'I beat the World XI',
      title: `I beat the World XI ${score}`,
      challenge: `Their all-time Test XI won the series ${score}. Can yours beat the World XI?`,
    };
  if (user === house)
    return {
      imageHeadline: 'I drew with the World XI',
      title: `I drew with the World XI ${score}`,
      challenge: `Their all-time Test XI drew the series ${score}. Can yours win it?`,
    };
  return {
    imageHeadline: 'Can you beat the World XI?',
    title: `The World XI beat me ${house}–${user}. Can you beat it?`,
    challenge: `The World XI won the series ${house}–${user}. Can your all-time Test XI do better?`,
  };
}

export const SHARE_RESULTS: ShareResult[] = OUTCOME_BANDS.map((b) => ({
  slug: `${b.user}-${b.house}`,
  user: b.user,
  house: b.house,
  draws: b.draws,
  ...describe(b.user, b.house),
}));

export function shareSlug(user: number, house: number): string {
  return `${user}-${house}`;
}

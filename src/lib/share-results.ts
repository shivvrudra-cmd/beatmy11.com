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

/** Wording for a format's share pages; the Test game's is the default. */
export interface ShareWords { opponent: string; xiNoun: string }

/** The seven share results worded for another format (opponent name and "IPL XI" etc.). */
export function shareResultsFor(words: ShareWords): ShareResult[] {
  const swap = (t: string) => t.replace(/all-time Test XI/g, words.xiNoun).replace(/World XI/g, words.opponent);
  return SHARE_RESULTS.map((r) => ({ ...r, imageHeadline: swap(r.imageHeadline), title: swap(r.title), challenge: swap(r.challenge) }));
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

// ---------------------------------------------------------------- XI in link
// A shared link carries the XI as `?xi=<id>.<role>,…` in batting order, e.g.
// `jack-hobbs.o,sunil-gavaskar.o,don-bradman.b,…`. Player ids are the
// stable slugs from src/data, so old links survive data updates; the /r page
// only shows ids it knows, so the URL can't put arbitrary text on the page.

export type ShareRole = 'opener' | 'middle-order' | 'wicketkeeper' | 'all-rounder' | 'spinner' | 'fast-bowler';

const ROLE_CODE: Record<ShareRole, string> = {
  opener: 'o',
  'middle-order': 'b',
  wicketkeeper: 'w',
  'all-rounder': 'a',
  spinner: 's',
  'fast-bowler': 'f',
};
const CODE_ROLE = Object.fromEntries(Object.entries(ROLE_CODE).map(([r, c]) => [c, r])) as Record<string, ShareRole>;

export interface SharedPick {
  id: string;
  role: ShareRole;
}

const ID_RE = /^[a-z0-9-]{1,60}$/;

export function encodeXI(picks: SharedPick[]): string {
  return picks.map((p) => `${p.id}.${ROLE_CODE[p.role] ?? 'b'}`).join(',');
}

/**
 * Parses `?xi=`; returns null unless it is exactly 11 well-formed picks
 * whose ids pass `known` (the page's player index).
 */
export function decodeXI(raw: string | null, known: (id: string) => boolean): SharedPick[] | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 11) return null;
  const picks: SharedPick[] = [];
  for (const part of parts) {
    const dot = part.lastIndexOf('.');
    const id = part.slice(0, dot);
    const role = CODE_ROLE[part.slice(dot + 1)];
    if (dot < 1 || !role || !ID_RE.test(id) || !known(id)) return null;
    picks.push({ id, role });
  }
  return picks;
}

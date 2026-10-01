/**
 * names.mjs — name normalisation and the "same person" test shared by the data build and the
 * HowSTAT reader.
 */

export const norm = (s) =>
  String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
/**
 * Same person by name: same surname, and the first names agree on an initial. Initials may be any
 * of a run of capitals, because many players go by a middle name: "SL Malinga" ~ "Lasith Malinga",
 * "PJ Cummins" ~ "Pat Cummins", but not "Anderson Cummins".
 */
export function sameIdentity(a, b) {
  const wa = String(a).trim().split(/\s+/), wb = String(b).trim().split(/\s+/);
  if (norm(wa[wa.length - 1]) !== norm(wb[wb.length - 1])) return false;
  const initials = (words) => {
    const out = new Set();
    for (const w of words.slice(0, -1)) {
      if (/^[A-Z]{1,5}$/.test(w)) for (const ch of w) out.add(ch.toLowerCase());
      else if (norm(w)) out.add(norm(w)[0]);
    }
    if (words.length === 1 && norm(words[0])) out.add(norm(words[0])[0]);
    return out;
  };
  const ia = initials(wa), ib = initials(wb);
  if (ia.size === 0 || ib.size === 0) return true; // single-word names: surname already matched
  for (const x of ia) if (ib.has(x)) return true;
  return false;
}

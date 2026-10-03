import {
  createDraft, applySpinResult, applyDraftPick, applyDraftMove, applyDraftDeselect,
  validatePoolPick, validateSlotPlacement, validateSlotMove, placementOptions,
  declarableRoles, defaultDeclaredRole, declarationForSlot, moveDeclaration, countsOf, reachableShapes, isXIValid,
  serializeDraft, deserializeDraft, supplyFor, canFillRole,
  XI_SLOTS, XI_SIZE, XI_SHAPES, emptyCounts, POOL_GROUPS, XI_SLOT_GROUP_LABELS, XI_ROLE_LABELS,
  canRespinNation,
  canRespinEra,
  applyNationRespin,
  applyEraRespin,
  type NormalizedPlayer, type DraftState, type XiRole,
} from '../src/lib/player-logic';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) { pass++; }
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

const mk = (id: string, name: string, primary: string, secondary: string[] = []): NormalizedPlayer => ({
  uid: `1990s:${id}`, id, name, nation: 'Australia', era: '1990s', displayEra: '1990s',
  primaryRole: primary, secondaryRoles: secondary, stats: {},
});

// ---- slot model: 2 openers, batting 3-6, flex 7-8, 3 fast bowlers ----
ok(XI_SLOTS.length === 11 && XI_SIZE === 11, 'eleven slots');
ok(XI_SLOTS[6].key === 'flex-7' && XI_SLOTS[7].key === 'flex-8', 'flex slots at 7-8');
ok(XI_SHAPES.length === 3, 'three valid shapes');
ok(XI_SHAPES.every((s) => (Object.values(s) as number[]).reduce((a, b) => a + b, 0) === 11), 'shapes sum to 11');
ok(
  XI_SHAPES.some((s) => s['all-rounder'] === 2 && s.spinner === 0) &&
    XI_SHAPES.some((s) => s['all-rounder'] === 1 && s.spinner === 1) &&
    XI_SHAPES.some((s) => s['all-rounder'] === 0 && s.spinner === 2) &&
    XI_SHAPES.every((s) => s['middle-order'] === 3 && s.opener === 2 && s.wicketkeeper === 1 && s['fast-bowler'] === 3),
  'shapes are 2AR / AR+SP / 2SP over a fixed 2O+3MO+1WK+3F core',
);

// ---- declarable roles ----
const sanga = mk('sanga', 'Sangakkara', 'middle-order', ['wicketkeeper']);
const gilchrist = mk('gilchrist', 'Gilchrist', 'wicketkeeper');
const sobers = mk('sobers', 'Sobers', 'all-rounder', ['middle-order']);
const warne = mk('warne', 'Warne', 'spinner');
const kallis = mk('kallis', 'Kallis', 'all-rounder', ['spinner']);
const botham = mk('botham', 'Botham', 'all-rounder', ['middle-order']);
const hobbs = mk('hobbs', 'Hobbs', 'opener');

// Spots 3–5 take middle-order only; the keeper's spot is bat-6 (a keeper on
// 3–5 would strand the keeper-only bat-6 — fixed 2026-09-29).
ok(JSON.stringify(declarableRoles(sanga, 'bat-3')) === JSON.stringify(['middle-order']), 'sanga bat roles on 3–5: middle-order');
ok(JSON.stringify(declarableRoles(sanga, 'bat-6')) === JSON.stringify(['wicketkeeper']), 'sanga on bat-6: wicketkeeper');
ok(defaultDeclaredRole(sanga, 'bat-3') === 'middle-order', 'sanga default MO');
// Design B: all-rounder is NOT a batting-slot declaration — an all-rounder
// placed at 3-6 bats as a middle-order player.
ok(JSON.stringify(declarableRoles(sobers, 'bat-3')) === JSON.stringify(['middle-order']), 'sobers bat roles (MO only)');
ok(defaultDeclaredRole(sobers, 'bat-3') === 'middle-order', 'sobers default MO (slot-first)');
ok(JSON.stringify(declarableRoles(sobers, 'flex-7')) === JSON.stringify(['all-rounder']), 'sobers flex roles');
ok(JSON.stringify(declarableRoles(kallis, 'flex-7')) === JSON.stringify(['all-rounder', 'spinner']), 'kallis flex roles');
ok(defaultDeclaredRole(kallis, 'flex-7') === 'all-rounder', 'kallis default AR');
ok(declarableRoles(warne, 'bat-3').length === 0, 'warne cannot bat');
ok(declarableRoles(hobbs, 'opener-1')[0] === 'opener', 'hobbs opener');

// ---- slot-first declarations: the tapped slot decides ----
{
  const d0 = freshStarted();
  // All-rounder (primary) who can bat middle-order declares as middle-order
  // on a batting slot.
  ok(declarationForSlot(d0, sobers, 'bat-3') === 'middle-order', 'sobers declares MO on bat-3');
  // …but as all-rounder on a flex slot.
  ok(declarationForSlot(d0, sobers, 'flex-7') === 'all-rounder', 'sobers declares AR on flex-7');
  // A still-needed primary wicketkeeper declares as wicketkeeper…
  const dhoni = mk('dhoni', 'Dhoni', 'wicketkeeper', ['middle-order']);
  // on the keeper's spot, and bats middle-order on 3–5 …
  ok(declarationForSlot(d0, dhoni, 'bat-6') === 'wicketkeeper', 'needed keeper declares WK on bat-6');
  ok(declarationForSlot(d0, dhoni, 'bat-3') === 'middle-order', 'keeper-batter on bat-3 declares MO');
  // …and so does a secondary keeper (e.g. Sangakkara, primary middle-order)
  // — the user's reported case: he must be pickable as the wicketkeeper.
  ok(declarationForSlot(d0, sanga, 'bat-6') === 'wicketkeeper', 'needed secondary keeper declares WK on bat-6');
  // …and falls back to middle-order once the keeper slot is filled.
  let d1 = applyDraftPick(d0, gilchrist, 'bat-6', 'wicketkeeper');
  ok(d1 !== d0, 'keeper pick applies');
  ok(declarationForSlot(d1, dhoni, 'bat-4') === 'middle-order', 'unneeded keeper declares MO');
  ok(declarationForSlot(d1, sanga, 'bat-4') === 'middle-order', 'unneeded secondary keeper declares MO');
  // No legal declaration → null (dead-end slots don't glow).
  ok(declarationForSlot(d0, warne, 'bat-3') === null, 'warne has no batting declaration');
}

// ---- role chooser contract: shown iff >1 legal declaration ----
{
  const d0 = freshStarted();
  // Every batting slot now has one declaration, so Sangakkara never needs
  // the chooser: keeper on bat-6, middle-order on 3–5.
  const chLegal = placementOptions(d0, sanga, 'bat-3').filter((o) => !o.reason).map((o) => o.role);
  ok(chLegal.length === 1 && chLegal[0] === 'middle-order', 'sanga on bat-3: single MO declaration');
  const chLegal6 = placementOptions(d0, sanga, 'bat-6').filter((o) => !o.reason).map((o) => o.role);
  ok(chLegal6.length === 1 && chLegal6[0] === 'wicketkeeper', 'sanga on bat-6: single WK declaration');
  // Keeper filled: single declaration, no chooser.
  const d1 = applyDraftPick(d0, gilchrist, 'bat-6', 'wicketkeeper');
  const chLegal1 = placementOptions(d1, sanga, 'bat-4').filter((o) => !o.reason);
  ok(chLegal1.length === 1 && chLegal1[0].role === 'middle-order', 'no chooser once keeper filled');
  // Dual AR/SP on a flex slot: chooser (AR / SP), AR suggested (slot order).
  const kLegal = placementOptions(d0, kallis, 'flex-7').filter((o) => !o.reason).map((o) => o.role);
  ok(kLegal.length === 2 && kLegal.includes('all-rounder') && kLegal.includes('spinner'), 'chooser: kallis has 2 legal roles');
  ok(declarationForSlot(d0, kallis, 'flex-7') === 'all-rounder', 'chooser: suggested role is AR');
  // Single-role players never see the chooser.
  ok(placementOptions(d0, sobers, 'bat-3').filter((o) => !o.reason).length === 1, 'no chooser: sobers on bat-3');
  ok(placementOptions(d0, warne, 'flex-7').filter((o) => !o.reason).length === 1, 'no chooser: warne on flex-7');
}

// ---- draft driver: R1 = 1 pick, R2+ = 2 picks ----
function freshStarted(): DraftState {
  return applySpinResult(createDraft(), 'legends', 'Australia');
}
function spinNext(s: DraftState): DraftState {
  return applySpinResult(s, '1990s', 'Australia');
}
function pick(s: DraftState, p: NormalizedPlayer, slot: string, role?: XiRole): DraftState {
  const r = role ?? defaultDeclaredRole(p, slot)!;
  const n = applyDraftPick(s, p, slot, r);
  ok(n !== s, `pick applies: ${p.name} -> ${slot} as ${r}`);
  return n;
}

// Shape 2SP draft: 2O + 3MO + 1WK + 2SP + 3F
let d = freshStarted();
d = pick(d, hobbs, 'opener-1', 'opener');
d = spinNext(d);
const hutton = mk('hutton', 'Hutton', 'opener');
d = pick(d, hutton, 'opener-2', 'opener');
const mo1 = mk('mo1', 'MO One', 'middle-order'), mo2 = mk('mo2', 'MO Two', 'middle-order');
d = pick(d, mo1, 'bat-3', 'middle-order');
d = spinNext(d);
const mo3 = mk('mo3', 'MO Three', 'middle-order');
d = pick(d, mo2, 'bat-4', 'middle-order');
d = pick(d, mo3, 'bat-5', 'middle-order');
d = spinNext(d);
d = pick(d, gilchrist, 'bat-6', 'wicketkeeper');
d = pick(d, warne, 'flex-7', 'spinner');
d = spinNext(d);
const warne2 = mk('warne2', 'Warne Two', 'spinner');
const f1 = mk('f1', 'Fast One', 'fast-bowler'), f2 = mk('f2', 'Fast Two', 'fast-bowler');
d = pick(d, warne2, 'flex-8', 'spinner');
d = pick(d, f1, 'fast-1', 'fast-bowler');
d = spinNext(d);
d = pick(d, f2, 'fast-2', 'fast-bowler');
const f3 = mk('f3', 'Fast Three', 'fast-bowler');
const f4 = mk('f4', 'Fast Four', 'fast-bowler');
// 10 picks made (2O + 3MO + 1WK + 2SP + 2F); a third spinner is hard-blocked (cap 2)
const warne3 = mk('warne3', 'Warne Three', 'spinner');
ok(validatePoolPick(d, warne3) === 'Your XI already has its two spinners.', 'spinner cap reason');
d = pick(d, f3, 'fast-3', 'fast-bowler');
ok(d.gameComplete, 'draft complete');
ok(isXIValid(d), '2SP XI valid');
{
  // The final round's picks can still be swapped after the XI is complete; earlier rounds cannot.
  const reopened = applyDraftDeselect(d, 'f3');
  ok(!reopened.gameComplete && reopened.selectedPlayers.length === 10 && reopened.slots['fast-3'] === null, 'removing a final-round pick reopens the XI');
  ok(validatePoolPick(reopened, f4) === null, 'another player from the final draw can take the place');
  ok(applyDraftDeselect(d, 'f1') === d, 'a pick from an earlier round stays locked');
}
const c = countsOf(d);
ok(c.opener === 2 && c['middle-order'] === 3 && c.wicketkeeper === 1 && c.spinner === 2 && c['fast-bowler'] === 3, '2SP counts', c);

// Shape 2AR: 2O + 3MO + 1WK + 2AR + 3FB — both flex slots take all-rounders
let a = freshStarted();
a = pick(a, hobbs, 'opener-1', 'opener');
a = spinNext(a);
a = pick(a, hutton, 'opener-2', 'opener');
a = pick(a, mo1, 'bat-3', 'middle-order');
a = spinNext(a);
a = pick(a, mo2, 'bat-4', 'middle-order');
a = pick(a, mo3, 'bat-5', 'middle-order');
a = spinNext(a);
a = pick(a, gilchrist, 'bat-6', 'wicketkeeper');
a = pick(a, botham, 'flex-7', 'all-rounder');
a = spinNext(a);
a = pick(a, sobers, 'flex-8', 'all-rounder');
a = pick(a, f1, 'fast-1', 'fast-bowler');
a = spinNext(a);
a = pick(a, f2, 'fast-2', 'fast-bowler');
// 10 picks: 2O + 3MO + 1WK + 2AR + 2F. A spinner fits no remaining shape,
// and a third all-rounder is capped -> both hard-blocked.
const spBlock = validatePoolPick(a, warne);
ok(spBlock !== null, 'spinner blocked once 2AR shape locks', spBlock);
const botham3 = mk('botham3', 'Botham Three', 'all-rounder');
ok(validatePoolPick(a, botham3) === 'Your XI already has its two all-rounders.', 'AR cap reason');
a = pick(a, f3, 'fast-3', 'fast-bowler');
ok(isXIValid(a), '2AR XI valid');

// Shape AR+SP: 2O + 3MO + 1WK + 1AR + 1SP + 3FB (the house shape)
let e = freshStarted();
e = pick(e, hobbs, 'opener-1', 'opener');
e = spinNext(e);
e = pick(e, hutton, 'opener-2', 'opener');
e = pick(e, mo1, 'bat-3', 'middle-order');
e = spinNext(e);
e = pick(e, mo2, 'bat-4', 'middle-order');
e = pick(e, mo3, 'bat-5', 'middle-order');
e = spinNext(e);
e = pick(e, gilchrist, 'bat-6', 'wicketkeeper');
e = pick(e, sobers, 'flex-7', 'all-rounder');
e = spinNext(e);
e = pick(e, warne, 'flex-8', 'spinner');
e = pick(e, f1, 'fast-1', 'fast-bowler');
e = spinNext(e);
e = pick(e, f2, 'fast-2', 'fast-bowler');
e = pick(e, f3, 'fast-3', 'fast-bowler');
ok(isXIValid(e), 'AR+SP XI valid');
const cc = countsOf(e);
ok(cc['middle-order'] === 3 && cc['all-rounder'] === 1 && cc.spinner === 1, 'AR+SP counts', cc);

// ---- hard block: per-role caps ----
let k = freshStarted();
k = pick(k, hobbs, 'opener-1', 'opener');
k = spinNext(k);
k = pick(k, hutton, 'opener-2', 'opener');
const op3 = mk('op3', 'Opener Three', 'opener');
const capR = validatePoolPick(k, op3);
ok(capR === 'Both opener spots are filled.', 'opener cap reason', capR);
k = pick(k, mo1, 'bat-3', 'middle-order');
k = spinNext(k);
k = pick(k, mo2, 'bat-4', 'middle-order');
k = pick(k, gilchrist, 'bat-6', 'wicketkeeper');
k = spinNext(k); // round 4
// keeper-capped multi-role player can still go as a batter (MO at 2 < 3)
const sangaFree = validatePoolPick(k, sanga);
ok(sangaFree === null, 'sanga still pickable as MO when only WK capped', sangaFree);
k = pick(k, mo3, 'bat-5', 'middle-order');
k = pick(k, f1, 'fast-1', 'fast-bowler');
k = spinNext(k); // round 5
k = pick(k, f2, 'fast-2', 'fast-bowler');
const mo4 = mk('mo4', 'MO Four', 'middle-order');
ok(validatePoolPick(k, mo4) === 'Middle-order is at its maximum of 3 (3 picked).', 'MO cap reason');
const wk2 = mk('wk2', 'Keeper Two', 'wicketkeeper');
ok(validatePoolPick(k, wk2) === 'Your XI already has its wicketkeeper.', 'WK cap reason');
k = pick(k, f3, 'fast-3', 'fast-bowler');
k = spinNext(k); // round 6
ok(validatePoolPick(k, f4) === 'All three fast-bowler spots are filled.', 'FB cap reason');

// ---- hard block: combination (3MO + 2AR picked, spinner offered) ----
let cb = freshStarted();
cb = pick(cb, hobbs, 'opener-1', 'opener');
cb = spinNext(cb);
cb = pick(cb, hutton, 'opener-2', 'opener');
cb = pick(cb, mo1, 'bat-3', 'middle-order');
cb = spinNext(cb);
cb = pick(cb, mo2, 'bat-4', 'middle-order');
cb = pick(cb, mo3, 'bat-5', 'middle-order');
cb = spinNext(cb);
cb = pick(cb, botham, 'flex-7', 'all-rounder');
cb = pick(cb, sobers, 'flex-8', 'all-rounder');
cb = spinNext(cb); // round 5: both flex slots hold all-rounders now
const comboR = validatePoolPick(cb, warne);
ok(comboR !== null && comboR.includes('No open slots for Spinners'), 'slot block: 3MO+2AR then spinner', comboR);

// ---- hard block: R6 supply scenario ----
// 9 picks: 2O, 2MO, 0WK, 1AR, 1SP, 3F. R6 pool has ONE keeper-capable player (Sangakkara-type).
let s6 = freshStarted();
s6 = pick(s6, hobbs, 'opener-1', 'opener');
s6 = spinNext(s6);
s6 = pick(s6, hutton, 'opener-2', 'opener');
s6 = pick(s6, mo1, 'bat-3', 'middle-order');
s6 = spinNext(s6);
s6 = pick(s6, mo2, 'bat-4', 'middle-order');
s6 = pick(s6, sobers, 'flex-7', 'all-rounder');
s6 = spinNext(s6);
s6 = pick(s6, warne, 'flex-8', 'spinner');
s6 = pick(s6, f1, 'fast-1', 'fast-bowler');
s6 = spinNext(s6);
s6 = pick(s6, f2, 'fast-2', 'fast-bowler');
s6 = pick(s6, f3, 'fast-3', 'fast-bowler');
s6 = spinNext(s6); // round 6
const r6poolReal = [sanga, mo4, mk('f9', 'Fast Nine', 'fast-bowler')];
const sup = supplyFor(s6, r6poolReal);
// Sangakkara's card stays enabled (he can go as keeper on bat-6), but on
// bat-5 both declarations strand the keeper-only slot -> disabled there.
const sangaCard = validatePoolPick(s6, sanga, sup);
ok(sangaCard === null, 'sanga card enabled (keeper use is legal)', sangaCard);
const opts = placementOptions(s6, sanga, 'bat-5', sup);
const moOpt = opts.find((o) => o.role === 'middle-order');
const wkOpt = opts.find((o) => o.role === 'wicketkeeper');
ok(!!moOpt && moOpt.reason !== null && moOpt.reason.includes('strand'), 'chooser: MO option disabled (strands keeper)', moOpt?.reason);
ok(wkOpt === undefined, 'bat-5 never offers a WK declaration (keeper belongs on bat-6)', wkOpt);
// On the keeper-only slot itself, declaring as keeper is clean.
const opts6 = placementOptions(s6, sanga, 'bat-6', sup);
const wkOpt6 = opts6.find((o) => o.role === 'wicketkeeper');
ok(opts6.length === 1 && !!wkOpt6 && wkOpt6.reason === null, 'chooser: bat-6 offers only WK, enabled');
// (placing as WK works and keeps the AR+SP shape reachable)
const s6b = applyDraftPick(s6, sanga, 'bat-6', 'wicketkeeper');
ok(s6b !== s6, 'sanga placed as WK on the keeper-only slot');
// last pick: only a middle-order completes (AR+SP shape)
const lastR = validatePoolPick(s6b, mk('f10', 'Fast Ten', 'fast-bowler'), supplyFor(s6b, r6poolReal));
ok(lastR !== null, 'last pick blocks fast bowler (MO needed)', lastR);
const s6c = applyDraftPick(s6b, mo4, 'bat-5', 'middle-order');
ok(isXIValid(s6c), 'R6-completed XI valid (AR+SP shape, secondary keeper as WK)');

// ---- moves ----
// swap two middle-order batters keeps the XI valid
const mv1 = applyDraftMove(s6c, 'bat-3', 'bat-4');
ok(mv1 !== s6c, 'move applies');
ok(countsOf(mv1)['middle-order'] === 3 && isXIValid(mv1), 'MO swap keeps XI valid');
// keeper-only slot: the keeper cannot move off bat-6 (nothing else can fill it)
ok(validateSlotMove(s6c, 'bat-6', 'bat-5') !== null, 'keeper cannot leave keeper-only slot');
// swap opener with fast bowler -> rejected (incompatible)
ok(validateSlotMove(s6c, 'opener-1', 'fast-1') !== null, 'bad move rejected');
ok(applyDraftMove(s6c, 'opener-1', 'fast-1') === s6c, 'bad move no-op');
// move all-rounder between the two flex slots keeps AR
let mv = freshStarted();
mv = pick(mv, hobbs, 'opener-1', 'opener');
mv = spinNext(mv);
mv = pick(mv, botham, 'flex-7', 'all-rounder');
const mvAr = applyDraftMove(mv, 'flex-7', 'flex-8');
ok(mvAr !== mv && countsOf(mvAr)['all-rounder'] === 1, 'AR flex-to-flex move keeps AR');
ok(mvAr.slots['flex-8']?.role === 'all-rounder', 'declared AR travels between flex slots');
// moving the only spinner out to a bat slot is impossible (no compatible role) -> rejected
ok(validateSlotMove(e, 'flex-8', 'bat-3') !== null, 'spinner cannot move to bat slot', validateSlotMove(e, 'flex-8', 'bat-3'));
// a middle-order batter cannot move onto the keeper-only slot
ok(validateSlotMove(s6c, 'bat-4', 'bat-6') !== null, 'MO cannot move to keeper-only slot');
ok(applyDraftMove(s6c, 'bat-4', 'bat-6') === s6c, 'blocked MO move leaves state untouched');

// ---- deselect ----
const ds = applyDraftDeselect(s6b, sanga.id);
ok(ds.selectedPlayers.length === 9 && ds.slots['bat-6'] === null, 'deselect frees slot');

// ---- invalid XI guard ----
let bad = freshStarted();
bad = pick(bad, hobbs, 'opener-1', 'opener');
ok(!isXIValid(bad), 'incomplete XI not valid');

// ---- serialization v4 round-trip ----
const ser = serializeDraft(s6c);
ok(ser.v === 4, 'serializes as v4');
ok(ser.picks.every((p) => p.slot && p.role), 'v4 picks carry slot+role');
const res = deserializeDraft(JSON.parse(JSON.stringify(ser)), (uid) => {
  const all = [hobbs, hutton, mo1, mo2, mo4, sanga, sobers, warne, f1, f2, f3];
  return all.find((p) => p.uid === uid) ?? null;
});
ok(!!res && isXIValid(res), 'v4 round-trip valid');
ok(res!.slots['bat-6']?.role === 'wicketkeeper', 'v4 restores declared role');

// ---- v3 migration: spin-ar -> flex-7; bat-7 falls back to greedy ----
const v3blob = {
  v: 3, currentEra: '1990s', currentNation: 'Australia', currentRound: 5, gameComplete: false,
  spinHistory: [],
  picks: [
    { uid: hobbs.uid, round: 1, draftEra: 'legends', slot: 'opener-1', role: 'opener' },
    { uid: hutton.uid, round: 2, draftEra: '1990s', slot: 'opener-2', role: 'opener' },
    { uid: mo1.uid, round: 2, draftEra: '1990s', slot: 'bat-3', role: 'middle-order' },
    { uid: warne.uid, round: 3, draftEra: '1990s', slot: 'spin-ar', role: 'spinner' },
  ],
};
const res3 = deserializeDraft(v3blob, (uid) => {
  const all = [hobbs, hutton, mo1, warne];
  return all.find((p) => p.uid === uid) ?? null;
});
ok(!!res3, 'v3 migrates');
ok(res3!.slots['flex-7']?.uid === warne.uid && res3!.slots['flex-7']?.role === 'spinner', 'v3 spin-ar -> flex-7');

// ---- v2 migration: keeper slot -> bat-6 as wicketkeeper ----
const v2blob = {
  v: 2, currentEra: '1990s', currentNation: 'Australia', currentRound: 6, gameComplete: true,
  spinHistory: [],
  picks: [
    { uid: hobbs.uid, round: 1, draftEra: 'legends', slot: 'opener-1' },
    { uid: hutton.uid, round: 2, draftEra: '1990s', slot: 'opener-2' },
    { uid: mo1.uid, round: 2, draftEra: '1990s', slot: 'middle-1' },
    { uid: mo2.uid, round: 3, draftEra: '1990s', slot: 'middle-2' },
    { uid: mo3.uid, round: 3, draftEra: '1990s', slot: 'middle-3' },
    { uid: gilchrist.uid, round: 4, draftEra: '1990s', slot: 'keeper' },
    { uid: sobers.uid, round: 4, draftEra: '1990s', slot: 'all-rounder' },
    { uid: warne.uid, round: 4, draftEra: '1990s', slot: 'spinner' },
    { uid: f1.uid, round: 5, draftEra: '1990s', slot: 'fast-1' },
    { uid: f2.uid, round: 5, draftEra: '1990s', slot: 'fast-2' },
    { uid: f3.uid, round: 6, draftEra: '1990s', slot: 'fast-3' },
  ],
};
const res2 = deserializeDraft(v2blob, (uid) => {
  const all = [hobbs, hutton, mo1, mo2, mo3, gilchrist, sobers, warne, f1, f2, f3];
  return all.find((p) => p.uid === uid) ?? null;
});
ok(!!res2, 'v2 migrates');
ok(res2!.slots['bat-6']?.role === 'wicketkeeper' && res2!.slots['bat-6']?.uid === gilchrist.uid, 'v2 keeper -> bat-6 as WK', res2!.slots['bat-6']);
ok(isXIValid(res2!), 'migrated v2 XI valid (AR+SP shape)', countsOf(res2!));

// ---- v1 migration: no slots, greedy ----
const v1blob = {
  v: 1, currentEra: '1990s', currentNation: 'Australia', currentRound: 6, gameComplete: true,
  spinHistory: [],
  picks: [hobbs, hutton, mo1, mo2, mo3, gilchrist, sobers, warne, f1, f2, f3].map((p, i) => ({
    uid: p.uid, round: Math.min(6, 1 + Math.floor(i / 2)), draftEra: '1990s',
  })),
};
const res1 = deserializeDraft(v1blob, (uid) => {
  const all = [hobbs, hutton, mo1, mo2, mo3, gilchrist, sobers, warne, f1, f2, f3];
  return all.find((p) => p.uid === uid) ?? null;
});
ok(!!res1, 'v1 migrates');
ok(isXIValid(res1!), 'migrated v1 XI valid (AR+SP shape)', countsOf(res1!));

// ---- canFillRole ----
ok(canFillRole(s6.slots, r6poolReal, 'wicketkeeper'), 'canFillRole finds sanga as WK');
ok(!canFillRole({ ...s6.slots, 'bat-5': { uid: sanga.uid, role: 'wicketkeeper' } }, [mo4], 'wicketkeeper'), 'canFillRole false when no keeper left');

// ---- move stranding (supply-aware moves) ----
// Round 6, 9 picks: O2 MO2 WK1 AR1 SP1 F2 — the second fast bowler is a
// multi-role fast/middle-order player declared as a fast bowler; bat-5 is empty.
let mvd = createDraft();
const mvPick = (p: NormalizedPlayer, slot: string, role: XiRole) => {
  mvd = applyDraftPick(mvd, p, slot, role);
};
mvd = applySpinResult(mvd, '1990s', 'Australia');
mvPick(mk('o1', 'O1', 'opener'), 'opener-1', 'opener');
mvd = applySpinResult(mvd, '1990s', 'Australia');
mvPick(mk('o2', 'O2', 'opener'), 'opener-2', 'opener');
mvPick(mk('mmo1', 'M1', 'middle-order'), 'bat-3', 'middle-order');
mvd = applySpinResult(mvd, '1990s', 'Australia');
mvPick(mk('mmo2', 'M2', 'middle-order'), 'bat-4', 'middle-order');
mvPick(mk('mwk', 'WK', 'wicketkeeper'), 'bat-6', 'wicketkeeper');
mvd = applySpinResult(mvd, '1990s', 'Australia');
mvPick(mk('mar', 'AR', 'all-rounder'), 'flex-7', 'all-rounder');
mvPick(mk('msp', 'SP', 'spinner'), 'flex-8', 'spinner');
mvd = applySpinResult(mvd, '1990s', 'Australia');
mvPick(mk('mf1', 'F1', 'fast-bowler'), 'fast-1', 'fast-bowler');
const fmDual = mk('fmdual', 'FMDual', 'fast-bowler', ['middle-order']);
mvPick(fmDual, 'fast-2', 'fast-bowler');
mvd = applySpinResult(mvd, '1990s', 'Australia'); // round 6: futurePicks = 0
ok(mvd.selectedPlayers.length === 9 && mvd.currentRound === 6, 'move test draft at 9 picks, round 6');

const moOnly = mk('mox', 'MOX', 'middle-order');
const fastOnlyX = mk('fx', 'FX', 'fast-bowler');
// Moving the dual-role quick from fast-2 to bat-5 re-declares him as a
// batter; with no fast bowler left in the draw the XI would strand on F:1.
const strandReason = validateSlotMove(mvd, 'fast-2', 'bat-5', supplyFor(mvd, [moOnly]));
ok(
  typeof strandReason === 'string' && strandReason.includes('strand'),
  'move that strands a scarce role is blocked',
  strandReason,
);
// With a fast bowler still available in the draw, the same move is fine.
ok(
  validateSlotMove(mvd, 'fast-2', 'bat-5', supplyFor(mvd, [moOnly, fastOnlyX])) === null,
  'move allowed when the draw can still fill the role',
);
const moved = applyDraftMove(mvd, 'fast-2', 'bat-5', supplyFor(mvd, [moOnly, fastOnlyX]));
ok(
  moved.slots['bat-5']?.uid === fmDual.uid && moved.slots['bat-5']?.role === 'middle-order',
  'applyDraftMove re-declares role on move',
);
ok(
  applyDraftMove(mvd, 'fast-2', 'bat-5', supplyFor(mvd, [moOnly])) === mvd,
  'blocked move leaves state untouched',
);
// applyDraftPick threads supply: the client's 5-arg call commits the pick.
// (The draw still holds a fast bowler for the remaining deficit, so the
// supply check passes.)
const supPick = mk('supp', 'SupP', 'middle-order');
const mvd2 = applyDraftPick(mvd, supPick, 'bat-5', 'middle-order', supplyFor(mvd, [supPick, fastOnlyX]));
ok(
  mvd2.slots['bat-5']?.uid === supPick.uid && mvd2.slots['bat-5']?.role === 'middle-order',
  'applyDraftPick with supply commits',
);

// ---- pool groups: wicketkeeper stands alone ----
const wkGroup = POOL_GROUPS.find((g) => g.label === 'Wicketkeeper');
const moGroup = POOL_GROUPS.find((g) => g.label === 'Middle Order');
ok(!!wkGroup && wkGroup.roles.join(',') === 'wicketkeeper', 'pool has its own Wicketkeeper group');
ok(!!moGroup && !moGroup.roles.includes('wicketkeeper'), 'middle-order pool group excludes keepers');
ok(
  POOL_GROUPS.every((g) => g.roles.length > 0) &&
    new Set(POOL_GROUPS.flatMap((g) => g.roles)).size ===
      POOL_GROUPS.flatMap((g) => g.roles).length,
  'pool groups partition the six roles with no overlap',
);

// ---- same-group-only moves (post-completion rearrangement) ----
let gmov = createDraft();
gmov = applySpinResult(gmov, '1990s', 'Australia');
const arDual = mk('ga1', 'GA1', 'all-rounder', ['middle-order']);
gmov = applyDraftPick(gmov, arDual, 'bat-3', 'middle-order');
const sg = { sameGroupOnly: true };
ok(
  validateSlotMove(gmov, 'bat-3', 'bat-4', undefined, sg) === null,
  'same-group move allowed under sameGroupOnly',
);
const crossReason = validateSlotMove(gmov, 'bat-3', 'flex-7', undefined, sg);
ok(
  typeof crossReason === 'string' && crossReason.includes('rearranged within'),
  'cross-group move blocked once the XI is complete',
  crossReason,
);
ok(
  validateSlotMove(gmov, 'bat-3', 'flex-7') === null,
  'same cross-group move allowed while the draft is still open',
);
ok(
  applyDraftMove(gmov, 'bat-3', 'flex-7', undefined, sg) === gmov,
  'blocked post-completion move leaves state untouched',
);
const gmov2 = applyDraftMove(gmov, 'bat-3', 'flex-7');
ok(
  gmov2.slots['flex-7']?.uid === arDual.uid && gmov2.slots['bat-3'] === null,
  'cross-group move applies while the draft is open',
);
ok(gmov2.slots['flex-7']?.role === 'all-rounder', 'cross-group move re-declares for the flex slot');
const gmov3 = applyDraftMove(gmov, 'bat-3', 'bat-4', undefined, sg);
ok(
  gmov3.slots['bat-4']?.uid === arDual.uid && gmov3.slots['bat-3'] === null,
  'same-group move applies under sameGroupOnly',
);
ok(gmov3.slots['bat-4']?.role === 'middle-order', 'same-group move keeps the declaration');
ok(
  XI_SLOT_GROUP_LABELS['batting'] === 'Batting 3–6' &&
    XI_SLOT_GROUP_LABELS['flex'] === 'Spots 7–8' &&
    new Set(XI_SLOTS.map((s) => s.group)).size === 4,
  'slots carry exactly four groups',
);

// ---- respins: one era + one nation token per draft, forced redraw ----
let rs0 = freshStarted(); // round 1: legends|Australia
ok(rs0.eraRespinsLeft === 1 && rs0.nationRespinsLeft === 1, 'respin tokens start at 1 each');
ok(canRespinNation(rs0, 3) === true, 'nation respin available after round-1 draw');
ok(canRespinEra(rs0, 3) === false, 'era respin blocked in round 1');
ok(applyEraRespin(rs0, '1990s') === rs0, 'era respin in round 1 is a no-op');

const rsN = applyNationRespin(rs0, 'England');
ok(rsN !== rs0, 'nation respin applies');
ok(rsN.currentEra === 'legends' && rsN.currentNation === 'England', 'nation respin keeps era, replaces nation');
ok(rsN.nationRespinsLeft === 0 && rsN.eraRespinsLeft === 1, 'nation token consumed');
ok(rsN.currentRound === 1, 'respin does not advance the round');
ok(rsN.spinHistory.length === 1 && rsN.spinHistory[0].nation === 'England', 'history shows the replaced pair, not the rejected one');
ok(applyNationRespin(rsN, 'India') === rsN, 'exhausted nation token is a no-op');
ok(canRespinNation(rsN, 3) === false, 'canRespinNation false with 0 tokens');
ok(applyNationRespin(rs0, 'Australia') === rs0, 'respin to the current nation is a no-op');

let rsE = applySpinResult(freshStarted(), '1990s', 'Australia'); // round 2
ok(canRespinEra(rsE, 2) === true, 'era respin available from round 2');
const rsE2 = applyEraRespin(rsE, '2000s');
ok(rsE2.currentEra === '2000s' && rsE2.currentNation === 'Australia', 'era respin keeps nation, replaces era');
ok(rsE2.eraRespinsLeft === 0 && rsE2.nationRespinsLeft === 1, 'era token consumed');
ok(applyEraRespin(rsE, 'legends') === rsE, 'era respin onto an already-drawn pair is rejected');

// item 6 (owner, 2026-10-03): formats with no fixed first era may respin the era on the first spin
ok(canRespinEra(rs0, 3, true) === true, 'era respin allowed in round 1 when the format has no fixed first era');
const rs1E = applyEraRespin(rs0, '1990s', true);
ok(rs1E.currentEra === '1990s' && rs1E.currentNation === 'Australia' && rs1E.eraRespinsLeft === 0, 'round-1 era respin keeps the nation, replaces the era');
// item 7: the draw respun away from is remembered, for both kinds of respin
ok(JSON.stringify(rs1E.respunAway) === JSON.stringify(['legends|Australia']), 'era respin remembers the pair it left');
ok(JSON.stringify(rsN.respunAway) === JSON.stringify(['legends|Australia']), 'nation respin remembers the pair it left');
const rsBack = deserializeDraft(JSON.parse(JSON.stringify(serializeDraft(rsN))), () => null);
ok(!!rsBack && JSON.stringify(rsBack.respunAway) === JSON.stringify(['legends|Australia']), 'respun-away pairs survive save and restore');

let rsP = applyDraftPick(freshStarted(), hobbs, 'opener-1', 'opener');
ok(rsP.picksThisRound.length === 1, 'pick recorded for respin guard');
ok(applyNationRespin(rsP, 'England') === rsP, 'respin after a pick is a no-op');
ok(canRespinNation(rsP, 3) === false, 'canRespinNation false once picks are made');

const rsSer = serializeDraft(rsE2);
ok(rsSer.eraRespinsLeft === 0 && rsSer.nationRespinsLeft === 1, 'tokens serialized');
const rsDeser = deserializeDraft(rsSer, () => null);
ok(rsDeser !== null && rsDeser.eraRespinsLeft === 0 && rsDeser.nationRespinsLeft === 1, 'tokens survive serialize round-trip');
const rsOldBlob = { ...rsSer };
delete (rsOldBlob as Record<string, unknown>).eraRespinsLeft;
delete (rsOldBlob as Record<string, unknown>).nationRespinsLeft;
const rsDeserOld = deserializeDraft(rsOldBlob, () => null);
ok(rsDeserOld !== null && rsDeserOld.eraRespinsLeft === 1 && rsDeserOld.nationRespinsLeft === 1, 'pre-respin blobs default to 1 token each');

// ---- Design B moves: the destination slot decides the declaration ----
{
  // Botham (AR primary, MO secondary) slotted as an all-rounder on a flex
  // slot, then moved onto a batting slot — the batting slot can't take an
  // all-rounder declaration, so he re-declares as a middle-order batter.
  let cmv = freshStarted();
  cmv = pick(cmv, hobbs, 'opener-1', 'opener');
  cmv = spinNext(cmv);
  cmv = pick(cmv, botham, 'flex-7', 'all-rounder');
  ok(
    validateSlotMove(cmv, 'flex-7', 'bat-3') === null,
    'AR -> batting move is legal mid-draft',
    validateSlotMove(cmv, 'flex-7', 'bat-3'),
  );
  ok(
    moveDeclaration(cmv, 'flex-7', 'bat-3') === 'middle-order',
    'moveDeclaration re-declares as middle-order for the batting slot',
  );
  const cmv2 = applyDraftMove(cmv, 'flex-7', 'bat-3');
  ok(
    cmv2.slots['bat-3']?.role === 'middle-order',
    'flex -> batting move declares middle-order (Design B)',
  );
  ok(
    countsOf(cmv2)['all-rounder'] === 0 && countsOf(cmv2)['middle-order'] === 1,
    'counts follow the re-derived declaration',
  );
  // …which frees the flex slot, so a spinner becomes pickable afterwards.
  const warne2b = mk('warne2b', 'Warne', 'spinner');
  ok(
    validatePoolPick(cmv2, warne2b) === null,
    'spinner pickable once the AR vacates the flex slot',
    validatePoolPick(cmv2, warne2b),
  );
  const cmv2b = pick(cmv2, warne2b, 'flex-7', 'spinner');
  ok(
    countsOf(cmv2b)['middle-order'] === 1 && countsOf(cmv2b)['spinner'] === 1,
    'MO + spinner coexist (2SP shape stays reachable)',
  );
  // Flex-to-flex moves still preserve the declaration.
  const cmv4 = applyDraftMove(cmv, 'flex-7', 'flex-8');
  ok(
    cmv4.slots['flex-8']?.role === 'all-rounder',
    'flex-to-flex move keeps the all-rounder declaration',
  );
  // A destination that can't take any of the player's roles still blocks:
  // a middle-order-only player cannot move to a flex slot.
  const moOnly = mk('moOnly', 'MO Only', 'middle-order');
  let cmv5 = pick(cmv, moOnly, 'bat-5', 'middle-order');
  ok(
    moveDeclaration(cmv5, 'bat-5', 'flex-7') === null,
    'middle-order-only player cannot move to a flex slot',
  );
  // The right-pane label reads plain "Middle-order".
  ok(XI_ROLE_LABELS['middle-order'] === 'Middle-order', 'XI label drops "batter"');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) throw new Error('tests failed');

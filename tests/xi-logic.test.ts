import {
  createDraft, applySpinResult, applyDraftPick, applyDraftMove, applyDraftDeselect,
  validatePoolPick, validateSlotPlacement, validateSlotMove, placementOptions,
  declarableRoles, defaultDeclaredRole, countsOf, reachableShapes, isXIValid,
  serializeDraft, deserializeDraft, supplyFor, canFillRole,
  XI_SLOTS, XI_SIZE, XI_SHAPES, emptyCounts,
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

// ---- slot model ----
ok(XI_SLOTS.length === 11 && XI_SIZE === 11, 'eleven slots');
ok(XI_SLOTS[0].key === 'opener-1' && XI_SLOTS[7].key === 'spin-ar', 'slot order');
ok(XI_SHAPES.length === 3, 'three valid shapes');
ok(XI_SHAPES.every((s) => (Object.values(s) as number[]).reduce((a, b) => a + b, 0) === 11), 'shapes sum to 11');

// ---- declarable roles ----
const sanga = mk('sanga', 'Sangakkara', 'middle-order', ['wicketkeeper']);
const gilchrist = mk('gilchrist', 'Gilchrist', 'wicketkeeper');
const sobers = mk('sobers', 'Sobers', 'all-rounder', ['middle-order']);
const warne = mk('warne', 'Warne', 'spinner');
const kallis = mk('kallis', 'Kallis', 'all-rounder', ['spinner']);
const mcgrath = mk('mcgrath', 'McGrath', 'fast-bowler');
const bradman = mk('bradman', 'Bradman', 'middle-order');
const hobbs = mk('hobbs', 'Hobbs', 'opener');

ok(JSON.stringify(declarableRoles(sanga, 'bat-3')) === JSON.stringify(['middle-order', 'wicketkeeper']), 'sanga bat roles');
ok(defaultDeclaredRole(sanga, 'bat-3') === 'middle-order', 'sanga default MO');
ok(JSON.stringify(declarableRoles(sobers, 'bat-3')) === JSON.stringify(['middle-order', 'all-rounder']), 'sobers bat roles');
ok(defaultDeclaredRole(sobers, 'bat-3') === 'all-rounder', 'sobers default AR (primary)');
ok(JSON.stringify(declarableRoles(kallis, 'spin-ar')) === JSON.stringify(['spinner', 'all-rounder']), 'kallis slot8 roles');
ok(defaultDeclaredRole(kallis, 'spin-ar') === 'all-rounder', 'kallis default AR');
ok(declarableRoles(warne, 'bat-3').length === 0, 'warne cannot bat');
ok(declarableRoles(hobbs, 'opener-1')[0] === 'opener', 'hobbs opener');

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

// Shape B draft: 2O + 4MO + 1WK + 1SP + 3F
let d = freshStarted();
d = pick(d, hobbs, 'opener-1', 'opener');
d = spinNext(d);
const hutton = mk('hutton', 'Hutton', 'opener');
d = pick(d, hutton, 'opener-2', 'opener');
const mo1 = mk('mo1', 'MO One', 'middle-order'), mo2 = mk('mo2', 'MO Two', 'middle-order');
d = pick(d, mo1, 'bat-3', 'middle-order');
d = spinNext(d);
const mo3 = mk('mo3', 'MO Three', 'middle-order'), mo4 = mk('mo4', 'MO Four', 'middle-order');
d = pick(d, mo3, 'bat-4', 'middle-order');
d = pick(d, mo4, 'bat-5', 'middle-order');
d = spinNext(d);
d = pick(d, gilchrist, 'bat-6', 'wicketkeeper');
d = pick(d, warne, 'spin-ar', 'spinner');
d = spinNext(d);
const f1 = mk('f1', 'Fast One', 'fast-bowler'), f2 = mk('f2', 'Fast Two', 'fast-bowler');
d = pick(d, f1, 'fast-1', 'fast-bowler');
d = pick(d, f2, 'fast-2', 'fast-bowler');
d = spinNext(d);
const f3 = mk('f3', 'Fast Three', 'fast-bowler');
d = pick(d, f3, 'fast-3', 'fast-bowler');
const f4 = mk('f4', 'Fast Four', 'fast-bowler');
// 10 picks made; an 11th fast bowler must be hard-blocked (cap 3)
const r11 = validatePoolPick(d, f4);
ok(r11 === 'All three fast-bowler spots are filled.', '11th pick blocks 4th fast bowler', r11);
const moLast = mk('moLast', 'MO Last', 'middle-order');
d = pick(d, moLast, 'bat-7', 'middle-order');
ok(d.gameComplete, 'draft complete');
ok(isXIValid(d), 'shape B XI valid');
const c = countsOf(d);
ok(c.opener === 2 && c['middle-order'] === 4 && c.wicketkeeper === 1 && c.spinner === 1 && c['fast-bowler'] === 3, 'shape B counts', c);

// Shape A: 4MO + AR, no spinner — AR takes the flexible spot 8
let a = freshStarted();
a = pick(a, hobbs, 'opener-1', 'opener');
a = spinNext(a);
a = pick(a, hutton, 'opener-2', 'opener');
a = pick(a, mo1, 'bat-3', 'middle-order');
a = spinNext(a);
a = pick(a, mo2, 'bat-4', 'middle-order');
a = pick(a, mo3, 'bat-5', 'middle-order');
a = spinNext(a);
a = pick(a, mo4, 'bat-6', 'middle-order');
a = pick(a, gilchrist, 'bat-7', 'wicketkeeper');
a = spinNext(a);
a = pick(a, sobers, 'spin-ar', 'all-rounder'); // all-rounder on the spinner row
a = pick(a, f1, 'fast-1', 'fast-bowler');
a = spinNext(a);
a = pick(a, f2, 'fast-2', 'fast-bowler');
// 10 picks: 2O + 4MO + 1WK + 1AR + 2F. A spinner has no compatible slot left
// and the shape is locked -> hard-blocked (any reason).
const spBlock = validatePoolPick(a, warne);
ok(spBlock !== null, 'spinner blocked once 4MO+AR shape locks', spBlock);
a = pick(a, f3, 'fast-3', 'fast-bowler');
ok(isXIValid(a), 'shape A XI valid (AR at spot 8)');

// Shape C: 3MO + AR + SP
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
e = pick(e, sobers, 'bat-7', 'all-rounder');
e = spinNext(e);
e = pick(e, warne, 'spin-ar', 'spinner');
e = pick(e, f1, 'fast-1', 'fast-bowler');
e = spinNext(e);
e = pick(e, f2, 'fast-2', 'fast-bowler');
e = pick(e, f3, 'fast-3', 'fast-bowler');
ok(isXIValid(e), 'shape C XI valid');
const cc = countsOf(e);
ok(cc['middle-order'] === 3 && cc['all-rounder'] === 1 && cc.spinner === 1, 'shape C counts', cc);

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
k = pick(k, mo3, 'bat-5', 'middle-order');
k = spinNext(k);
k = pick(k, gilchrist, 'bat-6', 'wicketkeeper');
// keeper-capped multi-role player can still go as a batter (MO at 3 < 4)
const sangaFree = validatePoolPick(k, sanga);
ok(sangaFree === null, 'sanga still pickable as MO when only WK capped', sangaFree);
k = pick(k, mo4, 'bat-7', 'middle-order');
k = spinNext(k); // round 5
const mo5 = mk('mo5', 'MO Five', 'middle-order');
ok(validatePoolPick(k, mo5) === 'Middle-order is at its maximum of 4 (4 picked).', 'MO cap reason');
const wk2 = mk('wk2', 'Keeper Two', 'wicketkeeper');
ok(validatePoolPick(k, wk2) === 'Your XI already has its wicketkeeper.', 'WK cap reason');

// ---- hard block: combination (4MO + AR picked, spinner offered) ----
let cb = freshStarted();
cb = pick(cb, hobbs, 'opener-1', 'opener');
cb = spinNext(cb);
cb = pick(cb, hutton, 'opener-2', 'opener');
cb = pick(cb, mo1, 'bat-3', 'middle-order');
cb = spinNext(cb);
cb = pick(cb, mo2, 'bat-4', 'middle-order');
cb = pick(cb, mo3, 'bat-5', 'middle-order');
cb = spinNext(cb);
cb = pick(cb, mo4, 'bat-6', 'middle-order');
cb = pick(cb, sobers, 'bat-7', 'all-rounder');
cb = spinNext(cb); // round 5: spin-ar still free, so warne reaches the combo check
const comboR = validatePoolPick(cb, warne);
ok(comboR !== null && comboR.includes('no valid XI combination'), 'combo block: 4MO+AR then spinner', comboR);

// ---- hard block: R6 supply scenario ----
// 9 picks: 2O, 3MO, 0WK, 0AR, 1SP, 3F. R6 pool has ONE keeper-capable player (Sangakkara-type).
let s6 = freshStarted();
s6 = pick(s6, hobbs, 'opener-1', 'opener');
s6 = spinNext(s6);
s6 = pick(s6, hutton, 'opener-2', 'opener');
s6 = pick(s6, mo1, 'bat-3', 'middle-order');
s6 = spinNext(s6);
s6 = pick(s6, mo2, 'bat-4', 'middle-order');
s6 = pick(s6, mo3, 'bat-5', 'middle-order');
s6 = spinNext(s6);
s6 = pick(s6, warne, 'spin-ar', 'spinner');
s6 = pick(s6, f1, 'fast-1', 'fast-bowler');
s6 = spinNext(s6);
s6 = pick(s6, f2, 'fast-2', 'fast-bowler');
s6 = pick(s6, f3, 'fast-3', 'fast-bowler');
s6 = spinNext(s6); // round 6
const r6poolReal = [sanga, mo4, mk('f9', 'Fast Nine', 'fast-bowler')];
const sup = supplyFor(s6, r6poolReal);
// Sangakkara's card stays enabled (he can go as keeper), but declaring him
// middle-order would strand the keeper slot -> that option is disabled.
const sangaCard = validatePoolPick(s6, sanga, sup);
ok(sangaCard === null, 'sanga card enabled (keeper use is legal)', sangaCard);
const opts = placementOptions(s6, sanga, 'bat-6', sup);
const moOpt = opts.find((o) => o.role === 'middle-order');
const wkOpt = opts.find((o) => o.role === 'wicketkeeper');
ok(!!moOpt && moOpt.reason !== null && moOpt.reason.includes('strand'), 'chooser: MO option disabled (strands keeper)', moOpt?.reason);
ok(!!wkOpt && wkOpt.reason === null, 'chooser: WK option enabled');
// (placing as WK works and keeps shape B reachable)
const s6b = applyDraftPick(s6, sanga, 'bat-6', 'wicketkeeper');
ok(s6b !== s6, 'sanga placed as WK');
// last pick: only a middle-order completes (shape B)
const lastR = validatePoolPick(s6b, mk('f10', 'Fast Ten', 'fast-bowler'), supplyFor(s6b, r6poolReal));
ok(lastR !== null, 'last pick blocks fast bowler (MO needed)', lastR);
const s6c = applyDraftPick(s6b, mo4, 'bat-7', 'middle-order');
ok(isXIValid(s6c), 'R6-completed XI valid (shape B, secondary keeper as WK)');

// ---- moves ----
// move keeper within batting slots keeps role
const mv1 = applyDraftMove(s6c, 'bat-6', 'bat-3');
ok(mv1 !== s6c, 'move applies');
ok(countsOf(mv1).wicketkeeper === 1 && isXIValid(mv1), 'move keeps XI valid');
// swap opener with fast bowler -> rejected (incompatible)
ok(validateSlotMove(s6c, 'opener-1', 'fast-1') !== null, 'bad move rejected');
ok(applyDraftMove(s6c, 'opener-1', 'fast-1') === s6c, 'bad move no-op');
// move all-rounder to the empty spinner slot keeps AR (fresh mid-draft state)
let mv = freshStarted();
mv = pick(mv, hobbs, 'opener-1', 'opener');
mv = spinNext(mv);
mv = pick(mv, sobers, 'bat-7', 'all-rounder');
const mvAr = applyDraftMove(mv, 'bat-7', 'spin-ar');
ok(mvAr !== mv && countsOf(mvAr)['all-rounder'] === 1, 'AR move to spot 8 keeps AR');
ok(mvAr.slots['spin-ar']?.role === 'all-rounder', 'declared AR travels to spot ');
// moving the only spinner out to a bat slot is impossible (no compatible role) -> rejected
ok(validateSlotMove(e, 'spin-ar', 'bat-3') !== null, 'spinner cannot move to bat slot', validateSlotMove(e, 'spin-ar', 'bat-3'));
// swap two middle-order batters
const sw = applyDraftMove(s6c, 'bat-4', 'bat-5');
ok(sw !== s6c && isXIValid(sw), 'MO swap keeps valid');

// ---- deselect ----
const ds = applyDraftDeselect(s6b, sanga.id);
ok(ds.selectedPlayers.length === 9 && ds.slots['bat-6'] === null, 'deselect frees slot');

// ---- invalid XI guard ----
let bad = freshStarted();
bad = pick(bad, hobbs, 'opener-1', 'opener');
ok(!isXIValid(bad), 'incomplete XI not valid');

// ---- serialization v3 round-trip ----
const ser = serializeDraft(s6c);
ok(ser.v === 3, 'serializes as v3');
ok(ser.picks.every((p) => p.slot && p.role), 'v3 picks carry slot+role');
const res = deserializeDraft(JSON.parse(JSON.stringify(ser)), (uid) => {
  const all = [hobbs, hutton, mo1, mo2, mo3, mo4, sanga, warne, f1, f2, f3];
  return all.find((p) => p.uid === uid) ?? null;
});
ok(!!res && isXIValid(res), 'v3 round-trip valid');
ok(res!.slots['bat-6']?.role === 'wicketkeeper', 'v3 restores declared role');

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
    { uid: warne.uid, round: 4, draftEra: '1990s', slot: 'spinner' },
    { uid: f1.uid, round: 5, draftEra: '1990s', slot: 'fast-1' },
    { uid: f2.uid, round: 5, draftEra: '1990s', slot: 'fast-2' },
    { uid: mo4.uid, round: 6, draftEra: '1990s', slot: 'middle-1' }, // duplicate slot -> ignored, greedy
    { uid: f3.uid, round: 6, draftEra: '1990s', slot: 'fast-3' },
  ],
};
const res2 = deserializeDraft(v2blob, (uid) => {
  const all = [hobbs, hutton, mo1, mo2, mo3, mo4, gilchrist, warne, f1, f2, f3];
  return all.find((p) => p.uid === uid) ?? null;
});
ok(!!res2, 'v2 migrates');
ok(res2!.slots['bat-6']?.role === 'wicketkeeper' && res2!.slots['bat-6']?.uid === gilchrist.uid, 'v2 keeper -> bat-6 as WK', res2!.slots['bat-6']);
ok(isXIValid(res2!), 'migrated v2 XI valid');

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
ok(isXIValid(res1!), 'migrated v1 XI valid (shape C)', countsOf(res1!));

// ---- canFillRole ----
ok(canFillRole(s6.slots, r6poolReal, 'wicketkeeper'), 'canFillRole finds sanga as WK');
ok(!canFillRole({ ...s6.slots, 'bat-6': { uid: sanga.uid, role: 'wicketkeeper' } }, [mo4], 'wicketkeeper'), 'canFillRole false when no keeper left');

// ---- move stranding (supply-aware moves) ----
// Round 6, 9 picks: O2 MO2 WK1 AR1 SP1 F2 — the second fast bowler is a
// multi-role fast/middle-order player declared as a fast bowler.
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
mvPick(mk('mwk', 'WK', 'wicketkeeper'), 'bat-5', 'wicketkeeper');
mvd = applySpinResult(mvd, '1990s', 'Australia');
mvPick(mk('mar', 'AR', 'all-rounder'), 'bat-6', 'all-rounder');
mvPick(mk('msp', 'SP', 'spinner'), 'spin-ar', 'spinner');
mvd = applySpinResult(mvd, '1990s', 'Australia');
mvPick(mk('mf1', 'F1', 'fast-bowler'), 'fast-1', 'fast-bowler');
const fmDual = mk('fmdual', 'FMDual', 'fast-bowler', ['middle-order']);
mvPick(fmDual, 'fast-2', 'fast-bowler');
mvd = applySpinResult(mvd, '1990s', 'Australia'); // round 6: futurePicks = 0
ok(mvd.selectedPlayers.length === 9 && mvd.currentRound === 6, 'move test draft at 9 picks, round 6');

const moOnly = mk('mox', 'MOX', 'middle-order');
const fastOnlyX = mk('fx', 'FX', 'fast-bowler');
// Moving the dual-role quick from fast-2 to bat-7 re-declares him as a
// batter; with no fast bowler left in the draw the XI would strand on F:1.
const strandReason = validateSlotMove(mvd, 'fast-2', 'bat-7', supplyFor(mvd, [moOnly]));
ok(
  typeof strandReason === 'string' && strandReason.includes('strand'),
  'move that strands a scarce role is blocked',
  strandReason,
);
// With a fast bowler still available in the draw, the same move is fine.
ok(
  validateSlotMove(mvd, 'fast-2', 'bat-7', supplyFor(mvd, [moOnly, fastOnlyX])) === null,
  'move allowed when the draw can still fill the role',
);
const moved = applyDraftMove(mvd, 'fast-2', 'bat-7', supplyFor(mvd, [moOnly, fastOnlyX]));
ok(
  moved.slots['bat-7']?.uid === fmDual.uid && moved.slots['bat-7']?.role === 'middle-order',
  'applyDraftMove re-declares role on move',
);
ok(
  applyDraftMove(mvd, 'fast-2', 'bat-7', supplyFor(mvd, [moOnly])) === mvd,
  'blocked move leaves state untouched',
);
// applyDraftPick threads supply: the client's 5-arg call commits the pick.
// (The draw still holds a fast bowler for the remaining deficit, so the
// supply check passes.)
const supPick = mk('supp', 'SupP', 'middle-order');
const mvd2 = applyDraftPick(mvd, supPick, 'bat-7', 'middle-order', supplyFor(mvd, [supPick, fastOnlyX]));
ok(
  mvd2.slots['bat-7']?.uid === supPick.uid && mvd2.slots['bat-7']?.role === 'middle-order',
  'applyDraftPick with supply commits',
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) throw new Error('tests failed');

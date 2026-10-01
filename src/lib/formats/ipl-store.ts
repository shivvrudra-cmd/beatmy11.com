/**
 * ipl-store.ts — the IPL view of ./white-ball-store (kept so IPL code reads naturally).
 */
import { wbPlayers, wbPlayersByEra, wbSpinCombos } from './white-ball-store';

/** Draftable IPL players (10+ matches, every declarable role scorable). */
export const iplPlayers = () => wbPlayers('ipl');
/** Season block → normalized entries (one per player spell in that block). */
export const iplPlayersByBlock = () => wbPlayersByEra('ipl');
/** Every franchise × season-block draw that has players. */
export const iplSpinCombos = () => wbSpinCombos('ipl');

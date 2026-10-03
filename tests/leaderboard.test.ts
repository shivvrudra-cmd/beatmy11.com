/**
 * The daily leaderboard's wording (src/lib/leaderboard.ts). The network and storage parts are
 * covered by tests/e2e/daily-board.spec.ts and tests/worker.test.ts.
 */
import { ordinal, boardLine } from '../src/lib/leaderboard';

let pass = 0, fail = 0;
const ok = (cond: boolean, name: string, extra?: unknown) => {
  if (cond) pass++;
  else { fail++; console.log(`FAIL: ${name}`, extra ?? ''); }
};

ok([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(ordinal).join() === '1st,2nd,3rd,4th,11th,12th,13th,21st,22nd,23rd,101st,111th,112th', 'ordinals', [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(ordinal).join());
ok(boardLine({ total: 0, beat: 0 }, 'World XI') === 'No scores on today’s board yet.', 'an empty board says so');
ok(boardLine({ total: 340, beat: 78, rank: 12 }, 'World XI') === 'You are 12th of 340 today. 23% beat the World XI.', 'place and the share who won', boardLine({ total: 340, beat: 78, rank: 12 }, 'World XI'));
ok(boardLine({ total: 3, beat: 1, rank: 2 }, 'All-Star XI') === 'You are 2nd of 3 today.', 'no percentage from fewer than five entries');
ok(boardLine({ total: 40, beat: 0 }, 'All-Star XI') === '40 on today’s board. 0% beat the All-Star XI.', 'without a rank it gives the count');
ok(boardLine({ total: 10, beat: 2, rank: 14 }, 'World XI').startsWith('You are 10th of 10'), 'a rank past the end is shown as last');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

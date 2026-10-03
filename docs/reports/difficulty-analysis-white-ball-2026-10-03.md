# Is ODI too easy? Difficulty measurements (2026-10-03, item 11)

Nothing in the game was changed for this report. It only measures. The numbers come from
`scripts/cricsheet/calibrate-white-ball.ts`, run with `ANALYZE=1` (new, writes nothing): 600
simulated drafts per row, the real draft rules, the series ladder after the "no draws" change.

## The short version

The game is not too easy for an ordinary drafter (about 16% win in ODI, close to the 15% target),
but it **is easy for someone who knows cricket well**: a drafter who picks the highest-rated
players wins the ODI series **56% of the time**, and 73% to 78% in T20I and IPL. In the Test game
the same kind of drafter wins about 27%. So the white-ball formats are much easier to "solve"
than Test. If "ODI feels too easy" came from your own play, this is the likely reason.

## Four kinds of drafter, current difficulty

| Drafter | ODI | T20I | IPL |
|---|---|---|---|
| Careless (misjudges players a lot) | 2.0% | 2.5% | 2.8% |
| **Human-like** (reads the card numbers, some misjudging) — the one the 15% target is set on | **16.2%** | **14.0%** | **14.4%** |
| Expert (sees the hidden ratings, small mistakes) | 48.8% | 70.9% | 69.8% |
| Perfect (sees the hidden ratings, no mistakes) | 55.8% | 78.3% | 73.3% |

The Test game: human-like 6.7%, score-greedy 26.6% (2026-10-01 figures, not re-run).

The opponent is not weak: ODI World XI scores 92.4, and the best draft a perfect drafter produced
scored 92.1. Beating it needs an almost perfect XI, and a drafter who can see the ratings
manages that more than half the time.

## Option A: raise the par (the simplest, one number per format)

Win rate by par, ODI. Par now is −9. Higher par = harder.

| Par | −9 (now) | −8 | −7 | −6 | −5 | −4 | −3 |
|---|---|---|---|---|---|---|---|
| Human-like | 16.2% | 10.7% | 7.3% | 4.8% | not run | not run | not run |
| Perfect | 55.8% | 47.8% | 41.8% | 35.3% | 27.3% | 19.8% | 12.5% |

To bring the expert to Test's 27%, ODI par would be about **−5**, but ordinary drafters would
then win under 5% (4.8% already at −6; −5 and −4 were not run). There is no single par that is fair to both: that is the real
finding. T20I would need about −5.5 (expert 25%) and IPL about −11 (expert 28%), with ordinary
drafters at a few percent (not measured at those pars).

## Option B: change some World XI players (your call, your list)

The ODI World XI would have to score higher or lower; it only moves the same scale (a stronger
XI is the same as lowering par). It does not fix the gap between ordinary and expert drafters.

## Option C: change the weights (biggest change)

Nothing measured yet. The gap exists because the hidden ratings are predictable from the stats
shown on the card; changing weights would change which players are "good" for everyone and
re-rank every XI. I would not start here.

## What I would recommend (your decision)

Keep the ordinary drafter at about 15%, and accept that experts win more often in white-ball
formats; **or** pick a middle target (say 10% for ordinary drafters, which means par about −8 in
ODI, expert about 48%). Say which, and I will set the par and re-run the calibration (this is a
scoring change, so I will not do it without your yes).

A fairer long-term fix for the expert gap, if it matters to you, is to make draws harder to
"solve": for example fewer players per draw, or hiding more of the numbers. That is a design
change, not a number change.

## How to reproduce

```
npx esbuild scripts/cricsheet/calibrate-white-ball.ts --bundle --platform=node --format=cjs \
  --outfile=.test-dist/calibrate-white-ball.cjs --log-level=error
ANALYZE=1 DRAFTER=rating MISJUDGE=0 PAR_SPAN=10 node .test-dist/calibrate-white-ball.cjs odi
```

`DRAFTER=human` (default) uses the card numbers; `MISJUDGE` is how wrong the drafter is
(0.12 = the human-like drafter, 0.35 = careless).

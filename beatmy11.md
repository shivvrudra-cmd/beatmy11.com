# BeatMy11.com - Complete Project Specification

## Project Vision

BeatMy11 is a fantasy cricket team builder inspired by 82-0.com. Users build an all-time XI through a strategic spin-based selection process and compete against a house "Beat My 11" team. The result is a shareable 5-match Test series scoreline.

**Core Hook**: "Your XI beat Beat My 11 3–2"

---

## Game Mechanics

### Team Composition (12 players, 11 active)

| Role | Count | Notes |
|------|-------|-------|
| Openers | 2 | Max 1 per spin |
| Middle-order | 3 | - |
| Wicketkeeper | 1 | Max 1 per spin, required |
| All-rounders | 2 | Max 1 per spin |
| Bowlers | 4 | - |
| **Total** | **12** | User designates 12th man |

### Spin System

- **6 spins** × 2 picks = 12 players
- Each spin generates: **Nation + Era**
- User picks 2 players from the generated pool
- Per-spin restrictions:
  - Max 1 opener
  - Max 1 wicketkeeper
  - Max 1 all-rounder
- Reroll system:
  - 1 team reroll (keeps era)
  - 1 era reroll (keeps team)
  - Free reroll if pool lacks required roles

### Feasibility Guard

Before each spin, UI shows:
```
Remaining slots: 2 openers, 1 keeper, 1 all-rounder
Remaining spins: 4
⚠️ Must pick opener in next 2 spins
```

If remaining scarce-role slots = remaining spins, force those picks.

---

## Era System

### 7 Eras Total

1. **🏆 Legends** (42 players) - Transcendent greats across all history
2. **1970s** (1970-1979)
3. **1980s** (1980-1989)
4. **1990s** (1990-1999)
5. **2000s** (2000-2009)
6. **2010s** (2010-2019)
7. **2020s** (2020-present)

### Historical Exclusions

| Nation | Excluded Eras | Reason |
|--------|--------------|--------|
| South Africa | 1970s, 1980s | Apartheid isolation (1970-1991) |
| Sri Lanka | 1970s | Test status gained 1981 |
| Bangladesh | 70s, 80s, 90s | Test status gained 2000 |
| Zimbabwe | 1970s, 1980s | Test status gained 1992 |

### Duplicate Player Rule

Players can appear in Legends AND their active decades.
Once selected from ANY pool, they're globally unavailable.

**Strategic element**: "Take Sachin from Legends now, or gamble on India 2000s later?"

---

## 10 Test Nations

1. 🇦🇺 Australia
2. 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England
3. 🇮🇳 India
4. 🇵🇰 Pakistan
5. 🇯🇲 West Indies
6. 🇳🇿 New Zealand
7. 🇿🇦 South Africa
8. 🇱🇰 Sri Lanka
9. 🇧🇩 Bangladesh
10. 🇿🇼 Zimbabwe

---

## Player Pool Structure

### Legends Era: 42 Players (LOCKED)

#### Openers (6)
| Player | Nation | Key Record |
|--------|--------|------------|
| Don Bradman | Australia | 99.94 average |
| Jack Hobbs | England | 61,760 first-class runs |
| Len Hutton | England | 364 vs Australia |
| Sunil Gavaskar | India | First to 10,000 Test runs |
| Gordon Greenidge | West Indies | 214* at Lord's |
| Hanif Mohammad | Pakistan | 337 vs West Indies |

#### Middle-order Batsmen (10)
| Player | Nation | Key Record |
|--------|--------|------------|
| Sachin Tendulkar | India | 15,921 Test runs |
| Brian Lara | West Indies | 400* highest score |
| Ricky Ponting | Australia | 13,378 runs |
| Jacques Kallis | South Africa | 13,289 runs, 292 wickets |
| Rahul Dravid | India | 13,288 runs |
| Viv Richards | West Indies | 8,540 runs @ 50.2 |
| Greg Chappell | Australia | 24 centuries |
| Javed Miandad | Pakistan | 8,832 runs |
| Martin Crowe | New Zealand | 17 centuries |
| Kumar Sangakkara | Sri Lanka | 12,400 runs @ 57.4 |

#### Wicketkeepers (4)
| Player | Nation | Key Record |
|--------|--------|------------|
| Alan Knott | England | 269 dismissals |
| Rod Marsh | Australia | 355 dismissals |
| Jeff Dujon | West Indies | 272 dismissals |
| Adam Gilchrist | Australia | 416 dismissals, 17 centuries |

#### All-rounders (8)
| Player | Nation | Key Record |
|--------|--------|------------|
| Garfield Sobers | West Indies | 8,032 runs, 235 wickets |
| Ian Botham | England | 5,200 runs, 383 wickets |
| Kapil Dev | India | 5,248 runs, 434 wickets |
| Imran Khan | Pakistan | 3,807 runs, 362 wickets |
| Richard Hadlee | New Zealand | 3,114 runs, 431 wickets |
| Shakib Al Hasan | Bangladesh | 4,600 runs, 246 wickets |
| Andrew Flintoff | England | 3,845 runs, 226 wickets |
| Daniel Vettori | New Zealand | 4,531 runs, 362 wickets |

#### Fast Bowlers (9)
| Player | Nation | Key Record |
|--------|--------|------------|
| Sydney Barnes | England | 189 wickets @ 16.4 |
| Malcolm Marshall | West Indies | 376 wickets @ 20.9 |
| Dennis Lillee | Australia | 355 wickets |
| Dale Steyn | South Africa | 439 wickets @ 22.9 |
| Curtly Ambrose | West Indies | 405 wickets @ 20.9 |
| Richard Hadlee | New Zealand | 431 wickets |
| Glenn McGrath | Australia | 563 wickets |
| Waqar Younis | Pakistan | 373 wickets |
| Wasim Akram | Pakistan | 414 wickets |

#### Spin Bowlers (5)
| Player | Nation | Key Record |
|--------|--------|------------|
| Jim Laker | England | 19 wickets in a match |
| Shane Warne | Australia | 708 wickets |
| Muttiah Muralitharan | Sri Lanka | 800 wickets |
| Anil Kumble | India | 619 wickets |
| Abdul Qadir | Pakistan | 236 wickets |

---

### Decade Rosters: ~15 Players Per Nation/Era

**Target Distribution:**
- 3 Openers
- 5 Middle-order batsmen
- 1 Wicketkeeper
- 2 All-rounders
- 1 Spinner
- 4 Fast bowlers
- **Total: 15 players**

**Note**: Players can have secondary roles. Thinner pools may have fewer than 15.

---

## 1970s Roster (6 Viable Nations)

### 🇦🇺 Australia
| Player | Role | Key Stats |
|--------|------|-----------|
| Ian Chappell | Opener/Middle | 2,683 runs @ 42.4 |
| Keith Stackpole | Opener | 2,180 runs |
| Rick McCosker | Opener | 1,951 runs |
| Doug Walters | Middle-order | 5,357 runs @ 48.3 |
| Ross Edwards | Middle-order | 1,783 runs |
| Greg Chappell | Middle-order | 7,110 runs @ 53.9 |
| Rod Marsh | Wicketkeeper | 3,633 runs, 355 dismissals |
| Max Walker | All-rounder | 138 wickets |
| Ashley Mallett | Spinner | 132 wickets @ 29.8 |
| Dennis Lillee | Fast bowler | 355 wickets @ 23.9 |
| Jeff Thomson | Fast bowler | 200 wickets @ 25.9 |
| Alan Hurst | Fast bowler | 59 wickets |
| Gary Gilmour | Fast bowler | 54 wickets |

### 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England
| Player | Role | Key Stats |
|--------|------|-----------|
| Geoffrey Boycott | Opener | 8,114 runs @ 47.7 |
| John Edrich | Opener | 5,138 runs |
| Dennis Amiss | Opener | 3,612 runs |
| David Lloyd | Middle-order | 1,357 runs |
| Tony Greig | All-rounder | 3,599 runs, 141 wickets |
| Alan Knott | Wicketkeeper | 4,389 runs, 269 dismissals |
| Bob Taylor | Wicketkeeper | 1,381 runs, 273 dismissals |
| Derek Underwood | Spinner | 297 wickets @ 25.8 |
| John Snow | Fast bowler | 202 wickets @ 26.6 |
| Bob Willis | Fast bowler | 325 wickets |
| Chris Old | Fast bowler | 143 wickets |
| Mike Hendrick | Fast bowler | 87 wickets |

### 🇮🇳 India
| Player | Role | Key Stats |
|--------|------|-----------|
| Chetan Chauhan | Opener | 2,084 runs |
| Sunil Gavaskar | Opener | 10,122 runs @ 51.1 |
| Anshuman Gaekwad | Opener | 1,985 runs |
| Gundappa Viswanath | Middle-order | 6,080 runs @ 51.9 |
| Mohinder Amarnath | Middle-order | 4,378 runs |
| Sandeep Patil | Middle-order | 1,588 runs |
| Farokh Engineer | Wicketkeeper | 2,611 runs |
| Erapalli Prasanna | Spinner | 189 wickets @ 30.3 |
| B.S. Chandrasekhar | Spinner | 242 wickets |
| Srinivas Venkataraghavan | Spinner | 157 wickets |
| Bishan Bedi | Spinner | 266 wickets |
| Karsan Ghavri | Fast bowler | 109 wickets |
| Madan Lal | Fast bowler | 71 wickets |

### 🇵🇰 Pakistan
| Player | Role | Key Stats |
|--------|------|-----------|
| Sadiq Mohammad | Opener | 2,433 runs |
| Majid Khan | Opener | 3,931 runs |
| Wasim Raja | Middle-order | 2,033 runs |
| Zaheer Abbas | Middle-order | 5,062 runs @ 44.8 |
| Asif Iqbal | Middle-order | 3,575 runs |
| Javed Miandad | Middle-order | 8,832 runs @ 52.6 |
| Wasim Bari | Wicketkeeper | 1,367 runs, 201 dismissals |
| Intikhab Alam | All-rounder/Spinner | 125 wickets |
| Mushtaq Mohammad | All-rounder | 3,643 runs, 79 wickets |
| Sarfraz Nawaz | Fast bowler | 177 wickets |
| Imran Khan | Fast bowler | 3,807 runs, 362 wickets |
| Sikander Bakht | Fast bowler | 78 wickets |
| Saleem Altaf | Fast bowler | 51 wickets |

### 🇯🇲 West Indies
| Player | Role | Key Stats |
|--------|------|-----------|
| Roy Fredericks | Opener | 4,314 runs @ 42.5 |
| Gordon Greenidge | Opener | 7,558 runs @ 44.7 |
| Desmond Haynes | Opener | 7,487 runs |
| Alvin Kallicharran | Middle-order | 4,555 runs @ 45.5 |
| Clive Lloyd | Middle-order | 7,515 runs @ 46.7 |
| Viv Richards | Middle-order | 8,540 runs @ 50.2 |
| Deryck Murray | Wicketkeeper | 1,993 runs, 243 dismissals |
| Bernard Julien | All-rounder | 661 runs, 50 wickets |
| Larry Gomes | All-rounder | 3,171 runs, 19 wickets |
| Andy Roberts | Fast bowler | 202 wickets @ 25.6 |
| Michael Holding | Fast bowler | 249 wickets @ 23.7 |
| Colin Croft | Fast bowler | 125 wickets @ 23.3 |
| Wayne Daniel | Fast bowler | 111 wickets |
| Joel Garner | Fast bowler | 259 wickets @ 20.9 |

### 🇳🇿 New Zealand (Thin Pool)
| Player | Role | Key Stats |
|--------|------|-----------|
| Glenn Turner | Opener | 2,991 runs @ 44.6 |
| John Wright | Opener | 533 runs |
| Bevan Congdon | Middle-order | 3,460 runs |
| Mark Burgess | Middle-order | 1,842 runs |
| Ken Wadsworth | Wicketkeeper | 804 runs, 85 dismissals |
| Richard Collinge | Fast bowler | 116 wickets @ 29.3 |
| Dayle Hadlee | Fast bowler | 54 wickets |
| Ewen Chatfield | Fast bowler | 35 wickets |

---

## 1980s Roster (7 Viable Nations)

### 🇦🇺 Australia
| Player | Role | Key Stats |
|--------|------|-----------|
| Graeme Wood | Opener | 2,342 runs |
| Kepler Wessels | Opener | 1,629 runs |
| Andrew Hilditch | Opener | 1,776 runs |
| Dean Jones | Middle-order | 3,631 runs @ 46.6 |
| David Boon | Middle-order | 7,422 runs |
| Allan Border | Middle-order | 11,174 runs @ 50.6 |
| Steve Waugh | Middle-order | 10,927 runs |
| Mark Waugh | Middle-order | 8,029 runs |
| Tim Zoehrer | Wicketkeeper | 55 dismissals |
| Greg Matthews | All-rounder | 1,849 runs, 61 wickets |
| Bruce Reid | Fast bowler | 113 wickets @ 24.6 |
| Merv Hughes | Fast bowler | 212 wickets |
| Terry Alderman | Fast bowler | 170 wickets |
| Geoff Lawson | Fast bowler | 180 wickets |
| Peter Taylor | Spinner | 34 wickets |

### 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England
| Player | Role | Key Stats |
|--------|------|-----------|
| Graham Gooch | Opener | 8,900 runs @ 42.6 |
| Tim Robinson | Opener | 1,871 runs |
| Chris Broad | Opener | 1,732 runs |
| David Gower | Middle-order | 8,231 runs @ 44.3 |
| Mike Gatting | Middle-order | 4,424 runs |
| Ian Botham | All-rounder | 5,200 runs, 383 wickets |
| Robin Smith | Middle-order | 4,236 runs |
| Allan Lamb | Middle-order | 4,656 runs |
| Jack Russell | Wicketkeeper | 1,645 runs, 219 dismissals |
| Phil Edmonds | Spinner | 125 wickets |
| John Emburey | Spinner | 147 wickets |
| Ian Botham | Fast bowler/All-rounder | 383 wickets |
| Bob Willis | Fast bowler | 325 wickets |
| Gladstone Small | Fast bowler | 87 wickets |
| Neil Foster | Fast bowler | 131 wickets |

### 🇮🇳 India
| Player | Role | Key Stats |
|--------|------|-----------|
| Sunil Gavaskar | Opener | 10,122 runs @ 51.1 |
| Kris Srikkanth | Opener | 2,062 runs |
| Anshuman Gaekwad | Opener | 1,985 runs |
| Dilip Vengsarkar | Middle-order | 6,868 runs @ 42.1 |
| Mohinder Amarnath | Middle-order | 4,378 runs |
| Sandeep Patil | Middle-order | 1,588 runs |
| Mohd. Azharuddin | Middle-order | 6,215 runs @ 45.0 |
| Kapil Dev | All-rounder | 5,248 runs, 434 wickets |
| Kiran More | Wicketkeeper | 1,265 runs, 130 dismissals |
| Maninder Singh | Spinner | 88 wickets |
| Ravi Shastri | All-rounder | 3,830 runs, 151 wickets |
| Madan Lal | Fast bowler | 71 wickets |
| Chetan Sharma | Fast bowler | 61 wickets |
| Manoj Prabhakar | Fast bowler | 96 wickets |
| Kapil Dev | Fast bowler/All-rounder | 434 wickets |

### 🇵🇰 Pakistan
| Player | Role | Key Stats |
|--------|------|-----------|
| Mudassar Nazar | Opener | 3,035 runs |
| Mohsin Khan | Opener | 2,197 runs |
| Shoaib Mohammad | Opener | 2,025 runs |
| Salim Malik | Middle-order | 5,768 runs |
| Javed Miandad | Middle-order | 8,832 runs @ 52.6 |
| Saleem Malik | Middle-order | 5,768 runs |
| Wasim Raja | Middle-order | 2,033 runs |
| Imran Khan | All-rounder | 3,807 runs, 362 wickets |
| Saleem Yousuf | Wicketkeeper | 1,145 runs, 100 dismissals |
| Abdul Qadir | Spinner | 236 wickets @ 32.8 |
| Iqbal Qasim | Spinner | 171 wickets |
| Wasim Akram | Fast bowler | 414 wickets |
| Waqar Younis | Fast bowler | 373 wickets |
| Aaqib Javed | Fast bowler | 78 wickets |
| Sarfraz Nawaz | Fast bowler | 177 wickets |

### 🇯🇲 West Indies
| Player | Role | Key Stats |
|--------|------|-----------|
| Gordon Greenidge | Opener | 7,558 runs @ 44.7 |
| Desmond Haynes | Opener | 7,487 runs |
| Phil Simmons | Opener | 2,451 runs |
| Richie Richardson | Middle-order | 5,948 runs |
| Viv Richards | Middle-order | 8,540 runs @ 50.2 |
| Gus Logie | Middle-order | 2,470 runs |
| Carl Hooper | Middle-order | 5,762 runs |
| Clive Lloyd | Middle-order | 7,515 runs |
| Jeff Dujon | Wicketkeeper | 3,322 runs, 272 dismissals |
| Malcolm Marshall | Fast bowler | 376 wickets @ 20.9 |
| Michael Holding | Fast bowler | 249 wickets @ 23.7 |
| Joel Garner | Fast bowler | 259 wickets @ 20.9 |
| Courtney Walsh | Fast bowler | 519 wickets |
| Curtly Ambrose | Fast bowler | 405 wickets @ 20.9 |
| Roger Harper | Spinner/All-rounder | 46 wickets |

### 🇳🇿 New Zealand
| Player | Role | Key Stats |
|--------|------|-----------|
| John Wright | Opener | 5,334 runs |
| Bruce Edgar | Opener | 1,982 runs |
| Andrew Jones | Opener | 2,824 runs |
| Martin Crowe | Middle-order | 5,444 runs @ 45.4 |
| Jeremy Coney | Middle-order | 2,618 runs |
| John Reid | Middle-order | 1,912 runs |
| Stephen Boock | Spinner | 72 wickets |
| Ian Smith | Wicketkeeper | 1,815 runs, 165 dismissals |
| Richard Hadlee | All-rounder | 3,114 runs, 431 wickets |
| Chris Cairns | All-rounder | 3,520 runs, 218 wickets |
| Martin Snedden | Fast bowler | 58 wickets |
| Ewen Chatfield | Fast bowler | 123 wickets |
| Danny Morrison | Fast bowler | 80 wickets |
| Willie Watson | Fast bowler | 39 wickets |

### 🇱🇰 Sri Lanka
| Player | Role | Key Stats |
|--------|------|-----------|
| Sidath Wettimuny | Opener | 1,203 runs |
| Brendon Kuruppu | Opener | 721 runs |
| Aravinda de Silva | Middle-order | 6,361 runs @ 42.8 |
| Arjuna Ranatunga | Middle-order | 5,105 runs |
| Roy Dias | Middle-order | 1,957 runs |
| Duleep Mendis | Middle-order | 1,329 runs |
| Rumesh Ratnayake | Fast bowler | 62 wickets |
| Asanka Gurusinha | Middle-order | 2,290 runs |
| Amal Silva | Wicketkeeper | 689 runs, 45 dismissals |
| Ravi Ratnayeke | Fast bowler | 54 wickets |
| Graeme Labrooy | Fast bowler | 36 wickets |
| Somachandra de Silva | Spinner | 46 wickets |
| Lalith Kaluperuma | Spinner | 26 wickets |
| Asoka de Silva | Spinner | 19 wickets |

---

## 1990s Roster (9 Viable Nations)

### 🇦🇺 Australia
| Player | Role | Key Stats |
|--------|------|-----------|
| Mark Taylor | Opener | 7,525 runs @ 43.5 |
| Michael Slater | Opener | 5,312 runs |
| Matthew Elliott | Opener | 1,802 runs |
| Mark Waugh | Middle-order | 8,029 runs @ 41.8 |
| Steve Waugh | Middle-order | 10,927 runs @ 51.1 |
| Damien Martyn | Middle-order | 4,406 runs |
| Darren Lehmann | Middle-order | 1,798 runs |
| Ian Healy | Wicketkeeper | 4,356 runs, 395 dismissals |
| Shane Warne | Spinner | 708 wickets @ 25.4 |
| Stuart MacGill | Spinner | 208 wickets |
| Glenn McGrath | Fast bowler | 563 wickets @ 21.6 |
| Jason Gillespie | Fast bowler | 259 wickets |
| Brett Lee | Fast bowler | 310 wickets |
| Michael Kasprowicz | Fast bowler | 113 wickets |

### 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England
| Player | Role | Key Stats |
|--------|------|-----------|
| Michael Atherton | Opener | 7,796 runs |
| Alec Stewart | Opener/WK | 8,463 runs |
| Marcus Trescothick | Opener | 5,417 runs |
| Nasser Hussain | Middle-order | 5,764 runs |
| Graham Thorpe | Middle-order | 6,744 runs |
| Mark Ramprakash | Middle-order | 2,350 runs |
| Andrew Caddick | Fast bowler | 234 wickets |
| Darren Gough | Fast bowler | 229 wickets |
| Angus Fraser | Fast bowler | 177 wickets |
| Dominic Cork | Fast bowler | 131 wickets |
| Phil Tufnell | Spinner | 121 wickets |
| Robert Croft | Spinner | 71 wickets |
| Alec Stewart | Wicketkeeper | 277 dismissals |
| Ben Hollioake | All-rounder | 381 runs, 11 wickets |

### 🇮🇳 India
| Player | Role | Key Stats |
|--------|------|-----------|
| Navjot Sidhu | Opener | 3,202 runs |
| Manoj Prabhakar | Opener | 1,694 runs |
| Vikram Rathour | Opener | 1,329 runs |
| Sachin Tendulkar | Middle-order | 15,921 runs @ 53.8 |
| Rahul Dravid | Middle-order | 13,288 runs |
| Sourav Ganguly | Middle-order | 7,212 runs |
| Mohammad Azharuddin | Middle-order | 6,215 runs |
| Anil Kumble | Spinner | 619 wickets @ 29.7 |
| Rajesh Chauhan | Spinner | 41 wickets |
| Nayan Mongia | Wicketkeeper | 1,442 runs, 154 dismissals |
| Javagal Srinath | Fast bowler | 236 wickets |
| Venkatesh Prasad | Fast bowler | 96 wickets |
| Zaheer Khan | Fast bowler | 311 wickets |
| Ajit Agarkar | Fast bowler | 58 wickets |

### 🇵🇰 Pakistan
| Player | Role | Key Stats |
|--------|------|-----------|
| Saeed Anwar | Opener | 4,052 runs |
| Aamer Sohail | Opener | 2,281 runs |
| Wajahatullah Wasti | Opener | 561 runs |
| Inzamam-ul-Haq | Middle-order | 8,830 runs |
| Younis Khan | Middle-order | 10,099 runs |
| Yousuf Youhana | Middle-order | 7,975 runs |
| Salim Malik | Middle-order | 5,768 runs |
| Rashid Latif | Wicketkeeper | 1,381 runs, 130 dismissals |
| Moin Khan | Wicketkeeper | 1,692 runs, 147 dismissals |
| Saqlain Mushtaq | Spinner | 208 wickets |
| Mushtaq Ahmed | Spinner | 185 wickets |
| Wasim Akram | Fast bowler | 414 wickets |
| Waqar Younis | Fast bowler | 373 wickets |
| Shoaib Akhtar | Fast bowler | 178 wickets |
| Azhar Mahmood | Fast bowler | 39 wickets |

### 🇯🇲 West Indies
| Player | Role | Key Stats |
|--------|------|-----------|
| Sherwin Campbell | Opener | 2,827 runs |
| Philo Wallace | Opener | 1,038 runs |
| Stuart Williams | Opener | 1,837 runs |
| Brian Lara | Middle-order | 11,953 runs @ 52.9 |
| Shivnarine Chanderpaul | Middle-order | 11,867 runs |
| Carl Hooper | Middle-order | 5,762 runs |
| Jimmy Adams | Middle-order | 3,012 runs |
| Ridley Jacobs | Wicketkeeper | 2,570 runs, 207 dismissals |
| Courtney Browne | Wicketkeeper | 627 runs |
| Courtney Walsh | Fast bowler | 519 wickets @ 24.4 |
| Curtly Ambrose | Fast bowler | 405 wickets @ 20.9 |
| Ian Bishop | Fast bowler | 161 wickets |
| Reon King | Fast bowler | 54 wickets |
| Franklyn Rose | Fast bowler | 53 wickets |
| Nehemiah Perry | Spinner | 25 wickets |

### 🇳🇿 New Zealand
| Player | Role | Key Stats |
|--------|------|-----------|
| Mark Richardson | Opener | 2,776 runs |
| Matthew Horne | Opener | 1,642 runs |
| Craig Spearman | Opener | 950 runs |
| Stephen Fleming | Middle-order | 7,172 runs |
| Nathan Astle | Middle-order | 4,702 runs |
| Craig McMillan | Middle-order | 3,116 runs |
| Chris Cairns | All-rounder | 3,520 runs, 218 wickets |
| Adam Parore | Wicketkeeper | 1,685 runs, 143 dismissals |
| Daniel Vettori | Spinner/All-rounder | 4,531 runs, 362 wickets |
| Dion Nash | Fast bowler | 93 wickets |
| Geoff Allott | Fast bowler | 44 wickets |
| Simon Doull | Fast bowler | 98 wickets |
| Chris Martin | Fast bowler | 71 wickets |
| Shayne O'Connor | Fast bowler | 46 wickets |

### 🇿🇦 South Africa
| Player | Role | Key Stats |
|--------|------|-----------|
| Gary Kirsten | Opener | 7,289 runs |
| Andrew Hudson | Opener | 3,017 runs |
| Adam Bacher | Opener | 709 runs |
| Hansie Cronje | Middle-order | 3,714 runs |
| Jacques Kallis | All-rounder | 13,289 runs, 292 wickets |
| Jonty Rhodes | Middle-order | 2,532 runs |
| Daryll Cullinan | Middle-order | 4,554 runs |
| Dave Richardson | Wicketkeeper | 1,336 runs, 150 dismissals |
| Mark Boucher | Wicketkeeper | 5,302 runs, 555 dismissals |
| Paul Adams | Spinner | 134 wickets |
| Allan Donald | Fast bowler | 330 wickets @ 22.2 |
| Shaun Pollock | Fast bowler | 421 wickets |
| Lance Klusener | Fast bowler | 1,906 runs, 80 wickets |
| Makhaya Ntini | Fast bowler | 390 wickets |
| Fanie de Villiers | Fast bowler | 85 wickets |

### 🇱🇰 Sri Lanka
| Player | Role | Key Stats |
|--------|------|-----------|
| Sanath Jayasuriya | Opener | 6,973 runs |
| Marvan Atapattu | Opener | 5,502 runs |
| Russel Arnold | Opener | 1,625 runs |
| Aravinda de Silva | Middle-order | 6,361 runs |
| Arjuna Ranatunga | Middle-order | 5,105 runs |
| Mahela Jayawardene | Middle-order | 11,814 runs |
| Hashan Tillakaratne | Middle-order | 4,541 runs |
| Romesh Kaluwitharana | Wicketkeeper | 1,735 runs, 192 dismissals |
| Kumar Sangakkara | Wicketkeeper | 12,400 runs |
| Muttiah Muralitharan | Spinner | 800 wickets @ 22.7 |
| Rangana Herath | Spinner | 433 wickets |
| Chaminda Vaas | Fast bowler | 355 wickets |
| Lasith Malinga | Fast bowler | 101 wickets |
| Nuwan Zoysa | Fast bowler | 72 wickets |
| Dilhara Fernando | Fast bowler | 56 wickets |

### 🇿🇼 Zimbabwe
| Player | Role | Key Stats |
|--------|------|-----------|
| Grant Flower | Opener | 3,457 runs |
| Alistair Campbell | Opener | 2,858 runs |
| Murray Goodwin | Opener | 1,374 runs |
| Andy Flower | Wicketkeeper | 4,794 runs @ 51.5 |
| Stuart Carlisle | Middle-order | 1,974 runs |
| Murray Goodwin | Middle-order | 1,374 runs |
| Gavin Rennie | Middle-order | 1,147 runs |
| Heath Streak | All-rounder | 1,990 runs, 229 wickets |
| Paul Strang | All-rounder | 855 runs, 95 wickets |
| Andy Whittall | Spinner | 32 wickets |
| John Traicos | Spinner | 44 wickets |
| Henry Olonga | Fast bowler | 68 wickets |
| Mpumelelo Mbangwa | Fast bowler | 26 wickets |
| Bryan Strang | Fast bowler | 70 wickets |

---

## 2000s Roster (10 Viable Nations)

### 🇦🇺 Australia
| Player | Role | Key Stats |
|--------|------|-----------|
| Matthew Hayden | Opener | 8,625 runs @ 50.7 |
| Justin Langer | Opener | 7,696 runs |
| Phil Jaques | Opener | 1,282 runs |
| Ricky Ponting | Middle-order | 13,378 runs @ 51.9 |
| Michael Hussey | Middle-order | 6,235 runs @ 51.5 |
| Michael Clarke | Middle-order | 8,643 runs |
| Damien Martyn | Middle-order | 4,406 runs |
| Adam Gilchrist | Wicketkeeper | 5,570 runs, 416 dismissals |
| Shane Warne | Spinner | 708 wickets |
| Stuart MacGill | Spinner | 208 wickets |
| Nathan Hauritz | Spinner | 63 wickets |
| Glenn McGrath | Fast bowler | 563 wickets |
| Brett Lee | Fast bowler | 310 wickets |
| Mitchell Johnson | Fast bowler | 313 wickets |
| Peter Siddle | Fast bowler | 211 wickets |

### 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England
| Player | Role | Key Stats |
|--------|------|-----------|
| Marcus Trescothick | Opener | 5,417 runs |
| Andrew Strauss | Opener | 7,037 runs |
| Alastair Cook | Opener | 12,472 runs |
| Kevin Pietersen | Middle-order | 8,181 runs |
| Ian Bell | Middle-order | 7,727 runs |
| Paul Collingwood | Middle-order | 4,259 runs |
| Jonathan Trott | Middle-order | 3,835 runs |
| Matt Prior | Wicketkeeper | 4,090 runs, 256 dismissals |
| Andrew Flintoff | All-rounder | 3,845 runs, 226 wickets |
| Ashley Giles | Spinner | 143 wickets |
| Monty Panesar | Spinner | 167 wickets |
| James Anderson | Fast bowler | 675 wickets |
| Stuart Broad | Fast bowler | 537 wickets |
| Steve Harmison | Fast bowler | 226 wickets |
| Matthew Hoggard | Fast bowler | 248 wickets |

### 🇮🇳 India
| Player | Role | Key Stats |
|--------|------|-----------|
| Virender Sehwag | Opener | 8,586 runs @ 49.3 |
| Gautam Gambhir | Opener | 4,154 runs |
| Wasim Jaffer | Opener | 1,944 runs |
| Rahul Dravid | Middle-order | 13,288 runs |
| Sachin Tendulkar | Middle-order | 15,921 runs |
| VVS Laxman | Middle-order | 8,781 runs |
| Sourav Ganguly | Middle-order | 7,212 runs |
| MS Dhoni | Wicketkeeper | 4,876 runs, 294 dismissals |
| Anil Kumble | Spinner | 619 wickets |
| Harbhajan Singh | Spinner | 417 wickets |
| Zaheer Khan | Fast bowler | 311 wickets |
| Ishant Sharma | Fast bowler | 311 wickets |
| Sreesanth | Fast bowler | 87 wickets |
| Irfan Pathan | All-rounder | 1,105 runs, 100 wickets |
| RP Singh | Fast bowler | 62 wickets |

### 🇵🇰 Pakistan
| Player | Role | Key Stats |
|--------|------|-----------|
| Taufeeq Umar | Opener | 1,496 runs |
| Imran Farhat | Opener | 1,262 runs |
| Salman Butt | Opener | 1,239 runs |
| Younis Khan | Middle-order | 10,099 runs |
| Mohammad Yousuf | Middle-order | 7,530 runs |
| Inzamam-ul-Haq | Middle-order | 8,830 runs |
| Misbah-ul-Haq | Middle-order | 4,239 runs |
| Kamran Akmal | Wicketkeeper | 2,646 runs, 250 dismissals |
| Shoaib Malik | All-rounder | 1,898 runs, 24 wickets |
| Danish Kaneria | Spinner | 261 wickets |
| Saeed Ajmal | Spinner | 178 wickets |
| Shoaib Akhtar | Fast bowler | 178 wickets |
| Umar Gul | Fast bowler | 163 wickets |
| Mohammad Asif | Fast bowler | 106 wickets |
| Mohammad Amir | Fast bowler | 74 wickets |

### 🇯🇲 West Indies
| Player | Role | Key Stats |
|--------|------|-----------|
| Chris Gayle | Opener | 7,214 runs |
| Adrian Barath | Opener | 695 runs |
| Lendl Simmons | Opener | 562 runs |
| Shivnarine Chanderpaul | Middle-order | 11,867 runs |
| Ramnaresh Sarwan | Middle-order | 5,842 runs |
| Marlon Samuels | Middle-order | 3,564 runs |
| Darren Bravo | Middle-order | 3,538 runs |
| Denesh Ramdin | Wicketkeeper | 2,762 runs, 234 dismissals |
| Dwayne Bravo | All-rounder | 2,200 runs, 86 wickets |
| Shivnarine Chanderpaul | All-rounder | 11,867 runs |
| Sulieman Benn | Spinner | 53 wickets |
| Devon Smith | Opener | 1,378 runs |
| Jerome Taylor | Fast bowler | 89 wickets |
| Kemar Roach | Fast bowler | 231 wickets |
| Fidel Edwards | Fast bowler | 165 wickets |

### 🇳🇿 New Zealand
| Player | Role | Key Stats |
|--------|------|-----------|
| Tim McIntosh | Opener | 604 runs |
| Craig Cumming | Opener | 326 runs |
| Matthew Bell | Opener | 402 runs |
| Stephen Fleming | Middle-order | 7,172 runs |
| Scott Styris | Middle-order | 3,116 runs |
| Ross Taylor | Middle-order | 7,683 runs |
| Jesse Ryder | Middle-order | 1,269 runs |
| Brendon McCullum | Wicketkeeper | 6,453 runs, 247 dismissals |
| Daniel Vettori | Spinner/All-rounder | 4,531 runs, 362 wickets |
| Nathan McCullum | Spinner | 26 wickets |
| Jeetan Patel | Spinner | 31 wickets |
| Shane Bond | Fast bowler | 87 wickets |
| Chris Martin | Fast bowler | 233 wickets |
| Kyle Mills | Fast bowler | 79 wickets |
| Tim Southee | Fast bowler | 372 wickets |

### 🇿🇦 South Africa
| Player | Role | Key Stats |
|--------|------|-----------|
| Graeme Smith | Opener | 9,265 runs |
| Herschelle Gibbs | Opener | 6,167 runs |
| Neil McKenzie | Opener | 1,956 runs |
| Jacques Kallis | All-rounder | 13,289 runs, 292 wickets |
| Hashim Amla | Middle-order | 9,282 runs |
| AB de Villiers | Middle-order | 8,765 runs |
| JP Duminy | Middle-order | 2,103 runs |
| Ashwell Prince | Middle-order | 3,658 runs |
| Mark Boucher | Wicketkeeper | 5,302 runs, 555 dismissals |
| Paul Harris | Spinner | 103 wickets |
| Johan Botha | Spinner | 72 wickets |
| Dale Steyn | Fast bowler | 439 wickets |
| Makhaya Ntini | Fast bowler | 390 wickets |
| Morne Morkel | Fast bowler | 309 wickets |
| Vernon Philander | Fast bowler | 224 wickets |

### 🇱🇰 Sri Lanka
| Player | Role | Key Stats |
|--------|------|-----------|
| Tillakaratne Dilshan | Opener | 5,492 runs |
| Malinda Warnapura | Opener | 783 runs |
| Kaushal Silva | Opener | 1,084 runs |
| Kumar Sangakkara | Middle-order | 12,400 runs |
| Mahela Jayawardene | Middle-order | 11,814 runs |
| Thilan Samaraweera | Middle-order | 3,546 runs |
| Thilina Kandamby | Middle-order | 667 runs |
| Prasanna Jayawardene | Wicketkeeper | 1,466 runs, 127 dismissals |
| Angelo Mathews | All-rounder | 3,817 runs, 35 wickets |
| Muttiah Muralitharan | Spinner | 800 wickets |
| Rangana Herath | Spinner | 433 wickets |
| Ajantha Mendis | Spinner | 70 wickets |
| Lasith Malinga | Fast bowler | 101 wickets |
| Nuwan Kulasekara | Fast bowler | 55 wickets |
| Dilhara Fernando | Fast bowler | 56 wickets |

### 🇧🇩 Bangladesh
| Player | Role | Key Stats |
|--------|------|-----------|
| Tamim Iqbal | Opener | 5,134 runs |
| Javed Omar | Opener | 1,404 runs |
| Shahriar Nafees | Opener | 1,332 runs |
| Habibul Bashar | Middle-order | 3,026 runs |
| Mohammad Ashraful | Middle-order | 2,474 runs |
| Shakib Al Hasan | All-rounder | 4,600 runs, 246 wickets |
| Mushfiqur Rahim | Wicketkeeper | 5,727 runs |
| Mahmudullah | All-rounder | 2,914 runs, 43 wickets |
| Abdur Razzak | Spinner | 100 wickets |
| Mohammad Rafique | Spinner | 100 wickets |
| Enamul Haque | Spinner | 38 wickets |
| Mashrafe Mortaza | Fast bowler | 78 wickets |
| Shahadat Hossain | Fast bowler | 72 wickets |
| Syed Rasel | Fast bowler | 46 wickets |
| Rubel Hossain | Fast bowler | 36 wickets |

### 🇿🇼 Zimbabwe
| Player | Role | Key Stats |
|--------|------|-----------|
| Vusi Sibanda | Opener | 1,198 runs |
| Tino Mawoyo | Opener | 625 runs |
| Hamilton Masakadza | Opener | 2,143 runs |
| Brendan Taylor | Middle-order | 2,320 runs |
| Tatenda Taibu | Wicketkeeper | 1,646 runs, 145 dismissals |
| Sean Williams | All-rounder | 1,872 runs, 22 wickets |
| Elton Chigumbura | All-rounder | 1,666 runs, 38 wickets |
| Prosper Utseya | Spinner | 53 wickets |
| Ray Price | Spinner | 80 wickets |
| Graeme Cremer | Spinner | 36 wickets |
| Kyle Jarvis | Fast bowler | 45 wickets |
| Brian Vitori | Fast bowler | 22 wickets |
| Christopher Mpofu | Fast bowler | 62 wickets |
| Tendai Chatara | Fast bowler | 89 wickets |

---

## 2010s Roster (10 Viable Nations)

### 🇦🇺 Australia
| Player | Role | Key Stats |
|--------|------|-----------|
| David Warner | Opener | 8,786 runs |
| Chris Rogers | Opener | 2,015 runs |
| Joe Burns | Opener | 1,452 runs |
| Steve Smith | Middle-order | 9,320 runs @ 61.9 |
| Usman Khawaja | Middle-order | 3,227 runs |
| Peter Handscomb | Middle-order | 1,424 runs |
| Travis Head | Middle-order | 2,071 runs |
| Tim Paine | Wicketkeeper | 1,534 runs, 157 dismissals |
| Nathan Lyon | Spinner | 496 wickets |
| Steve O'Keefe | Spinner | 35 wickets |
| Pat Cummins | Fast bowler | 282 wickets |
| Josh Hazlewood | Fast bowler | 258 wickets |
| Mitchell Starc | Fast bowler | 339 wickets |
| James Pattinson | Fast bowler | 81 wickets |
| Peter Siddle | Fast bowler | 211 wickets |

### 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England
| Player | Role | Key Stats |
|--------|------|-----------|
| Alastair Cook | Opener | 12,472 runs |
| Keaton Jennings | Opener | 630 runs |
| Rory Burns | Opener | 1,106 runs |
| Joe Root | Middle-order | 11,411 runs |
| Jonny Bairstow | Middle-order | 5,972 runs |
| Ben Stokes | All-rounder | 5,879 runs, 197 wickets |
| Moeen Ali | All-rounder | 2,914 runs, 204 wickets |
| Jos Buttler | Wicketkeeper | 2,907 runs, 212 dismissals |
| Adil Rashid | Spinner | 60 wickets |
| Jack Leach | Spinner | 124 wickets |
| Dom Bess | Spinner | 36 wickets |
| James Anderson | Fast bowler | 675 wickets |
| Stuart Broad | Fast bowler | 537 wickets |
| Mark Wood | Fast bowler | 94 wickets |
| Chris Woakes | Fast bowler | 130 wickets |

### 🇮🇳 India
| Player | Role | Key Stats |
|--------|------|-----------|
| Murali Vijay | Opener | 3,982 runs |
| Shikhar Dhawan | Opener | 2,315 runs |
| KL Rahul | Opener | 2,901 runs |
| Cheteshwar Pujara | Middle-order | 7,195 runs |
| Virat Kohli | Middle-order | 8,848 runs @ 49.2 |
| Ajinkya Rahane | Middle-order | 5,077 runs |
| Rohit Sharma | Middle-order | 3,639 runs |
| Rishabh Pant | Wicketkeeper | 2,271 runs, 113 dismissals |
| Wriddhiman Saha | Wicketkeeper | 1,353 runs, 104 dismissals |
| Ravichandran Ashwin | All-rounder | 3,371 runs, 474 wickets |
| Ravindra Jadeja | All-rounder | 2,706 runs, 268 wickets |
| Ishant Sharma | Fast bowler | 311 wickets |
| Mohammed Shami | Fast bowler | 229 wickets |
| Jasprit Bumrah | Fast bowler | 140 wickets |
| Umesh Yadav | Fast bowler | 170 wickets |

### 🇵🇰 Pakistan
| Player | Role | Key Stats |
|--------|------|-----------|
| Shan Masood | Opener | 1,474 runs |
| Sami Aslam | Opener | 394 runs |
| Imam-ul-Haq | Opener | 1,492 runs |
| Azhar Ali | Middle-order | 7,097 runs |
| Asad Shafiq | Middle-order | 4,660 runs |
| Babar Azam | Middle-order | 3,840 runs |
| Younis Khan | Middle-order | 10,099 runs |
| Sarfraz Ahmed | Wicketkeeper | 2,657 runs, 150 dismissals |
| Mohammad Hafeez | All-rounder | 3,652 runs, 59 wickets |
| Shadab Khan | All-rounder | 454 runs, 67 wickets |
| Yasir Shah | Spinner | 244 wickets |
| Saeed Ajmal | Spinner | 178 wickets |
| Mohammad Abbas | Fast bowler | 90 wickets |
| Shaheen Shah Afridi | Fast bowler | 99 wickets |
| Wahab Riaz | Fast bowler | 83 wickets |

### 🇯🇲 West Indies
| Player | Role | Key Stats |
|--------|------|-----------|
| Kraigg Brathwaite | Opener | 4,868 runs |
| Kieran Powell | Opener | 1,004 runs |
| Rajendra Chandrika | Opener | 353 runs |
| Jermaine Blackwood | Middle-order | 1,889 runs |
| Roston Chase | All-rounder | 1,607 runs, 61 wickets |
| Shai Hope | Middle-order | 2,279 runs |
| Shane Dowrich | Wicketkeeper | 1,204 runs, 73 dismissals |
| Jason Holder | All-rounder | 1,409 runs, 147 wickets |
| Devendra Bishoo | Spinner | 58 wickets |
| Roston Chase | Spinner | 61 wickets |
| Jomel Warrican | Spinner | 29 wickets |
| Kemar Roach | Fast bowler | 231 wickets |
| Shannon Gabriel | Fast bowler | 166 wickets |
| Alzarri Joseph | Fast bowler | 100 wickets |
| Miguel Cummins | Fast bowler | 35 wickets |

### 🇳🇿 New Zealand
| Player | Role | Key Stats |
|--------|------|-----------|
| Tom Latham | Opener | 5,609 runs |
| Jeet Raval | Opener | 591 runs |
| Hamish Rutherford | Opener | 451 runs |
| Kane Williamson | Middle-order | 8,124 runs @ 49.5 |
| Ross Taylor | Middle-order | 7,683 runs |
| Henry Nicholls | Middle-order | 2,909 runs |
| BJ Watling | Wicketkeeper | 2,087 runs, 125 dismissals |
| Colin de Grandhomme | All-rounder | 778 runs, 49 wickets |
| Mitchell Santner | Spinner/All-rounder | 742 runs, 50 wickets |
| Ish Sodhi | Spinner | 64 wickets |
| Mark Craig | Spinner | 41 wickets |
| Tim Southee | Fast bowler | 372 wickets |
| Trent Boult | Fast bowler | 326 wickets |
| Neil Wagner | Fast bowler | 246 wickets |
| Matt Henry | Fast bowler | 95 wickets |

### 🇿🇦 South Africa
| Player | Role | Key Stats |
|--------|------|-----------|
| Dean Elgar | Opener | 5,146 runs |
| Stephen Cook | Opener | 556 runs |
| Aiden Markram | Opener | 2,526 runs |
| Hashim Amla | Middle-order | 9,282 runs |
| Faf du Plessis | Middle-order | 4,163 runs |
| Temba Bavuma | Middle-order | 2,292 runs |
| Quinton de Kock | Wicketkeeper | 3,301 runs, 246 dismissals |
| Keshav Maharaj | Spinner | 161 wickets |
| Dane Piedt | Spinner | 45 wickets |
| Imran Tahir | Spinner | 57 wickets |
| Kagiso Rabada | Fast bowler | 267 wickets |
| Vernon Philander | Fast bowler | 224 wickets |
| Morne Morkel | Fast bowler | 309 wickets |
| Dale Steyn | Fast bowler | 439 wickets |
| Lungi Ngidi | Fast bowler | 79 wickets |

### 🇱🇰 Sri Lanka
| Player | Role | Key Stats |
|--------|------|-----------|
| Dimuth Karunaratne | Opener | 4,426 runs |
| Kaushal Silva | Opener | 1,084 runs |
| Lahiru Thirimanne | Opener | 844 runs |
| Angelo Mathews | All-rounder | 3,817 runs, 35 wickets |
| Dinesh Chandimal | Middle-order | 3,097 runs |
| Kusal Mendis | Middle-order | 2,218 runs |
| Niroshan Dickwella | Wicketkeeper | 1,511 runs, 120 dismissals |
| Dhananjaya de Silva | All-rounder | 2,237 runs, 37 wickets |
| Rangana Herath | Spinner | 433 wickets |
| Dilruwan Perera | Spinner | 161 wickets |
| Lakshan Sandakan | Spinner | 40 wickets |
| Suranga Lakmal | Fast bowler | 168 wickets |
| Nuwan Pradeep | Fast bowler | 73 wickets |
| Lahiru Kumara | Fast bowler | 42 wickets |
| Vishwa Fernando | Fast bowler | 36 wickets |

### 🇧🇩 Bangladesh
| Player | Role | Key Stats |
|--------|------|-----------|
| Tamim Iqbal | Opener | 5,134 runs |
| Imrul Kayes | Opener | 1,590 runs |
| Soumya Sarkar | Opener | 897 runs |
| Mominul Haque | Middle-order | 3,557 runs |
| Shakib Al Hasan | All-rounder | 4,600 runs, 246 wickets |
| Mushfiqur Rahim | Wicketkeeper | 5,727 runs |
| Mahmudullah | All-rounder | 2,914 runs, 43 wickets |
| Liton Das | Wicketkeeper | 1,159 runs, 60 dismissals |
| Mehidy Hasan | Spinner | 161 wickets |
| Taijul Islam | Spinner | 127 wickets |
| Naeem Islam | Spinner | 25 wickets |
| Mustafizur Rahman | Fast bowler | 67 wickets |
| Taskin Ahmed | Fast bowler | 45 wickets |
| Ebadot Hossain | Fast bowler | 31 wickets |
| Shafiul Islam | Fast bowler | 38 wickets |

### 🇿🇼 Zimbabwe
| Player | Role | Key Stats |
|--------|------|-----------|
| Brian Chari | Opener | 319 runs |
| Chamu Chibhabha | Opener | 673 runs |
| Tino Mawoyo | Opener | 625 runs |
| Hamilton Masakadza | Middle-order | 2,143 runs |
| Craig Ervine | Middle-order | 1,666 runs |
| Sean Williams | All-rounder | 1,872 runs, 22 wickets |
| Sikandar Raza | All-rounder | 1,532 runs, 31 wickets |
| Brendan Taylor | Wicketkeeper | 2,320 runs |
| Richmond Mutumbami | Wicketkeeper | 506 runs |
| Graeme Cremer | Spinner | 93 wickets |
| Tendai Chisoro | Spinner | 17 wickets |
| Wellington Masakadza | Spinner | 16 wickets |
| Kyle Jarvis | Fast bowler | 45 wickets |
| Tendai Chatara | Fast bowler | 89 wickets |
| Donald Tiripano | Fast bowler | 31 wickets |

---

## 2020s Roster (10 Viable Nations)

### 🇦🇺 Australia
| Player | Role | Key Stats |
|--------|------|-----------|
| David Warner | Opener | 8,786 runs |
| Usman Khawaja | Opener | 3,227 runs |
| Marcus Harris | Opener | 1,078 runs |
| Steve Smith | Middle-order | 9,320 runs |
| Marnus Labuschagne | Middle-order | 3,471 runs |
| Travis Head | Middle-order | 2,071 runs |
| Cameron Green | All-rounder | 1,106 runs, 35 wickets |
| Alex Carey | Wicketkeeper | 822 runs, 92 dismissals |
| Nathan Lyon | Spinner | 496 wickets |
| Todd Murphy | Spinner | 34 wickets |
| Matthew Kuhnemann | Spinner | 16 wickets |
| Pat Cummins | Fast bowler | 282 wickets |
| Mitchell Starc | Fast bowler | 339 wickets |
| Josh Hazlewood | Fast bowler | 258 wickets |
| Scott Boland | Fast bowler | 35 wickets |

### 🏴󠁧󠁢󠁥󠁮󠁧󠁿 England
| Player | Role | Key Stats |
|--------|------|-----------|
| Alex Lees | Opener | 567 runs |
| Zak Crawley | Opener | 1,805 runs |
| Ben Duckett | Opener | 752 runs |
| Ollie Pope | Middle-order | 2,104 runs |
| Joe Root | Middle-order | 11,411 runs |
| Harry Brook | Middle-order | 1,181 runs |
| Ben Stokes | All-rounder | 5,879 runs, 197 wickets |
| Ben Foakes | Wicketkeeper | 912 runs, 67 dismissals |
| Jack Leach | Spinner | 124 wickets |
| Rehan Ahmed | Spinner | 11 wickets |
| Tom Hartley | Spinner | 20 wickets |
| James Anderson | Fast bowler | 675 wickets |
| Stuart Broad | Fast bowler | 537 wickets |
| Mark Wood | Fast bowler | 94 wickets |
| Ollie Robinson | Fast bowler | 72 wickets |

### 🇮🇳 India
| Player | Role | Key Stats |
|--------|------|-----------|
| Rohit Sharma | Opener | 3,639 runs |
| KL Rahul | Opener | 2,901 runs |
| Shubman Gill | Opener | 1,893 runs |
| Virat Kohli | Middle-order | 8,848 runs |
| Cheteshwar Pujara | Middle-order | 7,195 runs |
| Shreyas Iyer | Middle-order | 783 runs |
| Rishabh Pant | Wicketkeeper | 2,271 runs |
| Ravindra Jadeja | All-rounder | 2,706 runs, 268 wickets |
| Ravichandran Ashwin | All-rounder | 3,371 runs, 474 wickets |
| Axar Patel | All-rounder | 555 runs, 55 wickets |
| Kuldeep Yadav | Spinner | 34 wickets |
| Jasprit Bumrah | Fast bowler | 140 wickets |
| Mohammed Shami | Fast bowler | 229 wickets |
| Mohammed Siraj | Fast bowler | 74 wickets |
| Shardul Thakur | Fast bowler | 31 wickets |

### 🇵🇰 Pakistan
| Player | Role | Key Stats |
|--------|------|-----------|
| Abdullah Shafique | Opener | 1,073 runs |
| Imam-ul-Haq | Opener | 1,492 runs |
| Shan Masood | Opener | 1,474 runs |
| Babar Azam | Middle-order | 3,840 runs |
| Saud Shakeel | Middle-order | 845 runs |
| Mohammad Rizwan | Wicketkeeper | 1,594 runs |
| Salman Ali Agha | All-rounder | 524 runs, 18 wickets |
| Agha Salman | All-rounder | 524 runs |
| Nauman Ali | Spinner | 57 wickets |
| Abrar Ahmed | Spinner | 32 wickets |
| Zahid Mahmood | Spinner | 16 wickets |
| Shaheen Shah Afridi | Fast bowler | 99 wickets |
| Naseem Shah | Fast bowler | 51 wickets |
| Haris Rauf | Fast bowler | 29 wickets |
| Mohammad Wasim Jr | Fast bowler | 13 wickets |

### 🇯🇲 West Indies
| Player | Role | Key Stats |
|--------|------|-----------|
| Kraigg Brathwaite | Opener | 4,868 runs |
| Tagenarine Chanderpaul | Opener | 597 runs |
| Mikyle Louis | Opener | 262 runs |
| Jermaine Blackwood | Middle-order | 1,889 runs |
| Alick Athanaze | Middle-order | 563 runs |
| Kavem Hodge | Middle-order | 419 runs |
| Joshua Da Silva | Wicketkeeper | 738 runs |
| Jason Holder | All-rounder | 1,409 runs, 147 wickets |
| Roston Chase | All-rounder | 1,607 runs, 61 wickets |
| Jomel Warrican | Spinner | 29 wickets |
| Rahkeem Cornwall | Spinner | 38 wickets |
| Kevin Sinclair | Spinner | 14 wickets |
| Kemar Roach | Fast bowler | 231 wickets |
| Alzarri Joseph | Fast bowler | 100 wickets |
| Jayden Seales | Fast bowler | 40 wickets |

### 🇳🇿 New Zealand
| Player | Role | Key Stats |
|--------|------|-----------|
| Tom Latham | Opener | 5,609 runs |
| Devon Conway | Opener | 1,482 runs |
| Will Young | Opener | 624 runs |
| Kane Williamson | Middle-order | 8,124 runs |
| Daryl Mitchell | Middle-order | 1,694 runs |
| Glenn Phillips | Middle-order | 671 runs |
| Tom Blundell | Wicketkeeper | 1,194 runs |
| Rachin Ravindra | All-rounder | 498 runs, 16 wickets |
| Mitchell Santner | Spinner | 50 wickets |
| Ajaz Patel | Spinner | 62 wickets |
| Ish Sodhi | Spinner | 64 wickets |
| Tim Southee | Fast bowler | 372 wickets |
| Trent Boult | Fast bowler | 326 wickets |
| Matt Henry | Fast bowler | 95 wickets |
| Kyle Jamieson | Fast bowler | 72 wickets |

### 🇿🇦 South Africa
| Player | Role | Key Stats |
|--------|------|-----------|
| Dean Elgar | Opener | 5,146 runs |
| Sarel Erwee | Opener | 363 runs |
| Tony de Zorzi | Opener | 329 runs |
| Aiden Markram | Middle-order | 2,526 runs |
| Temba Bavuma | Middle-order | 2,292 runs |
| Heinrich Klaasen | Middle-order | 698 runs |
| Kyle Verreynne | Wicketkeeper | 680 runs |
| Marco Jansen | All-rounder | 498 runs, 47 wickets |
| Wiaan Mulder | All-rounder | 378 runs, 30 wickets |
| Keshav Maharaj | Spinner | 161 wickets |
| Simon Harmer | Spinner | 23 wickets |
| Kagiso Rabada | Fast bowler | 267 wickets |
| Anrich Nortje | Fast bowler | 127 wickets |
| Lungi Ngidi | Fast bowler | 79 wickets |
| Gerald Coetzee | Fast bowler | 31 wickets |

### 🇱🇰 Sri Lanka
| Player | Role | Key Stats |
|--------|------|-----------|
| Dimuth Karunaratne | Opener | 4,426 runs |
| Nishan Madushka | Opener | 366 runs |
| Pathum Nissanka | Opener | 754 runs |
| Dinesh Chandimal | Middle-order | 3,097 runs |
| Kusal Mendis | Middle-order | 2,218 runs |
| Kamindu Mendis | Middle-order | 711 runs |
| Dhananjaya de Silva | All-rounder | 2,237 runs, 37 wickets |
| Sadeera Samarawickrama | Wicketkeeper | 371 runs |
| Prabath Jayasuriya | Spinner | 77 wickets |
| Ramesh Mendis | Spinner | 45 wickets |
| Lakshan Sandakan | Spinner | 40 wickets |
| Asitha Fernando | Fast bowler | 47 wickets |
| Kasun Rajitha | Fast bowler | 45 wickets |
| Vishwa Fernando | Fast bowler | 36 wickets |
| Lahiru Kumara | Fast bowler | 42 wickets |

### 🇧🇩 Bangladesh
| Player | Role | Key Stats |
|--------|------|-----------|
| Shadman Islam | Opener | 631 runs |
| Mahmudul Hasan Joy | Opener | 511 runs |
| Zakir Hasan | Opener | 211 runs |
| Najmul Hossain Shanto | Middle-order | 1,417 runs |
| Mominul Haque | Middle-order | 3,557 runs |
| Mushfiqur Rahim | Wicketkeeper | 5,727 runs |
| Liton Das | Wicketkeeper | 1,159 runs |
| Shakib Al Hasan | All-rounder | 4,600 runs, 246 wickets |
| Mehidy Hasan | Spinner | 161 wickets |
| Taijul Islam | Spinner | 127 wickets |
| Nayeem Hasan | Spinner | 53 wickets |
| Taskin Ahmed | Fast bowler | 45 wickets |
| Khaled Ahmed | Fast bowler | 26 wickets |
| Shoriful Islam | Fast bowler | 26 wickets |
| Ebadot Hossain | Fast bowler | 31 wickets |

### 🇿🇼 Zimbabwe
| Player | Role | Key Stats |
|--------|------|-----------|
| Tanunurwa Makoni | Opener | 184 runs |
| Takudzwanashe Kaitano | Opener | 254 runs |
| Joylord Gumbie | Opener | 173 runs |
| Craig Ervine | Middle-order | 1,666 runs |
| Sean Williams | All-rounder | 1,872 runs, 22 wickets |
| Milton Shumba | Middle-order | 260 runs |
| Sikandar Raza | All-rounder | 1,532 runs, 31 wickets |
| Regis Chakabva | Wicketkeeper | 983 runs |
| Brandon Mavuta | Spinner | 22 wickets |
| Wellington Masakadza | Spinner | 16 wickets |
| Tendai Chatara | Fast bowler | 89 wickets |
| Richard Ngarava | Fast bowler | 34 wickets |
| Victor Nyauchi | Fast bowler | 21 wickets |
| Blessing Muzarabani | Fast bowler | 33 wickets |

---

## Rating System

### Era-Normalized Indices

All stats normalized against contemporaries, not raw numbers.

**Batting Index:**
```
Batting Index = (Player Avg ÷ Mean Avg of Top-6 in Era) × 100
```

**Bowling Index:**
```
Bowling Index = (Mean Era Avg ÷ Player Avg) × 100 (60%) + Strike Rate Index (40%)
```

**Volume Multiplier:**
```
Volume = min(1, √(matches ÷ 40))
Minimum: 20 Tests to qualify
```

### The Bradman Curve

Bradman's index ≈ 280, everyone else tops at ~170.

**Fix:** Diminishing returns on aggregate. Run team total through a concave curve so marginal value of best player is discounted vs. fourth-best.

**Why:** Makes the game about your weakest 3 picks, not one jackpot.

### Team Balance Modifiers

| Condition | Modifier |
|-----------|----------|
| No frontline spinner | -15% bowling score |
| All bowlers same type | -10% bowling score |
| Left-arm or wrist-spinner | +5% bowling score |
| Keeper averages <25 | -10% batting depth |
| Top-heavy XI | -5% team score |
| Fake all-rounder | Doesn't count toward 20 wickets |

**Publish this on `/how-it-works`** — arguments about weightings = free traffic and links.

---

## Output: Series Result

Convert team score gap → win probability → 5-match series:

```
Your XI beat Beat My 11 3–2
```

Deterministic, shareable, argument-generating.

---

## Retention Hooks

- **Daily Seed**: Same 6 spins for everyone today (Wordle mechanic)
- **Streaks**: Days in a row you beat house XI
- **Share Card**: Clean XI graphic with series result
- **Weekly House XI**: Rotating guest teams, nation-specific XIs

---

## Technical Constraints

### Data Sources

- **ESPNcricinfo**: Terms prohibit scraping
- **Cricsheet**: Open license, ball-by-ball recent only
- **Solution**: Curated ~500 player database by hand

### Images

- Player photos = legal exposure
- **Solution**: Silhouettes, illustrations, text-only cards

---

## MVP Scope

- Test format only
- ~500 curated players
- 6 spins × 2 picks
- 12 slots including keeper
- Feasibility guard
- Transparent rating formula
- Series result vs fixed XI
- Share card
- No login required

---

## Next Steps

1. ✅ Lock era structure
2. ✅ Build player database (all decades complete)
3. 🔄 Design UI/UX for spins
4. 🔄 Build rating/scoring engine
5. 🔄 Create BeatMy11 house team
6. 🔄 Develop frontend (Astro + Tailwind)
7. 🔄 Implement share cards
8. 🔄 Add daily seed system

---

## File Structure for Development

```
beatmy11.com/
├── docs/
│   ├── beatmy11.md (this file)
│   ├── cricket-data.md
│   ├── game-rules.md
│   ├── player-pools.md
│   └── cricket-seo.md
├── src/
│   ├── data/
│   │   ├── legends.json
│   │   ├── 1970s.json
│   │   ├── 1980s.json
│   │   ├── 1990s.json
│   │   ├── 2000s.json
│   │   ├── 2010s.json
│   │   └── 2020s.json
│   ├── lib/
│   │   ├── ratings.ts
│   │   ├── simulation.ts
│   │   └── game-engine.ts
│   └── pages/
│       ├── index.astro
│       ├── play.astro
│       ├── how-it-works.astro
│       └── share/[id].astro
└── public/
    └── assets/
```

---

*This document is the master specification for BeatMy11.com. All development decisions should reference this file.*

# Fair reviews and research breakthroughs – design

Two new mods, each with its own switch in Settings > BetterDT > Mods:

- `fair-reviews.js` – the review score comes from all aspects of a device, the shown reviews are its two best
  and two worst categories, and a breakdown of all categories is shown on the review screen.
- `research-breakthroughs.js` – a finished research lab project can research up to three parts that would
  normally become available within a year; devices with such parts get an innovation bonus.

Facts this design rests on were checked in game 1.6 (test copy, save in memory):

- Every device type has its own review function (`ReviewsEngine_<Type>`, 16 types). It fills
  `ArrayReviews_Temp` with aspect entries (indices into `ArrayReviews_DB`, which holds a score range per
  index, and into `ArrayReviews_<LANG>`, which holds the text). `ReviewsEngineResults` then shuffles the
  entries, gives each of 4 reviewers one of them and sets `ReviewRating_1..4` to a random score in the range.
- The stored rating is `round(mean(ReviewRating_1..4))`, written to the device's design array (z 100) by 32
  actions in `REVIEWS UI [Engine]` (16 types × 2 ways to leave the screen). `ReviewsTotal_ON` shows the same
  mean as the total.
- Function-call actions bind `EventBlock.prototype.RunAsFunctionCall` at start, so patching the prototype
  later does nothing. Each call site is an action in the event sheet manager (`_actsBySid`, reached through
  `C3.EventSheetManager.prototype.GetFunctionBlockByName` during a `runtime.callFunction`). Its `Run` can be
  wrapped. The same works for any action by its SID. Verified: wrapping all 10 955 call sites counted the
  daily functions (`ResearchInvestEngine`, `MyEmployeesEngine`, ...).
- A research level (`ArrayMyResearch`) of a category with a dated component array is the number of unlocked
  rows: the editor's "+" button stops at row `level − 1`. The editor list itself (`<Type>Page<N>_ButtonsOpacity`
  and the JS port `_rebuildWindowed`) only goes up to the newest row with born day ≤ `DayTotal`. A level above
  that count is kept by the game (set 21 with 20 dated rows, still 21 after several days).
- Design arrays keep every released device (x = device, newest first; y = model 0..2; z = spec column), the
  same data the "My devices" pages show.
- Daily sales of a device are `potential × DAILY_SHARE × POP/100 × jitter`; popularity decay is subtracted
  and does not depend on the popularity itself.
- `simulateDeviceCost(type, year, 'flagship', runtime)` exists for all 16 types.
- Research lab: a project runs 30 days. Each day, every employee on a RESEARCH position who is not on
  vacation adds `(1.25 + avgSkill/1000 × (1 + invested/1e6)) × (1 + 0.15 × perk level)` RP to the pool, which
  is capped by the lab's size.

## 1. Fair reviews

### 1.1 Hook

The mod wraps the call sites of `ReviewsEngineResults`. After the game's own run it reads the aspect entries
from `ArrayReviews_Temp` and the device, computes everything below, then writes the 4 review texts
(`ArrayReviews_Text`, all languages the game uses) and `ReviewRating_1..4` (the 4 shown scores). The call sites
of `ReviewsTotal_ON` and the 32 rating writes are wrapped so that during them `ReviewRating_1..4` all hold the
final rating; afterwards the 4 shown scores are put back.

### 1.2 Aspect kinds

Every aspect entry of the 16 review functions is put into a table (generated from the game's event sheets
and checked by hand) with its kind and category:

1. **Generational** – the game compares the chosen row of a component array with the newest dated row
   (`FunctionID_Max`). The mod counts the generations itself (newest dated row − chosen row; a row from the
   future counts as 0) and scores it with table 1.4.
2. **Yes/no** – a feature the device has (7–10) or lacks (1–3). The game's score is kept. In the budget class
   a missing feature is left out.
3. **Other** – the game's score is kept.

An aspect's score is uniform random in its range, one decimal.

### 1.3 Price class

- Flagship price = `simulateDeviceCost(type, current year, 'flagship') × 1.3`.
- Share = selling price / flagship price.
- Class: share ≤ 40 % budget, 40–75 % mid, > 75 % flagship.

The class and the flagship price are used internally only; they are never shown.

### 1.4 Generations

| Generations behind | Budget | Mid | Flagship |
|---|---|---|---|
| 0 or a part from the future | 8–10 | 8–10 | 8–10 |
| 1 | 6–7 | 6–7 | 6–7 |
| 2 | 5–6 | 5–6 | 4–5 |
| 3 | 5–6 | 4–5 | 1–3 |
| 4 | 4–5 | 1–3 | 1–3 |
| 5 or more | 1–3 | 1–3 | 1–3 |

This replaces the game's thresholds by model position, and makes "excellent" reachable for the smartphone
and tablet screen resolution (the game never uses its 8–10 entry).

### 1.5 Price

- Markup = (selling price / unit cost − 1) × 100 %.
- Base limits 20 / 30 / 35 / 40 %: below 20 → 9–10, 20–30 → 7–8, 30–35 → 5–6, 35–40 → 3–4, 40 and more → 1–2.
- All limits move by the class (budget −5, mid 0, flagship +10) and by the innovative parts (+5 for each of
  the first 3, +1 for each 4th–10th, at most +22).
- Price weighs 2. When the markup reaches the third limit (overpriced), price is always one of the two worst
  shown reviews.

### 1.6 Value for money (all types)

- Quality = mean over the generational aspects of `max(0, 1 − generations/6)`; the class does not change it.
- Ratio = quality / share (1.3).
- Score: ratio ≥ 2.0 → 10; 1.3–2.0 → 8–10 linear; 0.9–1.3 → 4–7 linear; 0.3–0.9 → 1–3 linear; below 0.3 → 1;
  then ±0.5 random, kept in 1–10.

### 1.7 Innovation (only with an innovative part)

An innovative part is a part whose row's born day is later than the review day.

| Innovative parts | 1 | 2 | 3 | 4 | 6 | 10+ |
|---|---|---|---|---|---|---|
| Score | 8.0 | 8.5 | 9.0 | 9.15 | 9.45 | 10.0 |

1st part 8.0, 2nd and 3rd +0.5, 4th–10th +0.15; then ±0.3 random, at most 10.

### 1.8 Categories

All types also have Price and Value for money, and Innovation when it applies. Every aspect belongs to
exactly one category; a category's score is the mean of its aspects.

| Type | Categories |
|---|---|
| Smartphone, tablet | Display, Camera, Video, Processor, Memory, Battery, Connectivity, Sound, Design, Features |
| Laptop | Display, Processor, Memory, Battery, Connectivity, Sound, Webcam, Design, Features |
| Watches | Display, Memory, Battery, Connectivity, Sound, Design, Health and features |
| Headphones | Sound, Battery, Connectivity, Design, Features |
| TV | Picture, Sound, Connectivity, Performance and memory, Design, Features |
| Scooter | Ride, Battery and range, Safety, Comfort, Smart features, Design |
| Keyboard | Keys, Connectivity, Design, Features |
| Console | Performance, Memory, Picture, Connectivity, Sound, Design, Features |
| Gamepad | Controls, Battery, Connectivity, Design, Features |
| VR | Display, Performance, Memory, Cameras and tracking, Connectivity, Battery, Sound, Design, Features |
| Processors (4 types) | Performance, Memory and cache, Heat and power, Graphics, Chip features |
| Graphics card | Performance, Video memory, Interface, Technologies |

### 1.9 Rating and the 4 reviews

- Shown: the 2 highest and the 2 lowest categories (an overpriced price replaces the higher of the two lowest).
- Text: for a good category the text of its best aspect, for a bad one the text of its worst aspect, from the
  game's texts. Price uses the game's price texts of its band. Value for money gets 3 new texts per band
  (bad, normal, excellent) and Innovation 3 new texts, in all 15 languages.
- Number at a review = its category score rounded.
- Final rating = weighted mean of all categories (weight 1, price 2; the 4 shown ×1.25), +U(−0.3, 0.3),
  rounded, kept in 1–10. This is the total and the stored rating.

### 1.10 Breakdown

A strip at the bottom of the review screen (HTML overlay, only while that screen is open):

- One item per category: the score with one decimal and a star next to it, filled yellow from the left by
  score/10 (0 white, 10 all yellow, continuous); the category name below.
- The 4 shown categories have a frame.
- Above the strip, for devices with innovative parts: "Innovative parts: n".
- The strip wraps to two rows when the categories do not fit.

### 1.11 Game bugs fixed

- Generational aspects can reach "excellent" (1.4).
- Smartphone and tablet: at a feature load of 80 % or more the game takes a text from 234–245, which mixes the
  energy-efficiency texts; it is meant to be 243–245 ("high load"), and the mod uses that.

## 2. Research breakthroughs

### 2.1 When

When a lab project ends: the wrapped call sites of `ResearchInvestEngine` see the days left go from 1 to 0.
The yield Y is the pool at that moment.

### 2.2 How many

Attempt i succeeds with `p = Y^0.6 / (Y^0.6 + K_i^0.6)`, K = 900, 3 600, 12 000; the 2nd and 3rd attempt only
happen after a success.

| Yield | ≥ 1 | ≥ 2 | 3 |
|---|---|---|---|
| 200 RP | 29 % | 4 % | 0 % |
| 700 RP | 46 % | 13 % | 2 % |
| 2 000 RP | 62 % | 25 % | 6 % |
| 5 000 RP | 74 % | 40 % | 15 % |
| 24 000 RP | 88 % | 66 % | 40 % |

### 2.3 Candidates

A research category with a dated component array that is available now (its device type is unlocked and its
start day has passed). A = rows with born day ≤ today, L = your level.

- L ≥ A: the target is row L; it must have a born day ≤ today + 365; the level becomes L + 1.
- L < A: a candidate only if A − L ≤ 4 and (A − L = 1 or (A − L) × RP cost per level ≤ 120). The target is
  row A, born day ≤ today + 365; the level becomes A + 1, so the missing levels come free.
- One project's breakthroughs go to different categories. A later project can hit the same category again.

### 2.4 Relevance

Categories of device types you released in the last 730 days (release day, design array z 122) weigh 3,
others 1; when you released nothing in that time all weigh 1. Categories are drawn by weight without
replacement.

### 2.5 Editor

After the game rebuilds an editor list (wrapped call sites of the editor list functions, and a microtask after
`SetSize` of the editor `_Temp` arrays for the JS path) the mod appends the rows from A up to L − 1, so "+"
can reach them. The unit cost of such a part is the game's cost of the newest part.

### 2.6 Message

An office dialog in the style of the game's news, with OK: "Research breakthrough!" and the parts with the
date they would normally have become available.

## 3. Innovation sales bonus

While the daily sales tick reads a device's popularity, the mod returns it × (1 + bonus); the decay written
back is the game's own (the mod wraps `getAt`/`setAt` of the selling arrays for the POP column of innovative
devices only).

| Innovative parts | 1 | 2 | 3 | 4 | 6 | 10+ |
|---|---|---|---|---|---|---|
| Bonus | +10 % | +20 % | +25 % | +27 % | +31 % | +39 % |

Each part counts fully until its normal born day, then fades to 0 over 60 days. The innovative parts are read
from the design array, so nothing extra is saved. The market's total potential stays the same: a device that
would not use it all sells more units, one that would sells the same stock sooner.

## 4. Switching off

- Fair reviews off: the game's own reviews.
- Breakthroughs off: levels already gained stay (they are game data), but the editor does not offer future
  parts until their date, and no new breakthroughs happen.

## 5. Tests (test copy, save in memory)

- Reviews for all 16 types.
- The same device reviewed 20 times: the final rating varies by at most 1.
- Budget, mid and flagship devices; an overpriced device with and without innovation.
- 200 finished projects: frequencies match 2.2, the gap rules of 2.3 hold, relevance weights hold.
- A future part chosen in the editor and reviewed as innovative.
- Sales bonus compared with the same device without innovation.

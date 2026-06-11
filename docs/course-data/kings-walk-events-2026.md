# King's Walk — 2026 event calendar

Manually-transcribed event schedule for King's Walk Golf Course, 2026
season. Used by the future planning view (item 6 in `docs/BRETT-TODO.md`)
so the upcoming-week selector knows which days are blocked by
tournaments / leagues / closures.

- Source: Brett, ingested 2026-06-11.
- Format: this file is the manual-entry seed; eventually a `CourseEvent`
  Prisma model can be hydrated from it.

## Source anomalies (flag for Brett to verify)

Four weekday/date mismatches found while transcribing. Could be source
typos (calendar reused from a previous year without updating the day
names). Recorded the **date** verbatim and noted the conflict; weekday
column reflects the actual 2026 weekday, not the source's label.

| Source label              | Actual 2026 weekday | Notes |
|---------------------------|---------------------|-------|
| "Monday, August 11: FCA Golf Classic" | Tuesday   | Also a duplicate of Aug 10's FCA Golf Classic (same time, same event) — almost certainly a typo. Recommend removing one. |
| "Wednesday, September 24" | Thursday            | KW Senior Open |
| "Sunday, September 28"    | Monday              | EDC Girls Tournament |
| "Saturday, October 18"    | Sunday              | Polar Bear 4-Person Scramble |

## Events

Impact column:
- `shotgun` — full course blocked during stated window (all players on
  course simultaneously).
- `tournament` — likely full or near-full block; may or may not be shotgun.
- `league` — recurring weekly slot; partial block.
- `lesson` — minor impact (range / one or two holes).
- `demo` — minor impact (range / not on course).
- `closure` — course unavailable.

| Date (ISO)   | Day | Time            | Event                                                      | Impact      | Notes |
|--------------|-----|-----------------|------------------------------------------------------------|-------------|-------|
| 2026-04-22   | Wed | 9:00 am         | Boy's EDC Meet (JV at Lincoln)                             | tournament  | JV at Lincoln — may not affect KW |
| 2026-05-03   | Sun | —               | Spring 1-Person Scramble                                   | shotgun     | |
| 2026-05-11   | Mon | —               | Monday Men's Club begins                                   | league      | Recurring Mondays |
| 2026-05-12   | Tue | 8:30 am shotgun | Class B Regional Golf Meet                                 | shotgun     | |
| 2026-05-14   | Thu | —               | Thursday Men's Match League begins                         | league      | Recurring Thursdays |
| 2026-05-19   | Tue | —               | KW Ladies League opening night                             | league      | Recurring Tuesdays |
| 2026-05-25   | Mon | 8:30 am shotgun | Memorial Day 3-Man Scramble                                | shotgun     | |
| 2026-05-26   | Tue | —               | "Divot a Try" — Women's Beginner Lessons begin             | lesson      | Recurring |
| 2026-06-01   | Mon | 12:00 pm        | Lions Club Golf Fundraiser                                 | tournament  | In memory of Lowell Schweigert & Wayne Westlund |
| 2026-06-05   | Fri | 5:30 pm shotgun | Couples Event #1                                           | shotgun     | |
| 2026-06-06   | Sat | 1:00 pm         | VertaCat Demo Day                                          | demo        | |
| 2026-06-06   | Sat | 2:00–6:00 pm    | Callaway Demo Day                                          | demo        | |
| 2026-06-07   | Sun | 8:00 am shotgun | ND State Women's Scramble                                  | shotgun     | |
| 2026-06-08   | Mon | —               | Free Introductory Golf Clinic for Kids                     | lesson      | Sponsored by DJGA and NDGA |
| 2026-06-08   | Mon | 12:00 pm        | Young Life Scramble                                        | tournament  | |
| 2026-06-11   | Thu | 10:30 am shotgun | Altru Foundation                                          | shotgun     | |
| 2026-06-18   | Thu | 9:30 am reg / 10:30 am shotgun | Longest Day for Alzheimer's Research        | shotgun     | |
| 2026-06-22   | Mon | —               | DJGA — Grand Forks Junior Tournament                       | tournament  | |
| 2026-06-24   | Wed | —               | DJGA — Grand Forks Junior Tournament                       | tournament  | |
| 2026-06-25   | Thu | 12:30 pm shotgun | BLC Fundraiser / Keep the Ball Rollin'                    | shotgun     | In honor of Perry & Tyler Nakonechny |
| 2026-06-30   | Tue | 8:00 am         | MN PGA Junior Tour                                         | tournament  | |
| 2026-07-03   | Fri | 8:00 am shotgun | Firecracker Best Ball                                      | shotgun     | |
| 2026-07-09   | Thu | 12:00 pm        | Rumors Bar & Grill Fundraiser                              | tournament  | |
| 2026-07-12   | Sun | 4:00 pm shotgun | Couples Event #2                                           | shotgun     | |
| 2026-07-14   | Tue | 1:00 pm         | John Deere Dealers & Customers Golf Outing                 | tournament  | |
| 2026-07-16   | Thu | 12:00 pm shotgun | Valley Memorial Golf Tournament                           | shotgun     | |
| 2026-07-23   | Thu | 12:00 pm shotgun | Bruce Spicer Memorial Tournament                          | shotgun     | |
| 2026-07-27   | Mon | 12:00 pm        | Grand Forks HS Coaches Golf Scramble                       | tournament  | |
| 2026-07-30   | Thu | 9:00 am scramble | Airport GFK                                               | tournament  | |
| 2026-08-07   | Fri | 5:30 pm shotgun | Couples Event #3                                           | shotgun     | |
| 2026-08-10   | Mon | 12:30 pm        | FCA Golf Classic                                           | tournament  | See anomalies — duplicated as "Aug 11" in source |
| 2026-08-13   | Thu | —               | ND AG & Shriners Golf Events                               | tournament  | |
| 2026-08-15   | Sat | —               | All City Golf Tournament (day 1)                           | tournament  | |
| 2026-08-16   | Sun | —               | All City Golf Tournament (day 2)                           | tournament  | |
| 2026-08-20   | Thu | 11:00 am shotgun | Birdies for Hope (Cancer Center)                          | shotgun     | |
| 2026-08-27   | Thu | 11:00 am shotgun | Red River Children's Advocacy Center                      | shotgun     | |
| 2026-08-30   | Sun | 7:30 am         | King's Walk Club Championship                              | tournament  | |
| 2026-08-31   | Mon | —               | COURSE CLOSED — Green Aerification                         | closure     | 7–10 day green recovery expected; greens may play poor through ~Sep 7–10 |
| 2026-09-09   | Wed | 9:00 am shotgun | EDC Girls (JV at Lincoln)                                  | shotgun     | JV at Lincoln — confirm if it actually blocks KW |
| 2026-09-10   | Thu | 12:00 pm        | YMCA Golf Scramble                                         | tournament  | |
| 2026-09-13   | Sun | 8:30 am shotgun | Triple Play & Shootout                                     | shotgun     | |
| 2026-09-17   | Thu | 11:00 am        | Oxford Realty Golf Outing                                  | tournament  | |
| 2026-09-19   | Sat | —               | Fall Classic Best Ball Tournament (day 1)                  | tournament  | |
| 2026-09-20   | Sun | —               | Fall Classic Best Ball Tournament (day 2)                  | tournament  | |
| 2026-09-24   | Thu | 9:30 am shotgun | KW Senior Open                                             | shotgun     | Source labeled Wednesday — flagged in anomalies |
| 2026-09-28   | Mon | —               | EDC Girls Tournament                                       | tournament  | Source labeled Sunday — flagged in anomalies |
| 2026-10-04   | Sun | 9:00 am shotgun | Fall 1-Person Scramble                                     | shotgun     | |
| 2026-10-18   | Sun | 10:00 am        | Polar Bear 4-Person Scramble                               | tournament  | Source labeled Saturday — flagged in anomalies |

## Open questions for Brett

- The **Boy's EDC Meet (Apr 22)** and **EDC Girls (Sep 9)** both say
  "JV at Lincoln" — does that mean the JV team plays at Lincoln Park
  (so KW is unaffected), or that the meet is hosted at KW with JV at
  Lincoln? Clarify before the planner uses these.
- **FCA Golf Classic** — confirm it's only on Aug 10 and the Aug 11
  entry is a duplicate typo.
- Verify **KW Senior Open** is Thu Sep 24 (not Wed as the source said).
- Verify **EDC Girls Tournament** is Mon Sep 28 (not Sun).
- Verify **Polar Bear Scramble** is Sun Oct 18 (not Sat).
- **Recurring leagues** (Monday Men's Club, Thursday Match League,
  Tuesday Ladies League, Tuesday Lessons): need their end dates and
  weekly time slots before the planner can correctly show them as
  blocked every week of the season.

## Source (verbatim, for provenance)

```
APRIL 2026
Wednesday, April 22: Boy's EDC Meet (JV at Lincoln) | 9:00 am

MAY 2026
Sunday, May 3: Spring 1-Person Scramble
Monday, May 11: Monday Men's Club Begins
Tuesday, May 12: Class B Regional Golf Meet | 8:30 am shotgun
Thursday, May 14: Thursday Men's Match League Begins
Tuesday, May 19: KW Ladies League | Opening Night
Monday, May 25: Memorial Day 3-Man Scramble | 8:30 am shotgun
Tuesday, May 26: Divot a Try – Women's Beginner Lessons Begin

JUNE 2026
Monday, June 1: Lions Club Golf Fundraiser | 12:00 pm
  In memory of Lowell Schweigert & Wayne Westlund
Friday, June 5: Couples Event #1 | 5:30 pm Shotgun Start
Saturday, June 6: VertaCat Demo Day | 1:00 pm
Saturday, June 6: Callaway Demo Day | 2:00 pm – 6:00 pm
Sunday, June 7: ND State Women's Scramble | 8:00 am Shotgun Start
Monday, June 8: Free Introductory Golf Clinic for Kids
  Sponsored by DJGA and NDGA
Monday, June 8: Young Life Scramble | 12:00 pm
Thursday, June 11: Altru Foundation | 10:30 am Shotgun Start
Thursday, June 18: Longest Day for Alzheimer's Research | Registration begins at 9:30 am | 10:30 am Shotgun Start
Monday, June 22: DJGA – Grand Forks Junior Tournament
Wednesday, June 24: DJGA – Grand Forks Junior Tournament
Thursday, June 25: BLC Fundraiser/Keep the Ball Rollin' | 12:30 pm Shotgun Start
  In honor of Perry & Tyler Nakonechny
Tuesday, June 30: MN PGA Junior Tour | 8:00 am

JULY 2026
Friday, July 3: Firecracker Best Ball | 8:00 am shotgun
Thursday, July 9: Rumors Bar & Grill Fundraiser | 12:00 pm
Sunday, July 12: Couples Event #2 | 4:00 pm Shotgun Start
Tuesday, July 14: John Deere Dealers & Customers Golf Outing | 1:00 pm
Thursday, July 16: Valley Memorial Golf Tournament | 12:00 pm Shotgun Start
Thursday, July 23: Bruce Spicer Memorial Tournament | 12:00 pm Shotgun Start
Monday, July 27: Grand Forks High School Coaches Golf Scramble | 12:00 pm
Thursday, July 30: Airport GFK | Scramble 9:00 am

AUGUST 2026
Friday, August 7: Couples Event #3 | 5:30 pm Shotgun Start
Monday, August 10: FCA Golf Classic | 12:30 pm
Thursday, August 13: ND AG & Shriners Golf Events
Monday, August 11: FCA Golf Classic | 12:30 pm                  [SOURCE — duplicate; weekday wrong]
Saturday & Sunday, August 15-16: All City Golf Tournament
Thursday, August 20: Birdies for Hope (Cancer Center) | 11:00 am Shotgun Start
Thursday, August 27: Red River Children's Advocacy Center | 11:00 am Shotgun Start
Sunday, August 30: King's Walk Club Championship | 7:30 am
Monday, August 31: COURSE CLOSED (Green Aerification *7-10 days for greens to completely heal)

SEPTEMBER 2026
Wednesday, September 9: EDC Girl's (JV at Lincoln) | 9:00 am Shotgun Start
Thursday, September 10: YMCA Golf Scramble | 12:00 pm
Sunday, September 13: Triple Play & Shootout | 8:30 am Shotgun Start
Thursday, September 17: Oxford Realty Golf Outing | 11:00 am
Saturday & Sunday, September 19-20: Fall Classic Best Ball Tournament
Wednesday, September 24: KW Senior Open | 9:30 am Shotgun Start  [SOURCE — actually Thursday]
Sunday, September 28: EDC Girls Tournament                       [SOURCE — actually Monday]

OCTOBER 2026
Sunday, October 4: Fall 1-Person Scramble | 9:00 am Shotgun
Saturday, October 18: Polar Bear 4-Person Scramble | 10:00 am    [SOURCE — actually Sunday]
```

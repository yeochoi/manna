# Manna

A little Bible every day. Manna picks up where you left off, gives you a few chapters a day, and lets AI write a short, easy summary and one key message for each reading. It runs as a responsive web app on phones and laptops, in Korean with 개역한글 and in English with the World English Bible.

## Principles

1. **One reading per day.** Today answers one question, what do I read today. The title is the range, like 사무엘상 24~26장. Everything else sits below it.
2. **Summary first, passage on request.** The easy summary is open. The full passage waits in a card you open, so the screen never starts as a wall of text.
3. **Green means done and go.** Green is for actions, finished days and progress. Coral only appears when something failed.
4. **Calm, warm, quiet.** Off white ground, white cards, one green. No pictures, no gradients, one tiny shadow.
5. **Same family as Stay Counter and Shuo.** The same ground, card shapes, type scale, chevron and layout rules, with its own colour.

## Content

- Plain words, sentence case, short. No colons, semicolons or dashes in UI text.
- Korean is the first language. English follows the same structure.
- The summary language follows the translation. 개역한글 gives a Korean summary, WEB an English one.
- Ranges read naturally, like 사무엘상 24~26장 or 1 Samuel 24–26.
- The key message is one sentence about how to live, never a sermon.
- Verses are quoted from local data, never from the AI. The AI only points to which verse.

## Color

| Role | Tokens | Use |
| --- | --- | --- |
| Action | `primary`, `green-text`, `soft`, `halo` | Buttons, selected day, current tab, links, chips, the key message |
| Ground | `bg`, `surface`, `line` | Screens, cards, dividers |
| Text | `ink`, `muted` | Content and labels |
| Quiet | `chip`, `chip-text`, `chevron` | Round buttons, notes, chevrons, future days |
| Attention | `coral-text`, `coral-soft` | Errors and the reset action only |

Rules
- `primary` is a fill. Green text always uses `green-text`.
- Text passes 4.5 to 1 wherever it sits, icons and the chevron pass 3 to 1. The token notes list each pair.

## Typography

Outfit for Latin letters and numbers, Noto Sans KR for Korean, both from Google Fonts. Four text styles in three sizes, the same as Stay Counter and Shuo, plus one size for Bible verses.

| Style | Size | Weight | For |
| --- | --- | --- | --- |
| `display` | 34, 44 on laptop | Semibold | Today's reading, Journal, the first open headline, stats |
| `title` | 15 | Semibold | Section headers, card titles, buttons, the month, summary numbers |
| `body` | 15 | Regular | Summary points, key verse, key message, journal messages, rows |
| `small` | 13 | Regular | Dates, verse labels, verse numbers, chips, tab labels, notes |
| `reading` | 17, line 1.75 | Regular | Verses in the passage only |

Rules
- Only 400 and 600. A header differs from text by weight only, never by size.
- Text inputs use 16 so iOS does not zoom.
- Large text uses minus 0.02em letter spacing. Korean keeps whole words together on a line break.

## Layout

- Phones use a 22 side margin. Laptops center content inside `max-width` 1040, with backgrounds running full width.
- Today and a past day use two columns on laptops. The summary stays beside the passage while you read.
- Sections start with a `title` header in ink, 24 above and 8 above the card. Cards are white with a 1px `line` border and `radius-card`. No shadows.
- Every chevron is 16 in `chevron`. Right on a card that opens a page, down on a card that opens in place.

## Navigation

- Two tabs, Today and Journal. Phones have a bottom bar, laptops a top bar with Manna on the left.
- Tapping the current tab scrolls to the top.
- Settings sits behind the round gear on Today.
- Settings ends with About, where Design system opens this system inside the app, built from the app's own styles.
- The passage opens in place inside its card. A long passage shows a slim bar at the top with the range and progress while you read.
- Once you are a screen into an open passage, a round back to top button appears bottom right, above the tabs, near the thumb. It is `surface` with a `line` border and a `green-text` chevron, 48 wide. Tapping it scrolls to the top and moves focus to the page title.

## Iconography

- Line icons, 1.8 stroke, round caps and joins, 24 grid. Chevrons use 2 stroke at 16.
- The selected tab keeps the same line icon and changes colour only.
- The mark is an open book in `primary` on `soft`, on a white rounded square.

## Accessibility

- WCAG 2.2 AA. Targets are at least 44 where they can be, never under 24.
- Focus rings are 2px `primary` with a 2px gap.
- Motion is limited to the reading bar and loading bars, and both stop when reduced motion is on.

# Manna

A little Bible every day. Manna picks up where you left off, gives you a few chapters a day, and lets AI write a short, easy summary and one key message for each reading. It runs as a responsive web app on phones and laptops, in Korean with the Korean Revised Version and in English with the World English Bible.

## Principles

1. **One reading per day.** Today answers one question, what do I read today. The title is the range, like 1 Samuel 24–26. Everything else sits below it.
2. **Summary first, passage on request.** The easy summary is open. The full passage waits in a card you open, so the screen never starts as a wall of text.
3. **Green means done and go.** Green is for actions, finished days and progress. Coral only appears when something failed.
4. **Calm, warm, quiet.** Warm white ground, sage for selection, one green. Few boxes. Layers follow iOS. Glass with a shadow only on things that float over content, everything on the page is flat.
5. **Same family as Stay Counter and Shuo.** The same type scale, chevron and layout rules, with its own colour.

## Content

- Plain words, sentence case, short. No colons, semicolons or dashes in UI text.
- Korean is the first language. English follows the same structure.
- The summary language follows the translation. The Korean Revised Version gives a Korean summary, WEB an English one.
- Ranges read naturally, like 1 Samuel 24–26 or 1 Samuel 24–26.
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

Outfit for Latin letters and numbers, Noto Sans KR for Korean, both from Google Fonts. Five text styles, plus one size for Bible verses.

| Style | Size | Weight | For |
| --- | --- | --- | --- |
| `display` | 34, 44 on laptop | Semibold | Today's reading, Journal, the first open headline, stats |
| `section` | 20 | Semibold | Section headers, like Summary, Passage and the Settings groups |
| `title` | 17 | Semibold | Card titles, buttons, the month, summary numbers, chapter names |
| `body` | 17 | Regular | Summary points, key verse, key message, journal messages, rows |
| `small` | 13 | Regular | Dates, verse labels, verse numbers, chips, tab labels, notes |
| `reading` | 17, line 1.75 | Regular | Verses in the passage only |

Rules
- Only 400 and 600. Section headers are 20 so the sections on a page stand out. Inside a section, a header differs from text by weight only.
- Sections of the same level share one header style and one rhythm. 32 above a header, exactly 12 between the header and its content, measured from the text. Taller tap areas add their height above the text, never below. Summary includes the key verse and key message with no divider inside. A hairline only separates sections.
- Text inputs use 17, so iOS does not zoom. Bible verses use the same 17 with more line space.
- Large text uses minus 0.02em letter spacing. Korean keeps whole words together on a line break.

## Layout

- Phones use a 22 side margin. Laptops center content inside `max-width` 1040, with backgrounds running full width.
- Today and a past day use two columns on laptops. The summary stays beside the passage while you read.
- Sections start with a `title` header in ink. Content sits right on the ground: no header band, no boxes around the summary, passage or calendar. Sections are split by a 1px `line` hairline. Settings keep white cards with a 1px `line` border and `radius-card`, because grouped controls need a container.
- Destructive actions always go last. A single one is plain coral text, centered. Two or more related ones are grouped in one card. They always ask first.
- Buttons have one job per style. Primary green fill for the one main action. Secondary white with a line for every other action, like Read the next chapters. Round grey circle for icon only. Coral text for destructive. Sage is never a button, it only highlights.
- Passage is one row everywhere. Open while you read today, closed after and in the Journal. When open, a round listen icon sits 8 after the word Passage. It reads verse by verse with the phone's voice and highlights the current verse in `soft`, drawn behind the text so nothing moves. The reading bar holds a green play button and the speed, 0.8, 1 and 1.25. On iPhone the web app stops reading when the screen locks.
- A section heading can carry one icon action, a small flat round button, 8 after the words and centered on them. In a heading the circle is 32 with an 18 icon so it sits with the words, and the tap area stays 44. The content below starts 12 under the circle. Round buttons everywhere else stay 44. Key verse has Share, Passage has Listen. Share shows the picture card in a preview, then the phone's share sheet sends only the card.
- The AI writes the key message first, about all of today's chapters. Then it picks the one verse from those chapters that says the message most directly. The verse must make sense alone and stay short. The message never says "today's reading" or "this passage". The app and the shared card use the same message.
- The AI note, that the summary is a guide and the passage comes first, appears once in Settings under About, not under the summary every day.
- A floating control never covers a button. Floating controls hide or move when a button reaches them.
- Layers follow iOS. Things that float over content are glass with a shadow. That is the tab bar, the reading bar and back to top. Glass is white at 72 percent, blur 20, saturate 1.6, a soft shadow and a 1px inner highlight.
- Things on the page are flat. Every round button on the page, like the gear and close, is one grey circle. `chip`, 44 wide, a 20 icon with a 2 line in `ink`, no shadow, no line. The same in Shuo and Stay Counter.
- Cards only for controls and tappable lists, like Settings. Reading content sits on the page.
- On phones the tab bar is a floating glass pill, centered, 16 above the safe area. The current tab gets a `soft` sage pill at 90 percent with `green-text`. On laptops the tabs sit in a top bar on the ground with a light blur.
- Every chevron is 16 in `chevron`. Right on a card that opens a page, down on a card that opens in place.

## Navigation

- Two tabs, Today and Journal. Phones have a bottom bar, laptops a top bar with Manna on the left.
- Tapping the current tab scrolls to the top.
- Settings sits behind the round gear on Today.
- Settings ends with About, where Design system opens this system inside the app, built from the app's own styles.
- The passage opens in place below its row. A long passage shows a floating glass bar at the top with the range and progress while you read.
- Once you are a screen into an open passage, a round back to top button appears bottom right, above the tabs, near the thumb. It floats, so it is glass with a shadow, 44 wide with a 20 `ink` chevron. Tapping it scrolls to the top and moves focus to the page title. It hides whenever a main button is in the corner it floats over, like "I've read it" at the end of the passage, so it never covers an action.

## Iconography

- Line icons, round caps and joins, 24 grid. Icons in round buttons are 20 with a 2 line. Chevrons use 2 stroke at 16.
- The selected tab keeps the same line icon and changes colour only.
- The mark is an open book in `primary` on `soft`, on a white rounded square.

## Accessibility

- WCAG 2.2 AA. Targets are at least 44 where they can be, never under 24.
- Focus rings are 2px `primary` with a 2px gap.
- Motion is limited to the reading bar and loading bars, and both stop when reduced motion is on.

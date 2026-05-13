# GOGI Lesson Generator

This folder is the strict input layer for 90-minute Cornell lesson decks.

The rule is simple: GOGI should not generate a PowerPoint from loose passage rows.
It should generate from a curated lesson excerpt file that has already passed validation.

## Folder Shape

- `excerpts/` — one markdown file per teachable excerpt.
- `fast-item-bank/` — released FAST-style items tagged by standard.
- `year-map.grade9.json` — the year sequence and lesson weight map.

## Validate Excerpts

```bash
npm run lesson:validate-excerpts
```

Or validate one file:

```bash
npm run lesson:validate-excerpts -- data/lesson-generator/excerpts/mdg_opening.md
```

The validator rejects:

- Missing cleaned passage.
- OCR junk or bracket gaps.
- Fewer than 4 or more than 5 vocabulary words.
- Invalid part-of-speech tags.
- Missing worked examples for supported standards.
- Worked-example analysis under 40 words.
- Banned placeholder language.


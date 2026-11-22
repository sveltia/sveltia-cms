# Translating new Sveltia CMS UI strings

Sveltia CMS is a Git-based headless CMS, a drop-in replacement for Netlify/Decap CMS. Its UI strings live in `src/lib/locales/<code>.yaml` in the repository at `%ROOT%` (ROOT below), and `en-US.yaml` is the source. English strings have been added or changed since your locale was last synced, and your job is to translate them for **one** locale, carefully and in context. Native localizers will review the result later, so aim for natural, idiomatic, consistent UI text, not a word-for-word rendering.

The work folder is `%OUT%` (OUT below).

## Inputs

- `OUT/todo/<code>.todo.json`: the strings to translate, in file order. Each item has `key` (the dotted path), `context` (the translator comments above the key in `en-US.yaml`; comments on enclosing sections come first, separated by `|`) and `en` (the current English). Items that also have `previous_en` and `current_translation` are existing strings whose English changed: update the translation to reflect the new English. If the current translation already conveys the new meaning, e.g. because your language has no plural forms, you may keep it, but include it in the output either way.
- `ROOT/src/lib/locales/<code>.yaml`: your locale’s existing translations. Read it first, thoroughly enough to adopt its terminology (entry, collection, asset, field, file, folder, publish, Editorial Workflow, draft, locale, slug, repository, branch, pull request and so on), register (formal or informal address), capitalization of buttons and titles, punctuation and quotation marks. Stay consistent with it.
- `ROOT/src/lib/locales/en-US.yaml`: the full source with comments, for the surrounding context. When a string’s meaning is unclear, search the code for the key, e.g. `grep -rn "move_to_top" ROOT/src/lib --include=*.svelte --include=*.js`, to see where and how it’s shown.

## Rules

- Messages use [Unicode MessageFormat 2](https://messageformat.unicode.org/) (MF2). Keep every placeholder (`{$name}`, `{$count}`…) exactly; you may reorder them. Keep the MF2 structure (`.input`, `.local`, `.match`, `{{ … }}` variants). Literal curly braces in text must be escaped as `\{` and `\}`, e.g. `\{\{fields.title\}\}`, exactly as in the English.
- Plurals: use only the [CLDR plural categories](https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html) your language has, plus `*` as the catch-all, which is always required and comes last. A language without plurals (Japanese, Korean, Chinese, Vietnamese…) must not use `one`; use the literal `1` if the wording really must differ for one item. Where `one` also covers 21, 31… (Russian, Ukrainian, Croatian…), a `one` variant must print the number, and wording without the number belongs under the literal `1`. With two selectors (`.match $a $b`), give every combination your language needs, each row with one key per selector. Align the variant keys with spaces like the English.
- Keep HTML tags (`<a>`, `<b>`, `<br>`…) with their structure, Markdown formatting and link targets as they are. Leave code spans in backticks untranslated: option names, values, file names and field types in backticks stay in English.
- Don’t translate product or service names: Sveltia CMS, Sveltia CMS Additions, GitHub, GitLab, Gitea, Forgejo, Git, Netlify, Decap CMS, OAuth, S3 and so on. Follow your existing file for feature names such as Editorial Workflow, whether it translates them or not, and treat related names like Preview Workflow and Open Authoring the same way.
- A placeholder such as a collection’s label may need a grammatical gender or case that your language marks; word the sentence so it reads correctly whatever the value is.
- Typography: use your language’s quotation marks in prose, as your existing file does, and straight quotes in code. Use the ellipsis character `…` where the English does. Use neutral, inclusive language.
- Don’t add or drop information. Keep the tone of a polished app UI.
- Write plain strings; the script handles YAML quoting.

## Output

Write the translations as JSON objects, `{ "<key>": "<translation>", … }`, covering every key of the todo file, split into part files of roughly 80–120 keys each: `OUT/out/<code>/01.json`, `02.json` and so on (create the folder). Write a multi-line MF2 message as a JSON string with `\n` line breaks, formatted like the English with variant rows indented by two spaces, and end it with `\n`. Make sure each file is valid JSON.

Then build and check, from ROOT:

```bash
node scripts/sync-locales.js apply <code> OUT/out/<code>/*.json
node scripts/check-locales.js --verbose | grep -E "^\S|  <code>  "
pnpm exec prettier --check src/lib/locales/<code>.yaml
```

`apply` rewrites your locale file in the order of `en-US.yaml`, under its comments, merging your JSON over the existing translations. It must print `<code>: complete` and no keys ignored as unknown, which would mean a misspelled key. The check must report no errors and no warnings for your locale; fix your JSON and run the commands again until it’s clean. If Prettier complains, run `pnpm exec prettier --write src/lib/locales/<code>.yaml` and make sure the content is unchanged.

Then review `git diff src/lib/locales/<code>.yaml`, and read your new strings once more in context for consistency, terminology and natural wording. Fix and rebuild as needed.

## Constraints

- Touch only `src/lib/locales/<code>.yaml` and your own `OUT/out/<code>/` folder. Other translators may be working on other locales at the same time in the same checkout: never edit, format or restore other files, and never run `git stash`, `git checkout`, `git reset` or `git commit`.
- Final report, under 150 words: the number of strings translated, whether the checks are clean, and the terminology choices or strings you were unsure about that a native reviewer should look at.

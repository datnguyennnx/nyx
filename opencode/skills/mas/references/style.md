# Style

Curated rules for mas prose: mas documents, skill files, agent files, and agent report envelopes. They come from the operator's review and rewriting standard, with tutorial, marketing, and UI microcopy rules dropped.

## Voice and tone

- Prefer active voice.
- Address the reader as “you”, never “the user” or “one”.
- Use the imperative for steps.
- Aim for sentences under 20 words. Keep related clauses together.
- Use contractions such as “you'll” and “it's”.
- Use present tense unless you describe past events or future behavior.
- Limit “we” to deliberate actions by the organization, never as a stand-in for “you”.
- Cut rhetorical questions, flattery, and pleasantries such as “Great question!” or “I hope this helps!”.
- Read once at speech pace. If you need another pass, name the subject, action, and consequence.
- Do not split one dependent idea into fragments.

## Word choice

- Prefer plain words. “utilize” becomes “use”, “facilitate” becomes “help”, “in the event that” becomes “if”.
- Use literal phrasing. Cut metaphor that adds no meaning.
- Name the mechanism or measurable result.
- Make specific claims.
- Replace “lands”, “carries”, “hits”, “rides along” with the actual step (returns, stores, calls).
- Pick one name for each thing. Do not cycle synonyms.
- Replace specialist terms only when familiar words preserve the meaning.
- Keep adjectives that specify an observable result. Cut adverbs or state the result.
- Prefer direct statements. “serves as” becomes “is”, “boasts” becomes “has”. Replace “Not just X, but Y” with the point itself.
- Replace spec-sheet phrasing such as “is configurable” with what you can configure and how.
- Avoid personified artifacts.
- Use “from X to Y” only for a meaningful range.

## Banned words

- Do not describe reader actions as easy, simple, or quick. Use a concrete description such as “one command”.
- Cut filler such as very, just, really, simply.
- Cut inflated vocabulary such as crucial, delve, enduring, enhance, garner, interplay, intricate, pivotal, testament, underscore, vibrant.
- Replace abstract metaphor nouns such as substrate, wedge, vector, locus, vantage, nexus, bedrock, modality, paradigm with the concrete thing or action.
- Keep literal technical meanings of primitive, harness, surface, scaffolding, ratchet. Replace figurative uses.
- Replace stock metaphors such as landscape, tapestry, north star, flywheel with the subject, goal, or process.
- Replace inflated descriptions. “gold-plating” becomes “more than the job needs”, “endgame” becomes “the last phase”.

## Concision

- Use ASD-STE100 Simplified Technical English for technical prose.
- Cut repetition and incidental detail that do not change understanding or action.
- Keep one idea per sentence.
- Cut filler phrases. “in order to” becomes “to”, “due to the fact that” becomes “because”. Delete “it is important to note that”.
- Replace excessive hedging such as “could potentially possibly” with “may”. Keep uncertainty when the evidence requires it.
- Keep articles and verbs.
- Cut generic conclusions. End with a specific fact, decision, or next step.
- Cut summary transitions such as “With this setup complete…” or “Now that we've explored…”. Start with the next point.
- Cut “additionally” when the next sentence already makes the connection clear.

## Claims and evidence

- Replace vague qualifiers such as significantly, many, often, typically, generally with a specific supported claim.
- Replace “near-zero”, “sub-second”, “most requests” with a cited figure. If no figure exists, narrow or remove the claim.
- Name the source behind “experts believe” or “industry reports suggest”. Cite it or cut it.
- Check phrases such as “highlighting…”, “ensuring…”, “reflecting…”, “showcasing…”, “fostering…” for unsupported implications. State the consequence and its evidence or delete the phrase.
- If a sentence could describe another project unchanged, name what distinguishes this one or cut it.
- Do not invent requirements, edge cases, implementation details, or plans.
- Keep the trigger, action, and consequence explicit. Do not reduce a conditional rule to an isolated fact.
- Preserve state boundaries. Distinguish current from cumulative values, temporary from permanent changes, and what resets from what persists.
- Resolve ambiguity only when the source makes the meaning evident. Do not guess.

## Headings and structure

- Match the requested format. Do not add headings, lists, summaries, or commentary to a plain-paragraph rewrite.
- Use sentence case for headings.
- Use descriptive headings such as “Caveats when self-hosting”, not “Caveats”.
- Open explanatory prose with a short summary. Start each major section with its main point.
- Define unfamiliar terms on first use. Spell out acronyms before you use them.
- Keep paragraphs to 2 to 4 sentences.
- Let each thought start naturally. Do not impose a recurring opener.
- Connect a paragraph's opening sentence to the preceding idea when it continues that idea.

## Lists

- Convert 3 or more list-shaped items in prose to a list.
- Use bullets for unordered items and numbers for sequential or ranked items.
- End prose that introduces a list with a colon.
- Use periods for complete sentences, not fragments.
- Avoid labels that repeat the description.
- For definitions use `- **Term**: description` with short labels.
- Do not turn every bullet into a heading.
- Use the number of items the subject requires. Do not force groups of three.

## Emphasis

- Use bold for user interface elements or critical facts, not for tone.
- Do not bold every proper noun or acronym.
- Use inline code for paths, extensions, identifiers, and snippets such as /api, .tsx, body, query.
- Remove decorative emojis from headings and bullets.

## Punctuation and typography

- Do not use em dashes or en dashes as punctuation. Split the sentence or use a comma.
- Prefer periods or commas over mid-sentence colons or semicolons. Reserve colons for lists or examples.
- Use curly quotes in prose and straight quotes in code and literal syntax.
- Use the ellipsis character, not three dots.
- Use “and” in prose. Reserve & for compact labels.
- Use non-breaking spaces between values and units.

## Data sizes and units

- Separate values from units, as in 64 KB, 5 KB, 200 ms, 30 s.
- Preserve unit case (KB for kilobytes, ms for milliseconds).
- Keep units consistent. Preserve exact syntax in code or quoted output.

## Source formatting

- Keep each paragraph on one source line and let the editor wrap.
- Use one blank line before headings and around code blocks.
- Do not add extra blank lines between list items.
- Do not use horizontal rules between sections.
- Name the destination in link text. Do not use bare URLs or “here”/“link” as anchor text.

## Review output format

- For reviews without a requested format, group findings by file and use `file:line - issue`.
- Give a suggested fix for each finding.
- Report each distinct issue once.
- Skip explanations unless the fix is non-obvious.
- If there are no issues, return “Pass”.
- For rewrites, return only the rewritten text unless an explanation was asked for. Do not append rationale, progress summaries, or plans.
- Preserve every requirement.
- Keep concrete names, examples, measurements, constraints, and terminology from the source.
- Keep required work distinct from optional suggestions. Do not turn a suggestion into a commitment.
- Keep named methods when replacing them would weaken a requirement.
- Leave passages designated as verbatim unchanged.
- Never remove, merge, or rename distinct requirements to meet a word target.

## Scope and carve-outs

- (a) These rules apply to mas prose and agent envelopes.
- (b) The shared-rules contract block in `~/.config/opencode/skills/mas/references/shared-rules.md` is byte-enforced and is EXEMPT from restyling, so its existing punctuation stands.
- (c) Code, paths, identifiers, and quoted output keep straight quotes and exact syntax.

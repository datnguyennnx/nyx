# Information-Theoretic Validation for Skills

A skill is an information channel. You (the expert) encode domain expertise into SKILL.md. The AI agent decodes it during execution. The channel has constraints: finite context window, competing signals from other skills and conversation, and decoding errors from ambiguity.

Optimize the skill for information transmission, not readability.

## The Three Signal Types

Every sentence in a skill must carry one of three signal types:

| Signal type | What it communicates | Example |
|---|---|---|
| Imperative | What to DO | "Run `tsc --noEmit` before presenting results" |
| Diagnostic | What goes WRONG | "If you estimate complexity instead of running the script, you will miss file overlap" |
| Verification | How to CHECK | "Confirm every coupling pair has non-empty evidence[]" |

A sentence that carries none of these three signals is **noise**. Delete it.

## Signal-to-Noise Ratio (SNR)

Count the sentences in each section. Classify each as signal (imperative/diagnostic/verification) or noise. Target: **SNR > 3:1** — at least 3 signal sentences for every noise sentence.

### Common noise sources

| Noise source | Example | Fix |
|---|---|---|
| Background context | "This skill is for writing skills" | Delete — the frontmatter already says this |
| Transitional phrases | "Now that we've covered X, let's move to Y" | Delete — sections are independent |
| Generic warnings | "Be careful when doing this" | Replace with a specific trap |
| Technology introductions | "This framework was built in 2022" | Delete — agent already knows or doesn't need it |
| Process explanations | "The reason we do this is because management decided..." | Delete — agent needs the rule, not the corporate history |

## Compression Test

Can you delete 20% of the words from each section without losing meaning? If yes, the section is not compressed enough.

### Compression methods (ranked by effectiveness)

| Method | What it does | Example |
|---|---|---|
| Replace prose with tables | Higher information density per token | Instead of 3 sentences describing 3 tools, use a 3-row table |
| Replace paragraphs with lists | Lists are parsed faster | Instead of "First do X, then Y, then Z", use a numbered list |
| Replace descriptions with code blocks | Exact commands remove ambiguity | Instead of "run the type checker", write `tsc --noEmit` |
| Remove hedge words | "Simply", "just", "basically", "essentially" — always deletable | Delete every instance |
| Merge adjacent sections | If two sections are always read together, combine them | "Prerequisites" + "Setup" = "Required First Pass" |

## Prior Knowledge Filter

Would the agent already know this from its training data? If yes, delete it. The skill should only transmit information that is NOT in the agent's prior distribution.

| Agent already knows | Skill must teach |
|---|---|
| What `tsc --noEmit` does | That the GATE is binary — never averaged with soft signals |
| What a merge conflict is | That parallel implementers on the same worktree cause them |
| What an HTTP API is | That this specific API returns `201` on create |
| That compilation errors are bad | That a single `any` type in an exported interface propagates silently |

The hardest thing to cut is context you worked hard to learn personally. But if the agent already has it in training data, your effort is redundant — cut it.

## Error-Correction Coverage

Every imperative instruction needs a corresponding diagnostic trap. This is error-correcting coding: the trap is the parity bit that lets the agent detect when it's about to violate the instruction.

### Three types of error correction

| Type | How it works | Example |
|---|---|---|
| Parity trap | For each imperative, provide a trap with the wrong intuition | Instruction: "Run the script." Trap: "You think you can estimate it." |
| Repetition coding | Same concept in multiple forms | Core rule in concept section + trap + checklist |
| Cross-validation | Different sections confirm the same constraint | Rationalization table + trap + good/bad example all reinforce the same rule |

Check: For every critical imperative in the skill, is there at least one trap? If not, add one.

## Channel Capacity Check

The skill must fit within the agent's context window AND leave room for the actual task.

| Skill size | Verdict |
|---|---|
| < 2 KB | Likely too shallow — missing traps |
| 2-8 KB | Good range for narrow skills |
| 8-15 KB | Good range for complex skills |
| > 15 KB | Risking context overflow — split into reference files |

If the skill exceeds channel capacity, offload reference data to separate files and keep only essential instruction + traps in SKILL.md.

## Information-Theoretic Concepts

### Entropy of section titles

A section title should have high Shannon entropy — high information content relative to its length. Low-entropy titles ("Overview", "Introduction") carry little information and fail to guide the agent's attention.

Rule: If the agent can guess the section's content from the title alone, the title is too generic.

### Mutual Information

Mutual information I(S; A) measures how much the skill reduces uncertainty about the agent's output. A sentence with high mutual information makes the agent's behavior more predictable.

Highest mutual information per token:
1. Exact commands — `tsc --noEmit` (very high MI)
2. Named traps — "You will think 'I'll estimate'" (high MI)
3. Binary checklist items — "Confirm tsc exited 0" (high MI)
4. Prose explanations — "The GATE is binary because..." (medium MI)
5. Background context — "This tool was built in..." (low or zero MI)

Rule: Allocate token budget proportional to mutual information.

### Rate-Distortion

Rate R = token budget. Distortion D = incorrect agent behavior. Minimize D given R.

Optimal allocation:
1. Spend tokens on highest-MI content first (commands, traps)
2. Add supporting content only after high-MI content is covered
3. Add reference data only if token budget remains
4. Cut anything below the rate-distortion threshold

## Skill Audit Checklist

Run these audits before submitting any skill:

1. **Entropy audit**: Read each section title. If the agent can guess the content without reading it, replace it.
2. **SNR audit**: Count signal vs noise sentences per section. If any section has SNR < 3:1, restructure.
3. **Prior audit**: For each paragraph, ask "would the agent already know this?" If yes, delete.
4. **MI audit**: Sort content by mutual information. Cut from the bottom until skill fits token budget.
5. **Error-correction audit**: For each imperative, find the corresponding trap. If any lacks one, add it.
6. **Channel capacity audit**: Measure file size. If > 15 KB, offload reference data to separate files.

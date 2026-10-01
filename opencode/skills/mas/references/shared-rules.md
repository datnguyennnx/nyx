Status set: PASS | FAIL | PARTIAL | NO_VERIFICATION | NO_RESULTS.
Handoff fields: CONTEXT, TASK, TARGET_FILES, REQUIREMENTS, ACCEPTANCE, OUTPUT_CONTRACT, EFFORT, SKILLS, TOKEN_CAP, KAHN_LEVEL/EDGE_ID, EVIDENCE_ATTACHMENT.
Dispatch: PASS advances a level; FAIL spawns the diagnostician then a clean-context re-spawn; PARTIAL re-pulls only the declared remainder; NO_VERIFICATION counts as FAIL; NO_RESULTS re-runs once then escalates.
Retry: at most 3 attempts per task; each re-spawn is clean-context, seeded only by the diagnostician's reflection.
Routes: QUESTION | DOCS | TRIVIAL | CODE | unknown.
HITL: HITL-1 scope+route; HITL-2 plan+acceptance; HITL-3 first write; HITL-4 first gate failure; HITL-5 accept before ship; HITL-6 destructive operations.
Gate: the tester runs the deliverable validators and blocks on them. A missing result yields NO_VERIFICATION. The config validator runs only when the task edits mas config: the skill, the agents, or the scripts. See ~/.config/opencode/skills/mas/references/verification.md.
Shell: every shell command is approved by the operator; nothing is pre-approved. Destructive and egress commands are refused without a prompt.
Explore: do not use shell to read the tree. Use glob, read and grep, which carry the secret-path denies and need no approval. Surfaces that delegate reading apply this rule to their readers.
Repos: git -C is not allowlisted. To work in another repo, run cd <repo> && <command> in ONE shell call, because compound parts are checked separately.
Changed set: the tester obtains it with git. Any changed file not declared in a lane's TARGET_FILES is a FAIL.

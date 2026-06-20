---
name: mas-complexity-scoring
description: Information-theoretic complexity scoring model using Shannon entropy and KL divergence.
Deterministic Fast Lane vs full DAG routing. Loaded by classifier.
---

## 1. Entropy of File-Change Distribution H(T)

For task set T with n distinct files (union of `output_files`):

### Δ_i estimation

| Condition | Δ_i |
|---|---|
| `mutation` creating new file, scope > 50 words | 3.0 |
| `mutation` creating new file, scope ≤ 50 words | 2.0 |
| `mutation` editing file, scope > 50 words | 2.0 |
| `mutation` editing file, scope ≤ 50 words | 1.0 |
| `mutation` contains "rename", "fix typo", "tweak" | 0.5 |

### Distribution

```
P = { p_i }   p_i = Δ_i / ΣΔ_j
```

### Entropy

```
H(T) = -Σ_{i=1}^{n} p_i · log₂(p_i)    [bits]
0 ≤ H(T) ≤ log₂(n)
```

## 2. Normalized Entropy

```
H_norm = H(T) / log₂(n)    n > 1
H_norm = 0                 n = 1
```

Range: [0, 1]

## 3. Cross-Domain Jensen-Shannon Divergence

For multi-domain tasks (effect-ts + react-vite):

```
D_JS = ½·D_KL(P_A || M) + ½·D_KL(P_B || M)
M = ½(P_A + P_B)

D_KL(P || Q) = Σ P(i)·log₂(P(i)/Q(i))   where P(i)>0, Q(i)>0
```

Single-domain: D_JS = 0.  Range: [0, 1]

## 4. Mutual Information (Dependency)

For subtask pair (U_j, U_k):

```
I(U_j; U_k) = H(U_j) + H(U_k) - H(U_j, U_k)
I_max = max_{j≠k} I(U_j; U_k)
I_norm = I_max / H(T)    capped at 1.0
```

I = 0 → independent (parallel safe). I > 0 → shared deps (sequential required).

## 5. Composite Complexity Score

```
C(T) = α·H_norm + β·D_JS + γ·I_norm
α = β = γ = 1/3
```

Range: [0, 1]. Omitted components = 0 when precondition unmet.

## 6. Fast Lane Threshold

```
τ = 0.25
```

Fast Lane: `C(T) < τ AND |task_set| = 1 AND |output_files| ≤ 2`

Otherwise: full DAG.

## 7. User Override

`user_message` starts with `!quick` → C(T) = 0, `user_intent_override = true`.

## 8. Escalation

Lite Verifier BLOCKING → escalate to full DAG. Record: `{"escalated_from_fast_lane": true}`.

---
name: mas-complexity-scoring
description: Information-theoretic complexity scoring model using Shannon entropy and KL divergence. Deterministic Fast Lane vs full DAG routing. Loaded by classifier.
---

## 1. File-Change Entropy H(T)

Δ_i estimation: new file scope>50 words=3.0, new file scope≤50=2.0, edit scope>50=2.0, edit scope≤50=1.0, rename/typo/tweak=0.5.

Distribution: `P = { p_i }`, `p_i = Δ_i / ΣΔ_j`. Entropy: `H(T) = -Σ p_i · log₂(p_i)`.

## 2. Normalized Entropy

`H_norm = H(T) / log₂(n)` for n>1 files. `H_norm = 0` for n=1. Range [0,1].

## 3. Cross-Domain Jensen-Shannon Divergence

`D_JS = ½·D_KL(P_A || M) + ½·D_KL(P_B || M)`, `M = ½(P_A + P_B)`. Single-domain: D_JS = 0. Range [0,1].

## 4. Mutual Information (Dependency)

`I(U_j; U_k) = H(U_j) + H(U_k) - H(U_j, U_k)`. `I_norm = max I / H(T)`, capped at 1.0. I=0 → parallel-safe. I>0 → sequential required.

## 5. Composite Score

`C(T) = (H_norm + D_JS + I_norm) / k`, k = count of active components (1-3). Omitted components = 0. Range [0,1].

## 6. Fast Lane Threshold

τ = 0.25. Fast Lane: `C(T) < τ AND |task_set| = 1 AND |output_files| ≤ 2`. Otherwise: full DAG.

## 7. User Override

`!quick` prefix → C(T) = 0, `user_intent_signal = true`.

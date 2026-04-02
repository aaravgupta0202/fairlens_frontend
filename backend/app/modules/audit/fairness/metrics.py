"""
fairness/metrics.py
-------------------
Mathematically correct fairness metric implementations.
Research basis: Barocas, Hardt & Narayanan "Fairness and Machine Learning" (2023),
                Verma & Rubin "Fairness definitions explained" (2018),
                EEOC 4/5ths (80%) rule, EU AI Act Art. 10.

All functions:
  - Return structured dicts (never single scalars)
  - Identify the disadvantaged group
  - Handle all edge cases (empty groups, zero-division, single class)
  - Accept raw arrays — no Pandas coupling in the math layer
"""

from __future__ import annotations
import math
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


# ─── helpers ─────────────────────────────────────────────────────────────────

def _safe_div(num: float, denom: float, fallback: Optional[float] = None) -> Optional[float]:
    """Division with explicit zero-denominator handling."""
    if denom == 0.0:
        return fallback
    return num / denom


def _round4(v: Optional[float]) -> Optional[float]:
    return round(float(v), 4) if v is not None else None


# ─── 1. Demographic Parity ───────────────────────────────────────────────────

def demographic_parity(
    groups: List[str],
    selection_rates: Dict[str, float],
    reference_group: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Demographic Parity (Statistical Parity).

    For each group g:
        DP_diff(g) = P(Ŷ=1 | A=g) - P(Ŷ=1 | A=ref)

    Returns:
        per_group      : {group → selection_rate}
        differences    : {group → diff_from_reference}  (relative to reference)
        dpd            : max(rate) - min(rate)  [unsigned, scalar summary]
        disadvantaged  : group with lowest selection rate
        reference_group: which group used as reference
        flagged        : bool  (dpd > 0.10)
        explanation    : human-readable string
    """
    if len(groups) < 2 or not selection_rates:
        return {
            "per_group": {}, "differences": {}, "dpd": 0.0,
            "disadvantaged": None, "reference_group": None,
            "flagged": False,
            "explanation": "Insufficient groups for Demographic Parity analysis.",
        }

    rates = {g: float(selection_rates.get(g, 0.0)) for g in groups}
    ref   = reference_group or max(rates, key=rates.get)   # default ref = highest-rate group
    ref_rate = rates[ref]

    differences = {g: _round4(rates[g] - ref_rate) for g in groups}
    dpd = round(max(rates.values()) - min(rates.values()), 4)

    disadvantaged = min(rates, key=rates.get)
    lo_rate = rates[disadvantaged]
    hi_rate = rates[ref]

    flagged = dpd > 0.10

    explanation = (
        f"'{disadvantaged}' has a selection rate of {lo_rate:.1%}, "
        f"compared to {hi_rate:.1%} for '{ref}' "
        f"(difference = {dpd:.1%}). "
        + ("This exceeds the 10% threshold — bias detected." if flagged
           else "This is within the 10% acceptable range.")
    )

    return {
        "per_group":       {g: _round4(r) for g, r in rates.items()},
        "differences":     differences,
        "dpd":             dpd,
        "disadvantaged":   disadvantaged,
        "reference_group": ref,
        "flagged":         flagged,
        "explanation":     explanation,
    }


# ─── 2. Disparate Impact ─────────────────────────────────────────────────────

def disparate_impact(
    groups: List[str],
    selection_rates: Dict[str, float],
) -> Dict[str, Any]:
    """
    Disparate Impact Ratio (80% / 4-fifths rule).

        DIR = P(Ŷ=1 | A=unprivileged) / P(Ŷ=1 | A=privileged)

    Directionality preserved:
      - DIR < 1 → disadvantaged group selected less often
      - DIR = 1 → perfect parity
      - DIR > 1 → disadvantaged group selected MORE often (reverse bias)

    Handles divide-by-zero:
      - If privileged rate = 0: DIR = None (undefined)
      - If unprivileged rate = 0 and privileged > 0: DIR = 0.0
    """
    if len(groups) < 2 or not selection_rates:
        return {
            "ratio": None, "privileged_group": None, "unprivileged_group": None,
            "privileged_rate": None, "unprivileged_rate": None,
            "flagged": False, "undefined": True,
            "explanation": "Insufficient groups for Disparate Impact analysis.",
        }

    rates = {g: float(selection_rates.get(g, 0.0)) for g in groups}
    privileged   = max(rates, key=rates.get)
    unprivileged = min(rates, key=rates.get)
    p_rate = rates[privileged]
    u_rate = rates[unprivileged]

    if p_rate == 0.0:
        ratio     = None
        undefined = True
        flagged   = True   # all-zero outcomes is a critical fairness failure
    else:
        ratio     = _round4(u_rate / p_rate)
        undefined = False
        flagged   = ratio < 0.80

    explanation: str
    if undefined:
        explanation = (
            f"DIR is undefined: '{privileged}' has a 0% selection rate. "
            "All outcomes are negative — critical fairness failure."
        )
    elif ratio is not None:
        explanation = (
            f"'{unprivileged}' is selected at {u_rate:.1%}, which is "
            f"{ratio:.1%} of '{privileged}' ({p_rate:.1%}). "
            + ("This is below the 80% legal threshold — disparate impact detected." if flagged
               else "This meets the 80% legal threshold.")
        )
    else:
        explanation = "DIR could not be computed."

    return {
        "ratio":              ratio,
        "privileged_group":   privileged,
        "unprivileged_group": unprivileged,
        "privileged_rate":    _round4(p_rate),
        "unprivileged_rate":  _round4(u_rate),
        "flagged":            flagged,
        "undefined":          undefined,
        "explanation":        explanation,
    }


# ─── 3. Equal Opportunity (TPR gap) ──────────────────────────────────────────

def equal_opportunity(
    groups: List[str],
    tpr_by_group: Dict[str, Optional[float]],
) -> Dict[str, Any]:
    """
    Equal Opportunity (Hardt et al. 2016).

        EO_gap = max(TPR_g) - min(TPR_g)

    TPR_g = TP_g / (TP_g + FN_g)  — requires prediction column.

    Returns None values when predictions are unavailable (label-only mode).
    """
    valid = {g: v for g, v in tpr_by_group.items() if v is not None}
    if len(valid) < 2:
        return {
            "per_group": tpr_by_group, "gap": None,
            "disadvantaged": None, "advantaged": None,
            "flagged": False, "available": False,
            "explanation": "Equal Opportunity requires a prediction column (TPR not available).",
        }

    gap = _round4(max(valid.values()) - min(valid.values()))
    disadvantaged = min(valid, key=valid.get)
    advantaged    = max(valid, key=valid.get)
    flagged       = gap is not None and gap > 0.10

    explanation = (
        f"'{disadvantaged}' has TPR={valid[disadvantaged]:.3f} vs "
        f"'{advantaged}' TPR={valid[advantaged]:.3f} (gap={gap:.3f}). "
        + ("This exceeds the 10% threshold." if flagged else "Within acceptable threshold.")
    )

    return {
        "per_group":    {g: _round4(v) for g, v in tpr_by_group.items()},
        "gap":          gap,
        "disadvantaged": disadvantaged,
        "advantaged":   advantaged,
        "flagged":      flagged,
        "available":    True,
        "explanation":  explanation,
    }


# ─── 4. Equalized Odds (TPR + FPR) ───────────────────────────────────────────

def equalized_odds(
    groups: List[str],
    tpr_by_group: Dict[str, Optional[float]],
    fpr_by_group: Dict[str, Optional[float]],
) -> Dict[str, Any]:
    """
    Equalized Odds (Hardt et al. 2016).

    Both TPR gap AND FPR gap must be ≤ 0.10 to pass.
    The more severe gap drives the flag.
    """
    eo_tpr = equal_opportunity(groups, tpr_by_group)

    valid_fpr = {g: v for g, v in fpr_by_group.items() if v is not None}
    if len(valid_fpr) < 2:
        fpr_gap        = None
        fpr_flagged    = False
        fpr_explanation = "FPR not available (label-only mode)."
        fpr_disadvantaged = None
    else:
        fpr_gap           = _round4(max(valid_fpr.values()) - min(valid_fpr.values()))
        fpr_flagged       = fpr_gap is not None and fpr_gap > 0.10
        fpr_disadvantaged = max(valid_fpr, key=valid_fpr.get)   # higher FPR = worse
        lo_fpr_g          = min(valid_fpr, key=valid_fpr.get)
        fpr_explanation   = (
            f"'{fpr_disadvantaged}' FPR={valid_fpr[fpr_disadvantaged]:.3f} vs "
            f"'{lo_fpr_g}' FPR={valid_fpr[lo_fpr_g]:.3f} (gap={fpr_gap:.3f}). "
            + ("Exceeds 10% threshold." if fpr_flagged else "Within threshold.")
        )

    overall_flagged = eo_tpr["flagged"] or fpr_flagged
    return {
        "tpr": {
            "per_group": eo_tpr["per_group"],
            "gap": eo_tpr["gap"],
            "disadvantaged": eo_tpr["disadvantaged"],
            "flagged": eo_tpr["flagged"],
            "explanation": eo_tpr["explanation"],
        },
        "fpr": {
            "per_group": {g: _round4(v) for g, v in fpr_by_group.items()},
            "gap": fpr_gap,
            "disadvantaged": fpr_disadvantaged,
            "flagged": fpr_flagged,
            "explanation": fpr_explanation,
        },
        "flagged":     overall_flagged,
        "available":   eo_tpr["available"],
        "explanation": (
            f"TPR gap={eo_tpr['gap']}, FPR gap={fpr_gap}. "
            + ("Equalized Odds violated." if overall_flagged else "Equalized Odds satisfied.")
        ),
    }


# ─── 5. Statistical Parity Difference ────────────────────────────────────────

def statistical_parity_difference(
    groups: List[str],
    selection_rates: Dict[str, float],
) -> Dict[str, Any]:
    """
    Statistical Parity Difference (signed).

        SPD = P(Ŷ=1 | A=unprivileged) - P(Ŷ=1 | A=privileged)

    SPD ∈ [-1, 1].
      SPD = 0  → perfect parity
      SPD < 0  → unprivileged group disadvantaged
      SPD > 0  → unprivileged group over-selected (reverse bias)
    """
    if len(groups) < 2 or not selection_rates:
        return {
            "spd": None, "privileged_group": None, "unprivileged_group": None,
            "flagged": False,
            "explanation": "Insufficient groups for SPD analysis.",
        }

    rates        = {g: float(selection_rates.get(g, 0.0)) for g in groups}
    privileged   = max(rates, key=rates.get)
    unprivileged = min(rates, key=rates.get)
    spd          = _round4(rates[unprivileged] - rates[privileged])
    flagged      = abs(spd) > 0.10 if spd is not None else False

    return {
        "spd":              spd,
        "privileged_group": privileged,
        "unprivileged_group": unprivileged,
        "privileged_rate":  _round4(rates[privileged]),
        "unprivileged_rate": _round4(rates[unprivileged]),
        "flagged":          flagged,
        "explanation": (
            f"SPD = {spd:.4f} ({'negative — unprivileged group disadvantaged' if spd and spd < 0 else 'near-zero parity' if spd and abs(spd) < 0.01 else 'positive — reverse selection bias'}). "
            + ("Exceeds |0.10| threshold." if flagged else "Within threshold.")
        ),
    }


# ─── 6. Theil Index (individual-level inequality) ────────────────────────────

def theil_index(rates: List[float]) -> Dict[str, Any]:
    """
    Theil T index — group-level outcome inequality.

        T = (1/n) * Σ (r_g / μ) * ln(r_g / μ)

    where μ = mean(r_g) and sum is over groups with r_g > 0.

    T = 0 → perfect equality.
    T > 0 → inequality (higher = more unequal).

    NOTE: Theil is a group-level summary; it does NOT use individual predictions.
    Used here as a supplementary inequality measure, not as a standalone fairness metric.
    """
    valid = [float(r) for r in rates if r is not None and r > 0]
    if len(valid) < 2:
        return {
            "value": 0.0, "flagged": False,
            "explanation": "Theil index requires at least 2 groups with positive selection rates.",
        }

    mu    = float(np.mean(valid))
    if mu <= 0.0:
        return {"value": 0.0, "flagged": False, "explanation": "Mean selection rate is zero."}

    value = float(np.mean([(r / mu) * math.log(r / mu) for r in valid]))
    value = round(max(0.0, value), 4)
    flagged = value > 0.05

    return {
        "value":   value,
        "flagged": flagged,
        "explanation": (
            f"Theil index = {value:.4f}. "
            + ("Significant outcome inequality across groups." if flagged
               else "Outcome distribution is relatively equal across groups.")
        ),
    }


# ─── 7. Bias Score ───────────────────────────────────────────────────────────

def compute_bias_score(
    dpd: float,
    dir_ratio: Optional[float],
    tpr_gap: Optional[float],
    fpr_gap: Optional[float],
    has_predictions: bool,
) -> Dict[str, Any]:
    """
    Composite bias score [0–100].

    Formula: mean of normalized violation components.
    Components always included: DPD_v, DIR_v
    Components included only with predictions: TPR_v, FPR_v

      DPD_v = min(dpd / 0.10, 1.0)
      DIR_v = 0 if dir ≥ 0.80 else min((0.80 - dir) / 0.80, 1.0)
      TPR_v = min(tpr_gap / 0.10, 1.0)
      FPR_v = min(fpr_gap / 0.10, 1.0)

    Returns score + full breakdown for auditability.
    """
    dpd_v = min(float(dpd) / 0.10, 1.0)

    if dir_ratio is None:
        dir_v = 1.0                              # undefined DIR = maximum violation
    elif dir_ratio >= 0.80:
        dir_v = 0.0
    else:
        dir_v = min((0.80 - dir_ratio) / 0.80, 1.0)

    violations = [("dpd", dpd_v), ("dir", dir_v)]

    tpr_v = fpr_v = None
    if has_predictions and tpr_gap is not None and fpr_gap is not None:
        tpr_v = min(float(tpr_gap) / 0.10, 1.0)
        fpr_v = min(float(fpr_gap) / 0.10, 1.0)
        violations += [("tpr", tpr_v), ("fpr", fpr_v)]

    score = round(float(np.mean([v for _, v in violations])) * 100.0, 1)
    score = max(0.0, min(100.0, score))

    if   score < 20: level, risk = "Low",      "Low Risk"
    elif score < 45: level, risk = "Moderate", "Moderate Risk"
    elif score < 70: level, risk = "High",     "High Risk"
    else:            level, risk = "Critical", "Critical Risk"

    return {
        "score":      score,
        "level":      level,
        "risk_label": risk,
        "breakdown": {
            "dpd_violation":  round(dpd_v * 100, 1),
            "dir_violation":  round(dir_v * 100, 1),
            "tpr_violation":  round(tpr_v * 100, 1) if tpr_v is not None else None,
            "fpr_violation":  round(fpr_v * 100, 1) if fpr_v is not None else None,
            "violations_counted": len(violations),
            "label_only_mode": not has_predictions,
        },
    }

"""
fairness/bias_layers.py
-----------------------
Separates bias into three distinct analytical layers:

  Layer 1 — Dataset Bias
    Structural imbalance in LABELS (y_true) across groups.
    Test: chi-square on (sensitive × label) contingency table.
    → Measures whether the data itself encodes historical discrimination.

  Layer 2 — Model Bias
    Disparity in PREDICTIONS (ŷ) across groups.
    Metrics: DP gap, TPR gap, FPR gap.
    → Measures whether the model learned to discriminate.

  Layer 3 — Outcome Bias
    Combined effect at the decision boundary.
    → Measures what actually happens to people.

Each layer has its own functions and outputs.
No cross-layer contamination.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
from scipy import stats as scipy_stats


# ─── Layer 1: Dataset Bias ───────────────────────────────────────────────────

def dataset_bias(
    df: pd.DataFrame,
    sensitive_col: str,
    label_col: str,
) -> Dict[str, Any]:
    """
    Test whether protected attribute and TRUE LABELS are statistically independent.

    Uses chi-square test on contingency table: (sensitive × label).
    This tests dataset bias — NOT model bias.

    Returns:
        chi2, p_value, cramers_v, is_significant
        per_group_prevalence: {group → P(Y=1 | A=group)}
        imbalance_ratio: max_prevalence / min_prevalence
        disadvantaged_group: group with lowest positive label prevalence
    """
    if sensitive_col not in df.columns or label_col not in df.columns:
        return _empty_layer1()

    work = df[[sensitive_col, label_col]].dropna()
    if len(work) < 10:
        return _empty_layer1("Insufficient data for dataset bias test.")

    # Chi-square on (protected × label) — tests label distribution
    try:
        contingency = pd.crosstab(work[sensitive_col], work[label_col])
        if contingency.shape[0] < 2 or contingency.shape[1] < 2:
            return _empty_layer1("Need ≥2 groups and ≥2 label classes.")

        chi2, p, dof, _ = scipy_stats.chi2_contingency(contingency, correction=False)
        n = int(contingency.values.sum())
        r, k = contingency.shape

        # Bias-corrected Cramér's V (Bergsma 2013)
        cramers_v: Optional[float]
        if n > 1:
            phi2      = float(chi2) / float(n)
            phi2_corr = max(0.0, phi2 - ((k - 1) * (r - 1)) / float(n - 1))
            r_corr    = r - ((r - 1) ** 2) / float(n - 1)
            k_corr    = k - ((k - 1) ** 2) / float(n - 1)
            denom     = min(k_corr - 1, r_corr - 1)
            cramers_v = round(float(np.sqrt(phi2_corr / denom)), 4) if denom > 0 else 0.0
        else:
            cramers_v = None

        effect_size = _cramers_label(cramers_v)

    except Exception as e:
        return _empty_layer1(f"Chi-square failed: {e}")

    # Per-group label prevalence
    pos_label = work[label_col].value_counts().idxmax()
    per_group: Dict[str, float] = {}
    for g in sorted(work[sensitive_col].unique(), key=str):
        gdf = work[work[sensitive_col] == g]
        rate = float((gdf[label_col] == pos_label).mean()) if len(gdf) > 0 else 0.0
        per_group[str(g)] = round(rate, 4)

    prev_vals    = list(per_group.values())
    min_prev     = min(prev_vals) if prev_vals else 0.0
    max_prev     = max(prev_vals) if prev_vals else 0.0
    imbalance    = round(max_prev / min_prev, 4) if min_prev > 0 else None
    disadvantaged = min(per_group, key=per_group.get) if per_group else None

    is_significant = bool(p < 0.05)
    return {
        "layer":                "dataset_bias",
        "test":                 "chi_square_labels",
        "chi2":                 round(float(chi2), 4),
        "p_value":              round(float(p), 6),
        "dof":                  int(dof),
        "cramers_v":            cramers_v,
        "effect_size":          effect_size,
        "is_significant":       is_significant,
        "per_group_prevalence": per_group,
        "imbalance_ratio":      imbalance,
        "disadvantaged_group":  disadvantaged,
        "positive_label":       str(pos_label),
        "explanation": (
            f"Dataset bias test (labels × group): χ²={chi2:.3f}, p={p:.4f}, "
            f"Cramér's V={cramers_v} ({effect_size} effect). "
            + (f"'{disadvantaged}' has the lowest positive label prevalence ({min_prev:.1%})."
               if disadvantaged else "")
            + (" The labels themselves show statistically significant group disparities."
               if is_significant else " No statistically significant label disparity detected.")
        ),
    }


def _empty_layer1(msg: str = "Dataset bias test not available.") -> Dict[str, Any]:
    return {
        "layer": "dataset_bias", "test": "chi_square_labels",
        "chi2": None, "p_value": None, "dof": None,
        "cramers_v": None, "effect_size": None, "is_significant": False,
        "per_group_prevalence": {}, "imbalance_ratio": None,
        "disadvantaged_group": None, "positive_label": None,
        "explanation": msg,
    }


# ─── Layer 2: Model Bias ─────────────────────────────────────────────────────

def model_bias(
    df: pd.DataFrame,
    sensitive_col: str,
    label_col: str,
    prediction_col: str,
    positive_class,
) -> Dict[str, Any]:
    """
    Measure disparity in PREDICTIONS across groups.

    Chi-square here uses (sensitive × predicted_outcome) — NOT labels.
    This tests model bias — distinct from dataset bias.

    Metrics:
      - DP gap on predictions
      - TPR gap (Equal Opportunity)
      - FPR gap (Equalized Odds component)
    """
    if not all(c in df.columns for c in [sensitive_col, label_col, prediction_col]):
        return _empty_layer2("Model bias analysis requires prediction column.")

    work = df[[sensitive_col, label_col, prediction_col]].dropna()
    if len(work) < 10:
        return _empty_layer2("Insufficient data for model bias test.")

    # Chi-square on (protected × PREDICTION) — this is model bias
    try:
        contingency = pd.crosstab(work[sensitive_col], work[prediction_col])
        if contingency.shape[0] < 2 or contingency.shape[1] < 2:
            return _empty_layer2("Need ≥2 groups and ≥2 prediction classes.")
        chi2, p, dof, _ = scipy_stats.chi2_contingency(contingency, correction=False)
        n = int(contingency.values.sum())
        r, k = contingency.shape
        cramers_v: Optional[float]
        if n > 1:
            phi2      = float(chi2) / float(n)
            phi2_corr = max(0.0, phi2 - ((k - 1) * (r - 1)) / float(n - 1))
            r_corr    = r - ((r - 1) ** 2) / float(n - 1)
            k_corr    = k - ((k - 1) ** 2) / float(n - 1)
            denom     = min(k_corr - 1, r_corr - 1)
            cramers_v = round(float(np.sqrt(phi2_corr / denom)), 4) if denom > 0 else 0.0
        else:
            cramers_v = None
        is_model_biased = bool(p < 0.05)
    except Exception as e:
        return _empty_layer2(f"Model chi-square failed: {e}")

    # Per-group prediction rates, TPR, FPR
    per_group_pred_rate: Dict[str, float] = {}
    per_group_tpr:       Dict[str, Optional[float]] = {}
    per_group_fpr:       Dict[str, Optional[float]] = {}

    for g in sorted(work[sensitive_col].unique(), key=str):
        gdf    = work[work[sensitive_col] == g]
        y_true = (gdf[label_col] == positive_class).astype(int).values
        y_pred = (gdf[prediction_col] == positive_class).astype(int).values
        n_g    = len(y_true)
        if n_g == 0:
            continue
        pred_rate = float(np.mean(y_pred == 1))
        tp = int(np.sum((y_true == 1) & (y_pred == 1)))
        fp = int(np.sum((y_true == 0) & (y_pred == 1)))
        tn = int(np.sum((y_true == 0) & (y_pred == 0)))
        fn = int(np.sum((y_true == 1) & (y_pred == 0)))
        tpr = round(tp / (tp + fn), 4) if (tp + fn) > 0 else None
        fpr = round(fp / (fp + tn), 4) if (fp + tn) > 0 else None
        per_group_pred_rate[str(g)] = round(pred_rate, 4)
        per_group_tpr[str(g)]       = tpr
        per_group_fpr[str(g)]       = fpr

    # Gaps
    pred_vals = list(per_group_pred_rate.values())
    dp_gap    = round(max(pred_vals) - min(pred_vals), 4) if len(pred_vals) >= 2 else None

    tpr_vals  = [v for v in per_group_tpr.values() if v is not None]
    tpr_gap   = round(max(tpr_vals) - min(tpr_vals), 4) if len(tpr_vals) >= 2 else None

    fpr_vals  = [v for v in per_group_fpr.values() if v is not None]
    fpr_gap   = round(max(fpr_vals) - min(fpr_vals), 4) if len(fpr_vals) >= 2 else None

    disadvantaged_pred = min(per_group_pred_rate, key=per_group_pred_rate.get) if per_group_pred_rate else None

    return {
        "layer":                    "model_bias",
        "test":                     "chi_square_predictions",
        "chi2":                     round(float(chi2), 4),
        "p_value":                  round(float(p), 6),
        "cramers_v":                cramers_v,
        "effect_size":              _cramers_label(cramers_v),
        "is_model_biased":          is_model_biased,
        "dp_gap_on_predictions":    dp_gap,
        "tpr_gap":                  tpr_gap,
        "fpr_gap":                  fpr_gap,
        "per_group_prediction_rate": per_group_pred_rate,
        "per_group_tpr":            per_group_tpr,
        "per_group_fpr":            per_group_fpr,
        "disadvantaged_group":      disadvantaged_pred,
        "explanation": (
            f"Model bias test (predictions × group): χ²={chi2:.3f}, p={p:.4f}. "
            f"DP gap on predictions={dp_gap}, TPR gap={tpr_gap}, FPR gap={fpr_gap}. "
            + ("Model predictions show statistically significant group disparity."
               if is_model_biased else "Model predictions do not show significant group disparity.")
        ),
    }


def _empty_layer2(msg: str = "Model bias analysis not available.") -> Dict[str, Any]:
    return {
        "layer": "model_bias", "test": "chi_square_predictions",
        "chi2": None, "p_value": None, "cramers_v": None, "effect_size": None,
        "is_model_biased": False, "dp_gap_on_predictions": None,
        "tpr_gap": None, "fpr_gap": None,
        "per_group_prediction_rate": {}, "per_group_tpr": {}, "per_group_fpr": {},
        "disadvantaged_group": None, "explanation": msg,
    }


# ─── Layer 3: Outcome Bias ───────────────────────────────────────────────────

def outcome_bias(
    groups: List[str],
    selection_rates: Dict[str, float],
    thresholds: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """
    Outcome bias — what actually happens at decision time.

    Measures the final allocation disparity after any thresholding.
    Uses the observed selection rates (from labels, not predictions).
    """
    if len(groups) < 2 or not selection_rates:
        return {
            "layer": "outcome_bias",
            "per_group_outcome_rate": {},
            "outcome_gap": None,
            "disadvantaged_group": None,
            "flagged": False,
            "explanation": "Insufficient groups for outcome bias analysis.",
        }

    rates  = {g: float(selection_rates.get(g, 0.0)) for g in groups}
    lo_grp = min(rates, key=rates.get)
    hi_grp = max(rates, key=rates.get)
    gap    = round(rates[hi_grp] - rates[lo_grp], 4)
    flagged = gap > 0.10

    return {
        "layer":                  "outcome_bias",
        "per_group_outcome_rate": {g: round(r, 4) for g, r in rates.items()},
        "outcome_gap":            gap,
        "disadvantaged_group":    lo_grp,
        "advantaged_group":       hi_grp,
        "applied_thresholds":     thresholds,
        "flagged":                flagged,
        "explanation": (
            f"Outcome bias: '{lo_grp}' achieves {rates[lo_grp]:.1%} vs "
            f"'{hi_grp}' at {rates[hi_grp]:.1%} (gap={gap:.1%}). "
            + ("Allocation disparity exceeds 10% threshold." if flagged
               else "Allocation disparity within acceptable range.")
        ),
    }


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _cramers_label(cv: Optional[float]) -> Optional[str]:
    if cv is None:
        return None
    if cv >= 0.40:
        return "large"
    if cv >= 0.20:
        return "medium"
    if cv >= 0.10:
        return "small"
    return "negligible"

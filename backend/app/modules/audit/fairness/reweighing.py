"""
fairness/reweighing.py
----------------------
Correct reweighing implementation following Kamiran & Calders (2012).

Formula:
    w(A=a, Y=y) = P(A=a) * P(Y=y) / P(A=a, Y=y)

This reweighs each training instance to make the dataset statistically
independent of the protected attribute — as if (A ⊥ Y).

Rules:
  - Uses y_true (NEVER predictions)
  - Computes joint probabilities from observed counts
  - Handles zero-frequency cells with fallback weight of 1.0
  - Returns per-sample weight array aligned with dataset index

Reference: Kamiran, F. & Calders, T. (2012). Data preprocessing techniques
           for classification without discrimination. KDDM 33(1).
"""

from __future__ import annotations
from typing import Any, Dict, Optional, Tuple
import numpy as np
import pandas as pd


def compute_reweighing_weights(
    df: pd.DataFrame,
    sensitive_col: str,
    label_col: str,
    positive_class: Any,
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Compute Kamiran-Calders reweighing weights.

    Returns:
        weights : np.ndarray of shape (len(df),), one weight per row
        report  : diagnostics dict

    Weights satisfy:
        sum(w_i for group A=a, label Y=y) ∝ P(A=a) * P(Y=y)

    After reweighing, the weighted joint distribution is:
        P_w(A=a, Y=y) = P(A=a) * P(Y=y)   [independence]
    """
    if sensitive_col not in df.columns or label_col not in df.columns:
        return np.ones(len(df)), {"error": "Required columns missing."}

    work  = df[[sensitive_col, label_col]].copy()
    total = float(len(work))
    if total == 0:
        return np.ones(len(df)), {"error": "Empty dataframe."}

    # Marginal probabilities
    p_a: Dict[str, float] = {}
    for a in work[sensitive_col].dropna().unique():
        p_a[str(a)] = float((work[sensitive_col] == a).sum()) / total

    p_y: Dict[Any, float] = {}
    for y in work[label_col].dropna().unique():
        p_y[y] = float((work[label_col] == y).sum()) / total

    # Joint probabilities P(A=a, Y=y)
    p_ay: Dict[Tuple[str, Any], float] = {}
    for a in work[sensitive_col].dropna().unique():
        for y in work[label_col].dropna().unique():
            count = float(((work[sensitive_col] == a) & (work[label_col] == y)).sum())
            p_ay[(str(a), y)] = count / total

    # Assign per-row weights: w_i = P(A=a_i) * P(Y=y_i) / P(A=a_i, Y=y_i)
    weights = np.ones(len(df), dtype=float)

    for idx in range(len(df)):
        row   = work.iloc[idx]
        a_val = row[sensitive_col]
        y_val = row[label_col]
        if pd.isna(a_val) or pd.isna(y_val):
            weights[idx] = 1.0
            continue
        a_str = str(a_val)
        joint = p_ay.get((a_str, y_val), 0.0)
        if joint == 0.0:
            weights[idx] = 1.0   # zero-frequency cell → neutral weight
            continue
        weights[idx] = (p_a.get(a_str, 0.0) * p_y.get(y_val, 0.0)) / joint

    # Compute weighted selection rates per group (what the model would see)
    weighted_rates: Dict[str, float] = {}
    for a in sorted(work[sensitive_col].dropna().unique(), key=str):
        mask = work[sensitive_col] == a
        if not mask.any():
            continue
        w_g   = weights[mask.values]
        y_g   = (work.loc[mask, label_col] == positive_class).astype(float).values
        w_sum = float(w_g.sum())
        weighted_rates[str(a)] = round(float((w_g * y_g).sum() / w_sum), 4) if w_sum > 0 else 0.0

    # Diagnostics
    report = {
        "method":          "reweighing_kamiran_calders_2012",
        "marginal_p_a":    {k: round(v, 4) for k, v in p_a.items()},
        "marginal_p_y":    {str(k): round(v, 4) for k, v in p_y.items()},
        "joint_p_ay":      {f"{k[0]}|{k[1]}": round(v, 4) for k, v in p_ay.items()},
        "weight_stats": {
            "min":  round(float(weights.min()), 4),
            "max":  round(float(weights.max()), 4),
            "mean": round(float(weights.mean()), 4),
            "std":  round(float(weights.std()), 4),
        },
        "weighted_selection_rates": weighted_rates,
        "n_samples": len(df),
    }

    return weights, report


def apply_reweighing(
    df: pd.DataFrame,
    sensitive_col: str,
    label_col: str,
    positive_class: Any,
    group_stats: list,
) -> Dict[str, Any]:
    """
    Apply reweighing and compute resulting fairness metrics.
    Returns the structure expected by run_mitigation.
    """
    weights, report = compute_reweighing_weights(df, sensitive_col, label_col, positive_class)

    weighted_rates_dict = report.get("weighted_selection_rates", {})
    # Order must match group_stats order
    adjusted_rates = [
        weighted_rates_dict.get(str(gs["group"]), gs["pass_rate"])
        for gs in group_stats
    ]

    if len(adjusted_rates) < 2:
        return {"method": "reweighing", "error": "insufficient groups after reweighing"}

    rates_f = [float(r) for r in adjusted_rates]
    dpd_after = round(max(rates_f) - min(rates_f), 4)
    max_r = max(rates_f)
    dir_after = round(min(rates_f) / max_r, 4) if max_r > 0 else None

    return {
        "method":          "reweighing",
        "method_type":     "pre-processing",
        "accuracy":        None,   # reweighing is pre-model; accuracy projected separately
        "precision":       None,
        "recall":          None,
        "dpd":             dpd_after,
        "dir":             dir_after,
        "tpr_gap":         None,
        "fpr_gap":         None,
        "adjusted_rates":  adjusted_rates,
        "weights_report":  report,
    }

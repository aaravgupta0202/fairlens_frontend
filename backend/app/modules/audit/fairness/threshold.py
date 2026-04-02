"""
fairness/threshold.py
---------------------
Proper threshold optimization for fairness.

Supports:
  1. Global threshold search — single threshold minimizing overall fairness violation
  2. Group-specific threshold search — per-group thresholds equalizing selection rates
     (satisfies Demographic Parity post-processing)

Reference: Hardt, M., Price, E. & Srebro, N. (2016). Equality of opportunity
           in supervised learning. NeurIPS 2016.
           Pleiss et al. (2017). On fairness and calibration. NeurIPS 2017.
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd


THRESHOLD_GRID = np.arange(0.02, 0.99, 0.02)


# ─── Global threshold search ─────────────────────────────────────────────────

def find_global_threshold(
    y_prob: np.ndarray,
    y_true: np.ndarray,
    sensitive: np.ndarray,
    fairness_weight: float = 0.7,
    accuracy_weight: float = 0.3,
) -> Dict[str, Any]:
    """
    Find a single threshold that minimizes:
        loss = fairness_weight * dpd + accuracy_weight * (1 - accuracy)

    Returns the best threshold and its evaluation.
    """
    best_t    = 0.5
    best_loss = float("inf")
    results   = []

    for t in THRESHOLD_GRID:
        t = float(t)
        y_hat    = (y_prob >= t).astype(int)
        groups   = np.unique(sensitive)
        rates    = [float(np.mean(y_hat[sensitive == g] == 1)) for g in groups
                    if int((sensitive == g).sum()) > 0]
        if len(rates) < 2:
            continue
        dpd = max(rates) - min(rates)
        acc = float(np.mean(y_hat == y_true))
        loss = fairness_weight * dpd + accuracy_weight * (1.0 - acc)
        results.append({"threshold": round(t, 2), "dpd": round(dpd, 4),
                        "accuracy": round(acc, 4), "loss": round(loss, 4)})
        if loss < best_loss:
            best_loss = loss
            best_t    = t

    y_hat_best = (y_prob >= best_t).astype(int)
    groups     = np.unique(sensitive)
    final_rates = {}
    for g in groups:
        mask = sensitive == g
        if mask.sum() == 0:
            continue
        final_rates[str(g)] = round(float(np.mean(y_hat_best[mask] == 1)), 4)

    rates_list = list(final_rates.values())
    dpd_final  = round(max(rates_list) - min(rates_list), 4) if len(rates_list) >= 2 else 0.0
    max_r      = max(rates_list) if rates_list else 0.0
    dir_final  = round(min(rates_list) / max_r, 4) if max_r > 0 else None
    acc_final  = round(float(np.mean(y_hat_best == y_true)), 4)

    return {
        "strategy":          "global_threshold",
        "best_threshold":    round(best_t, 2),
        "dpd_after":         dpd_final,
        "dir_after":         dir_final,
        "accuracy_after":    acc_final,
        "per_group_rates":   final_rates,
        "threshold_grid":    results,
    }


# ─── Group-specific threshold search ─────────────────────────────────────────

def find_group_thresholds(
    y_prob: np.ndarray,
    y_true: np.ndarray,
    sensitive: np.ndarray,
    target_rate: Optional[float] = None,
    lambda_acc: float = 0.5,
) -> Dict[str, Any]:
    """
    Find per-group thresholds to equalize selection rates.

    For each group g, find threshold t_g minimizing:
        |rate_g(t) - target_rate| + lambda_acc * (1 - accuracy_g(t))

    where target_rate defaults to the global median selection rate.

    This implements demographic parity post-processing.
    """
    if target_rate is None:
        groups  = np.unique(sensitive)
        rates   = [float(np.mean((y_prob[sensitive == g] >= 0.5) == 1))
                   for g in groups if int((sensitive == g).sum()) > 0]
        target_rate = float(np.median(rates)) if rates else 0.5

    groups = sorted(np.unique(sensitive).tolist(), key=str)
    group_thresholds: Dict[str, float]  = {}
    group_rates:      Dict[str, float]  = {}
    group_accuracies: Dict[str, float]  = {}

    for grp in groups:
        mask = sensitive == grp
        if int(mask.sum()) == 0:
            continue
        gp   = y_prob[mask]
        gy   = y_true[mask]
        best_t, best_loss = 0.5, float("inf")

        for t in THRESHOLD_GRID:
            t      = float(t)
            y_hat  = (gp >= t).astype(int)
            rate   = float(np.mean(y_hat == 1))
            acc_g  = float(np.mean(y_hat == gy))
            loss   = abs(rate - target_rate) + lambda_acc * (1.0 - acc_g)
            if loss < best_loss:
                best_loss = loss
                best_t    = t

        group_thresholds[str(grp)] = round(best_t, 2)
        y_hat_g = (gp >= best_t).astype(int)
        group_rates[str(grp)]      = round(float(np.mean(y_hat_g == 1)), 4)
        group_accuracies[str(grp)] = round(float(np.mean(y_hat_g == gy)), 4)

    # Apply and evaluate
    y_hat_all = np.zeros(len(y_prob), dtype=int)
    for grp, t in group_thresholds.items():
        mask = sensitive == grp
        y_hat_all[mask] = (y_prob[mask] >= t).astype(int)

    rates_list = list(group_rates.values())
    dpd_final  = round(max(rates_list) - min(rates_list), 4) if len(rates_list) >= 2 else 0.0
    max_r      = max(rates_list) if rates_list else 0.0
    dir_final  = round(min(rates_list) / max_r, 4) if max_r > 0 else None
    acc_final  = round(float(np.mean(y_hat_all == y_true)), 4)

    # TPR / FPR gaps after group thresholds
    tpr_vals = []
    fpr_vals = []
    for grp in groups:
        mask = sensitive == grp
        if int(mask.sum()) == 0:
            continue
        yt = y_true[mask]
        yp = y_hat_all[mask]
        tp = int(np.sum((yt == 1) & (yp == 1)))
        fp = int(np.sum((yt == 0) & (yp == 1)))
        fn = int(np.sum((yt == 1) & (yp == 0)))
        tn = int(np.sum((yt == 0) & (yp == 0)))
        if (tp + fn) > 0:
            tpr_vals.append(float(tp / (tp + fn)))
        if (fp + tn) > 0:
            fpr_vals.append(float(fp / (fp + tn)))
    tpr_gap = round(max(tpr_vals) - min(tpr_vals), 4) if len(tpr_vals) >= 2 else None
    fpr_gap = round(max(fpr_vals) - min(fpr_vals), 4) if len(fpr_vals) >= 2 else None

    return {
        "strategy":           "group_specific_thresholds",
        "target_rate":        round(target_rate, 4),
        "group_thresholds":   group_thresholds,
        "per_group_rates":    group_rates,
        "per_group_accuracy": group_accuracies,
        "dpd_after":          dpd_final,
        "dir_after":          dir_final,
        "accuracy_after":     acc_final,
        "tpr_gap_after":      tpr_gap,
        "fpr_gap_after":      fpr_gap,
        "adjusted_rates":     [group_rates.get(str(g), 0.0) for g in groups],
    }

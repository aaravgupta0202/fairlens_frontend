"""
fairness/evaluation.py
-----------------------
Before-vs-after evaluation framework.

Runs all mitigation strategies, evaluates each using standardized
fairness metrics, and produces a comparison table.

Output structure:
    {
      "baseline": {...metrics...},
      "reweighing": {...metrics...},
      "threshold_global": {...metrics...},
      "threshold_group": {...metrics...},
      "disparate_impact_remover": {...metrics...},
      "reject_option_classification": {...metrics...},
      "best_method": "...",
      "comparison_table": [...],
      "scoring_function": "0.6*dpd_reduction + 0.3*accuracy + 0.1*stability",
    }
"""

from __future__ import annotations
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from .metrics import compute_bias_score, demographic_parity, disparate_impact


# ─── Scoring function ────────────────────────────────────────────────────────

def score_method(
    before_dpd: float,
    after_dpd: float,
    accuracy: Optional[float],
    adjusted_rates: List[float],
    confidence: float = 1.0,
) -> float:
    """
    Rank score ∈ [-1, 1].
    Formula: 0.6 * bias_reduction + 0.3 * accuracy + 0.1 * stability
    Returns -1.0 if the method increased bias (invalid).
    """
    if after_dpd > before_dpd:
        return -1.0   # method worsened fairness — disqualified

    dpd_reduction = max(0.0, min(1.0, (before_dpd - after_dpd) / before_dpd)) if before_dpd > 0 else 0.0
    acc = float(accuracy) if accuracy is not None else 0.5
    stability = max(0.0, min(1.0, 1.0 - float(np.std(adjusted_rates)))) if len(adjusted_rates) >= 2 else 1.0

    raw = 0.6 * dpd_reduction * confidence + 0.3 * acc + 0.1 * stability
    return round(max(-1.0, min(1.0, raw)), 4)


# ─── Baseline metrics ────────────────────────────────────────────────────────

def evaluate_baseline(
    groups: List[str],
    selection_rates: Dict[str, float],
    tpr_by_group: Optional[Dict[str, Optional[float]]] = None,
    fpr_by_group: Optional[Dict[str, Optional[float]]] = None,
    has_predictions: bool = False,
) -> Dict[str, Any]:
    """Evaluate fairness metrics at baseline (no mitigation)."""
    rates = [selection_rates.get(g, 0.0) for g in groups]
    dpd   = round(max(rates) - min(rates), 4) if len(rates) >= 2 else 0.0
    max_r = max(rates) if rates else 0.0
    dir_  = round(min(rates) / max_r, 4) if max_r > 0 else None

    tpr_gap = fpr_gap = None
    if has_predictions and tpr_by_group and fpr_by_group:
        tpr_vals = [v for v in tpr_by_group.values() if v is not None]
        fpr_vals = [v for v in fpr_by_group.values() if v is not None]
        if len(tpr_vals) >= 2:
            tpr_gap = round(max(tpr_vals) - min(tpr_vals), 4)
        if len(fpr_vals) >= 2:
            fpr_gap = round(max(fpr_vals) - min(fpr_vals), 4)

    score_info = compute_bias_score(dpd, dir_, tpr_gap, fpr_gap, has_predictions)

    return {
        "method":          "baseline",
        "dpd":             dpd,
        "dir":             dir_,
        "tpr_gap":         tpr_gap,
        "fpr_gap":         fpr_gap,
        "bias_score":      score_info["score"],
        "selection_rates": selection_rates,
        "score_breakdown": score_info["breakdown"],
    }


# ─── Comparison table ────────────────────────────────────────────────────────

def build_comparison_table(
    baseline: Dict[str, Any],
    method_results: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Build a before/after comparison table for all methods.

    Each row:
        method, dpd_before, dpd_after, dpd_change,
        dir_before, dir_after,
        tpr_gap_before, tpr_gap_after,
        bias_score_before, bias_score_after, improvement,
        accuracy, rank_score
    """
    table = []
    for r in method_results:
        if "error" in r:
            continue
        method  = r.get("method", "unknown")
        dpd_a   = r.get("dpd", baseline["dpd"])
        dir_a   = r.get("dir", baseline["dir"])
        tpr_a   = r.get("tpr_gap")
        fpr_a   = r.get("fpr_gap")
        adj     = r.get("adjusted_rates", [])
        acc     = r.get("accuracy")

        score_a = compute_bias_score(
            dpd_a, dir_a, tpr_a, fpr_a,
            has_predictions=bool(tpr_a is not None),
        )

        rank = score_method(
            before_dpd=baseline["dpd"],
            after_dpd=dpd_a,
            accuracy=acc,
            adjusted_rates=[float(x) for x in adj],
        )

        table.append({
            "method":             method,
            "method_type":        r.get("method_type", "unknown"),
            "dpd_before":         baseline["dpd"],
            "dpd_after":          dpd_a,
            "dpd_change":         round(dpd_a - baseline["dpd"], 4),
            "dir_before":         baseline["dir"],
            "dir_after":          dir_a,
            "tpr_gap_before":     baseline["tpr_gap"],
            "tpr_gap_after":      tpr_a,
            "fpr_gap_before":     baseline["fpr_gap"],
            "fpr_gap_after":      fpr_a,
            "bias_score_before":  baseline["bias_score"],
            "bias_score_after":   score_a["score"],
            "improvement":        round(baseline["bias_score"] - score_a["score"], 1),
            "accuracy":           acc,
            "rank_score":         rank,
            "valid":              rank >= 0,
        })

    table.sort(key=lambda x: x["rank_score"], reverse=True)
    return table


def select_best_method(
    comparison_table: List[Dict[str, Any]],
    scenario_preferred: Optional[str] = None,
    scenario_bonus: float = 0.03,
) -> str:
    """
    Select the best method from the comparison table.

    If the scenario-preferred method is among the valid methods and its
    score is within `scenario_bonus` of the top, prefer it (tie-breaking).
    Otherwise, choose the highest-scoring valid method.
    """
    valid = [r for r in comparison_table if r.get("valid", False)]
    if not valid:
        # All methods invalid — return the one with lowest bias score
        if comparison_table:
            return min(comparison_table, key=lambda x: x["bias_score_after"])["method"]
        return "reweighing"

    best     = valid[0]
    best_scr = best["rank_score"]

    if scenario_preferred:
        for r in valid:
            if r["method"] == scenario_preferred:
                if (best_scr - r["rank_score"]) <= scenario_bonus:
                    return scenario_preferred
                break

    return best["method"]

from pydantic import BaseModel
from typing import Dict, List, Optional, Any


# ── Requests ──────────────────────────────────────────────────────────────────

class AuditRequest(BaseModel):
    dataset: str
    description: str
    target_column: Optional[str] = None
    prediction_column: Optional[str] = None   # NEW: model predictions
    sensitive_column: Optional[str] = None
    sensitive_column_2: Optional[str] = None


class ChatRequest(BaseModel):
    dataset_description: str
    audit_summary: str
    conversation: List[Dict[str, str]]
    message: str


# ── Per-group statistics ──────────────────────────────────────────────────────

class ConfusionMatrix(BaseModel):
    tp: int
    fp: int
    tn: int
    fn: int


class NumericGap(BaseModel):
    col: str
    gap_pct: float
    gap_raw: float
    lo_group: str
    lo_avg: float
    hi_group: str
    hi_avg: float


class GroupStats(BaseModel):
    group: str
    count: int
    avg_value: Optional[float] = None
    avg_by_col: Optional[Dict[str, float]] = None   # avg per numeric column
    pass_count: int
    fail_count: int
    pass_rate: float
    # True fairness metrics (require prediction_column)
    tpr: Optional[float] = None   # TP / (TP + FN)
    fpr: Optional[float] = None   # FP / (FP + TN)
    accuracy: Optional[float] = None
    confusion: Optional[ConfusionMatrix] = None


# ── Metric result ─────────────────────────────────────────────────────────────

class MetricResult(BaseModel):
    name: str
    key: str
    value: Optional[float] = None
    threshold: Optional[float] = None
    threshold_direction: str = "below"
    flagged: bool
    interpretation: str


# ── Statistical significance ──────────────────────────────────────────────────

class StatisticalTest(BaseModel):
    test: str           # "chi_square"
    statistic: float
    p_value: float
    is_significant: bool
    cramers_v: float = 0.0          # effect size: <0.10 negligible, <0.20 small, <0.40 medium, ≥0.40 large
    effect_size: str = "unknown"    # "negligible" | "small" | "medium" | "large"
    interpretation: str


# ── Bias origin ───────────────────────────────────────────────────────────────

class BiasOrigin(BaseModel):
    group: str
    metric: str


# ── Mitigation results ────────────────────────────────────────────────────────

class MitigationMethodResult(BaseModel):
    method: str
    bias_score: float
    accuracy: Optional[float] = None
    tpr_gap: float
    fpr_gap: float
    dpd: float
    improvement: float
    final_score: float    # 0.6*bias_reduction + 0.3*accuracy + 0.1*stability; -1 = INVALID
    description: str


class MitigationSummary(BaseModel):
    before_bias_score: float
    results: List[MitigationMethodResult]
    best_method: str
    best_reason: str
    bias_before: float
    bias_after: float
    accuracy_after: Optional[float]
    trade_off_summary: str   # "Bias ↓ 35 pts | Accuracy ↓ 6%"


# ── Data reliability ──────────────────────────────────────────────────────────

class DataReliability(BaseModel):
    reliability: str
    confidence_score: float
    warnings: List[str]


# ── Main audit response ───────────────────────────────────────────────────────

class AuditResponse(BaseModel):
    bias_score: float
    bias_level: str
    risk_label: str
    bias_detected: bool

    total_rows: int
    columns: List[str]
    sensitive_column: Optional[str] = None
    target_column: Optional[str] = None
    prediction_column: Optional[str] = None
    has_predictions: bool = False

    metrics: List[MetricResult]
    group_stats: List[GroupStats]

    statistical_test: Optional[StatisticalTest] = None
    bias_origin: Optional[BiasOrigin] = None
    root_causes: List[str] = []
    mitigation: Optional[MitigationSummary] = None
    reliability: Optional[DataReliability] = None

    summary: str
    key_findings: List[str]
    recommendations: List[str]

    primary_numeric_column: Optional[str] = None
    all_numeric_gaps: List[Any] = []
    score_breakdown: Optional[Dict[str, Any]] = None

    audit_summary_json: str


class ChatResponse(BaseModel):
    reply: str

"""
compliance_service.py
Business logic for EU AI Act compliance records.
Called by audit_route.py — no HTTP logic here.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException

from app.schemas.audit_schema import (
    ComplianceMetadata,
    ComplianceRecordRequest,
    ComplianceRecordResponse,
    TECHNICAL_LEAD_ROLE,
    VALIDATION_ROLES,
)
from app.modules.audit.storage import ComplianceFileStore

store = ComplianceFileStore()


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def merge_metadata(
    incoming: Optional[ComplianceMetadata],
    existing: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    base = ComplianceMetadata(**(existing or {})).model_dump()
    if incoming:
        for key, value in incoming.model_dump(exclude_none=True).items():
            base[key] = value
    if not base.get("robustness_validation"):
        base["robustness_validation"] = {}
    if not base.get("countersignatures"):
        base["countersignatures"] = []
    return base


def derive_robustness(
    audit_result: Dict[str, Any],
    existing: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    groups = audit_result.get("group_stats") or []
    metrics = []
    for g in groups:
        confusion = g.get("confusion") or {}
        tp = confusion.get("tp", 0)
        fp = confusion.get("fp", 0)
        tn = confusion.get("tn", 0)
        fn = confusion.get("fn", 0)
        total = tp + fp + tn + fn
        if total == 0:
            continue
        precision  = tp / (tp + fp) if (tp + fp) > 0 else None
        recall     = tp / (tp + fn) if (tp + fn) > 0 else None
        accuracy   = (tp + tn) / total if total > 0 else None
        f1         = (2 * precision * recall / (precision + recall)) if (precision and recall and (precision + recall) > 0) else None
        error_rate = (fp + fn) / total if total > 0 else None
        metrics.append({
            "group": g.get("group"),
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "accuracy": accuracy,
            "error_rate": error_rate,
            "status": "pending_validation",
            "validator_role": TECHNICAL_LEAD_ROLE,
            "validated_by": None,
            "validated_at": None,
            "auto_computed": True,
        })

    auto = {
        "status": "pending_validation" if metrics else "not_documented",
        "validator_role": TECHNICAL_LEAD_ROLE,
        "auto_computed": bool(metrics),
        "auto_computed_at": iso_now(),
        "per_group": metrics,
        "ood_testing": {"status": "not_documented"},
        "adversarial_testing": {"status": "not_documented"},
    }
    if not existing:
        return auto

    merged = {**auto, **{k: v for k, v in existing.items() if v is not None}}
    existing_by_group = {m.get("group"): m for m in existing.get("per_group", []) if isinstance(m, dict)}
    merged["per_group"] = [
        {**m, **{k: v for k, v in existing_by_group[m["group"]].items() if v is not None}}
        if m.get("group") in existing_by_group else m
        for m in metrics
    ]
    return merged


def validate_roles(metadata: Dict[str, Any]) -> None:
    for entry in metadata.get("countersignatures", []):
        role = entry.get("role")
        if role and role not in VALIDATION_ROLES:
            raise HTTPException(status_code=422, detail=f"Invalid countersignature role: {role}")
    rv = metadata.get("robustness_validation") or {}
    role = rv.get("validator_role")
    if role and role not in VALIDATION_ROLES:
        raise HTTPException(status_code=422, detail="Invalid validator role for robustness validation")
    if rv.get("status") == "validated" and role and role != TECHNICAL_LEAD_ROLE:
        raise HTTPException(
            status_code=403,
            detail="Only the Technical Lead / Model Developer may validate robustness metrics",
        )


def build_compliance_record(
    payload: ComplianceRecordRequest,
    mark_export: bool,
) -> ComplianceRecordResponse:
    """Create or update a compliance record. Core service logic."""
    existing: Optional[Dict[str, Any]] = None
    previous_hash: Optional[str] = None

    if payload.record_id:
        try:
            existing = store.get(payload.record_id)
            hash_valid, _ = store.verify_hash(existing)
            if not hash_valid:
                raise HTTPException(
                    status_code=409,
                    detail="Stored compliance record failed integrity verification",
                )
            previous_hash = existing.get("integrity_hash")
        except FileNotFoundError:
            existing = None

    record_id    = payload.record_id or str(uuid.uuid4())
    base_meta    = merge_metadata(
        payload.compliance_metadata,
        existing.get("compliance_metadata") if existing else None,
    )
    base_meta["robustness_validation"] = derive_robustness(
        payload.audit_result, base_meta.get("robustness_validation")
    )
    validate_roles(base_meta)

    # Enforce locked fields
    if existing and existing.get("deployment_locked"):
        current_nca  = (existing.get("compliance_metadata") or {}).get("nca_jurisdiction")
        incoming_nca = base_meta.get("nca_jurisdiction")
        if incoming_nca is not None and incoming_nca != current_nca:
            raise HTTPException(status_code=400, detail="nca_jurisdiction is locked after deployment")

    created_at        = existing["created_at"] if existing else iso_now()
    updated_at        = iso_now()
    deployment_locked = existing["deployment_locked"] if existing else False
    if payload.deployment_locked is not None:
        deployment_locked = deployment_locked or payload.deployment_locked
    record_version    = (existing["record_version"] + 1) if existing else 1
    integrity_hash    = store.compute_integrity_hash(record_id, updated_at, base_meta)

    record = {
        "record_id":            record_id,
        "record_version":       record_version,
        "deployment_locked":    deployment_locked,
        "created_at":           created_at,
        "updated_at":           updated_at,
        "integrity_hash":       integrity_hash,
        "export_integrity_hash": existing.get("export_integrity_hash") if existing else None,
        "audit_result":         payload.audit_result,
        "compliance_metadata":  base_meta,
    }
    if mark_export:
        record["export_integrity_hash"] = integrity_hash

    saved = store.save(record, previous_hash=previous_hash)
    hash_valid, _ = store.verify_hash(saved)
    return ComplianceRecordResponse(**{**saved, "hash_valid": hash_valid})


def get_compliance_record(record_id: str) -> ComplianceRecordResponse:
    """Retrieve and verify a compliance record."""
    try:
        record = store.get(record_id)
        hash_valid, _ = store.verify_hash(record)
        return ComplianceRecordResponse(**{**record, "hash_valid": hash_valid})
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Compliance record not found")

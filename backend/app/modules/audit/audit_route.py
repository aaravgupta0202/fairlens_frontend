"""
audit_route.py
HTTP routing only — no business logic.
All logic lives in audit_service.py and compliance_service.py.
"""

from fastapi import APIRouter, HTTPException

from app.schemas.audit_schema import (
    AuditRequest,
    AuditResponse,
    ChatRequest,
    ChatResponse,
    ComplianceRecordRequest,
    ComplianceRecordResponse,
)
from app.modules.audit.audit_service import run_audit, run_chat, get_audit_by_id
from app.modules.audit.compliance_service import build_compliance_record, get_compliance_record

router = APIRouter(tags=["Audit"])


@router.post("/audit-dataset", response_model=AuditResponse)
async def audit_dataset(request: AuditRequest):
    """
    POST /audit-dataset
    Body: { dataset, description, target_column?, sensitive_column? }
    Returns structured AI fairness audit report.
    """
    try:
        return await run_audit(request)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit failed: {str(e)}")


@router.post("/audit-chat", response_model=ChatResponse)
async def audit_chat(request: ChatRequest):
    """
    POST /audit-chat
    Body: { dataset_description, audit_summary, conversation, message }
    Returns AI reply for follow-up questions about the audit.
    """
    try:
        return await run_chat(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@router.get("/audit-results/{audit_id}", response_model=AuditResponse)
async def get_audit_result(audit_id: str):
    """
    GET /audit-results/{audit_id}
    Retrieve a stored audit result by ID.
    """
    try:
        return await get_audit_by_id(audit_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Audit not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/compliance-records/snapshot", response_model=ComplianceRecordResponse)
async def create_compliance_snapshot(payload: ComplianceRecordRequest):
    """
    POST /compliance-records/snapshot
    Create or update a compliance record and capture an export-time hash snapshot.
    """
    return build_compliance_record(payload, mark_export=True)


@router.patch("/compliance-records/{record_id}", response_model=ComplianceRecordResponse)
async def update_compliance_record(record_id: str, payload: ComplianceRecordRequest):
    """
    PATCH /compliance-records/{record_id}
    Update an existing compliance record. nca_jurisdiction locked after deployment.
    """
    payload.record_id = record_id
    return build_compliance_record(payload, mark_export=False)


@router.get("/compliance-records/{record_id}", response_model=ComplianceRecordResponse)
async def fetch_compliance_record(record_id: str):
    """
    GET /compliance-records/{record_id}
    Retrieve a compliance record and verify its integrity hash.
    """
    return get_compliance_record(record_id)

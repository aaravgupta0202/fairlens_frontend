"""
storage.py — Audit and compliance record persistence.
Pure storage layer: no HTTP, no business logic.
Imported by audit_service.py and compliance_service.py.
"""

import json
import os
import shutil
import tempfile
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any, Dict, List, Optional

from filelock import FileLock


class JSONStorageManager:
    """
    Stores full audit records as JSON files with an index.
    Layout:  <base>/audits/<id>.json  +  <base>/index.json
    """

    REQUIRED_KEYS = {"id", "timestamp", "input", "metrics", "compliance", "hash"}

    def __init__(self, base_dir: Optional[str] = None):
        base = base_dir or os.getenv("FAIRLENS_DATA_DIR")
        self.base_dir   = Path(base) if base else Path(__file__).resolve().parents[4] / "data"
        self.audits_dir = self.base_dir / "audits"
        self.index_path = self.base_dir / "index.json"
        self._lock      = FileLock(str(self.base_dir / ".storage.lock"))

        self.base_dir.mkdir(parents=True, exist_ok=True)
        self.audits_dir.mkdir(parents=True, exist_ok=True)
        if not self.index_path.exists():
            self._write_json(self.index_path, {"audits": {}})

    # ── internals ─────────────────────────────────────────────────────────────

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat()

    @staticmethod
    def _hash(payload: Dict[str, Any]) -> str:
        packed = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        return f"SHA256:{sha256(packed.encode('utf-8')).hexdigest()}"

    def _write_json(self, target: Path, data: Dict[str, Any]) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix="fl_", suffix=".tmp", dir=str(target.parent))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.flush(); os.fsync(f.fileno())
            shutil.move(tmp, target)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)

    def _read_index(self) -> Dict[str, Any]:
        if not self.index_path.exists():
            return {"audits": {}}
        with open(self.index_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) and "audits" in data else {"audits": {}}

    def _validate(self, record: Dict[str, Any]) -> None:
        missing = self.REQUIRED_KEYS - set(record.keys())
        if missing:
            raise ValueError(f"Audit record missing fields: {sorted(missing)}")
        if not record["id"]:
            raise ValueError("Audit record id cannot be empty")

    # ── public API ────────────────────────────────────────────────────────────

    def save_audit(
        self,
        *,
        input_data: Dict[str, Any],
        metrics: Dict[str, Any],
        compliance: Dict[str, Any],
        audit_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        record_id = audit_id or str(uuid.uuid4())
        timestamp = self._now()
        integrity_hash = self._hash({"input": input_data, "metrics": metrics, "compliance": compliance})
        record = {
            "id": record_id, "timestamp": timestamp,
            "input": input_data, "metrics": metrics,
            "compliance": compliance, "hash": integrity_hash,
        }
        self._validate(record)
        with self._lock:
            self._write_json(self.audits_dir / f"{record_id}.json", record)
            index = self._read_index()
            index["audits"][record_id] = {
                "id": record_id, "timestamp": timestamp,
                "path": f"audits/{record_id}.json", "hash": integrity_hash,
            }
            self._write_json(self.index_path, index)
        return record

    def load_audit(self, audit_id: str) -> Dict[str, Any]:
        with self._lock:
            path = self.audits_dir / f"{audit_id}.json"
            if not path.exists():
                raise FileNotFoundError(f"Audit {audit_id} not found")
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._validate(data)
            return data

    def list_audits(self) -> List[Dict[str, Any]]:
        with self._lock:
            rows = list(self._read_index().get("audits", {}).values())
            rows.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            return rows


class ComplianceFileStore:
    """
    Stores compliance records as individual JSON files with an index.
    Used by compliance_service.py.
    """

    def __init__(self, store_dir: Optional[str] = None):
        base = store_dir or os.getenv("COMPLIANCE_STORE_DIR")
        self.store_dir  = Path(base) if base else Path(__file__).resolve().parent / "compliance_store"
        self._lock      = FileLock(str(self.store_dir / ".lock"))
        self.index_file = self.store_dir / "index.json"

        self.store_dir.mkdir(parents=True, exist_ok=True)
        if not self.index_file.exists():
            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump({}, f)

    # ── internals ─────────────────────────────────────────────────────────────

    def _read_index(self) -> Dict[str, Dict[str, str]]:
        if not self.index_file.exists():
            return {}
        with open(self.index_file, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            return {}
        return {
            rid: (v if isinstance(v, dict) else {"record_file": f"{rid}.json", "integrity_hash": v})
            for rid, v in raw.items()
        }

    def _write_index(self, index: Dict[str, Dict[str, str]]) -> None:
        fd, tmp = tempfile.mkstemp(prefix="comp_", suffix=".tmp", dir=str(self.store_dir))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(index, f, indent=2); f.flush(); os.fsync(f.fileno())
            shutil.move(tmp, self.index_file)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)

    # ── public API ────────────────────────────────────────────────────────────

    def compute_integrity_hash(self, record_id: str, updated_at: str, metadata: Dict[str, Any]) -> str:
        canonical = json.dumps(metadata, sort_keys=True, separators=(",", ":"))
        digest = sha256(f"{record_id}|{updated_at}|{canonical}".encode("utf-8")).hexdigest()
        return f"SHA256:{digest}"

    def save(self, record: Dict[str, Any], previous_hash: Optional[str] = None) -> Dict[str, Any]:
        with self._lock:
            rid  = record["record_id"]
            path = self.store_dir / f"{rid}.json"
            with open(path, "w", encoding="utf-8") as f:
                json.dump(record, f, indent=2, ensure_ascii=False)
            index = self._read_index()
            index[rid] = {"record_file": f"{rid}.json", "integrity_hash": record["integrity_hash"]}
            self._write_index(index)
            if previous_hash and previous_hash != record["integrity_hash"]:
                old = self.store_dir / f"{previous_hash}.json"
                if old.exists():
                    old.unlink()
        return record

    def get(self, record_id: str) -> Dict[str, Any]:
        with self._lock:
            entry = self._read_index().get(record_id)
            if not entry:
                raise FileNotFoundError(f"Record {record_id} not found")
            path = self.store_dir / entry.get("record_file", f"{record_id}.json")
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)

    def verify_hash(self, record: Dict[str, Any]):
        expected = self.compute_integrity_hash(
            record["record_id"], record["updated_at"], record["compliance_metadata"]
        )
        return expected == record.get("integrity_hash"), expected

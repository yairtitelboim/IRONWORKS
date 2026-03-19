#!/usr/bin/env python
"""
enrich_status_from_signals.py

Offline helper script to reduce the share of facilities whose status is "Unknown"
by inferring better status labels from news / signal data.

It is intentionally conservative: it only changes facilities that are explicitly
marked as "Unknown" today, and it records both the original and inferred labels.

Typical usage (dry run with summary only):

    python scripts/enrich_status_from_signals.py \
        --address-index public/data/address-search-index.json \
        --signals-json path/to/facility_latest_signals.json \
        --dry-run

Write an enriched index file:

    python scripts/enrich_status_from_signals.py \
        --address-index public/data/address-search-index.json \
        --signals-json path/to/facility_latest_signals.json \
        --output public/data/address-search-index.enriched-status.json

The expected shape of the signals JSON is:

{
  "by_project_id": {
    "proj_xxx": {
      "headline": "Acme breaks ground on new data center...",
      "summary": "Short natural‑language summary of the article...",
      "kind": "construction_started",
      "reason": "groundbreaking_ceremony",
      "source": "Some publisher",
      "published_at": "2025-11-01T00:00:00Z",
      "url": "https://…"
    },
    ...
  }
}

If your export has a different shape, you can either transform it before running
this script or adapt `load_signals()` accordingly.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ---- Data models ----------------------------------------------------------------


@dataclass
class Facility:
  project_id: Optional[str]
  status_label: Optional[str]
  status: Optional[str]
  planned_mw: Optional[float]
  total_mw: Optional[float]
  installed_mw: Optional[float]
  city: Optional[str]
  county: Optional[str]
  name: Optional[str]
  raw: Dict[str, Any]


@dataclass
class Signal:
  project_id: str
  headline: str
  summary: str
  kind: Optional[str]
  reason: Optional[str]
  source: Optional[str]
  published_at: Optional[str]
  url: Optional[str]
  gemini_status: Optional[str] = None
  gemini_confidence: Optional[float] = None


# ---- Loaders --------------------------------------------------------------------


def load_address_index(path: Path) -> Dict[str, Facility]:
  data = json.loads(path.read_text())
  facilities = data.get("facilities") or data  # support either shape
  if not isinstance(facilities, list):
    raise ValueError(f"Unexpected address index structure in {path}")

  by_id: Dict[str, Facility] = {}
  for row in facilities:
    if not isinstance(row, dict):
      continue
    project_id = row.get("project_id") or row.get("projectId")
    # Skip rows without a stable id; script is keyed by project_id
    if not project_id:
      continue
    status_label = row.get("status_label") or row.get("statusLabel")
    status = row.get("status")
    planned_mw = _safe_number(row.get("planned_mw") or row.get("plannedMw"))
    total_mw = _safe_number(row.get("total_mw") or row.get("totalMw") or row.get("size_mw"))
    installed_mw = _safe_number(row.get("installed_mw") or row.get("installedMw"))
    city = row.get("city")
    county = row.get("county")
    name = row.get("display_name") or row.get("displayName") or row.get("name")

    by_id[project_id] = Facility(
      project_id=project_id,
      status_label=status_label,
      status=status,
      planned_mw=planned_mw,
      total_mw=total_mw,
      installed_mw=installed_mw,
      city=city,
      county=county,
      name=name,
      raw=row,
    )
  return by_id


def load_signals(path: Optional[Path]) -> Dict[str, List[Signal]]:
  """
  Load signals JSON. The script is flexible but expects either:

  - {"by_project_id": { "proj": {headline, summary, ...} }}
  - {"signals": [ {project_id, headline, summary, ...}, ... ]}
  """
  if path is None:
    return {}
  blob = json.loads(path.read_text())
  by_id: Dict[str, List[Signal]] = {}

  if isinstance(blob, dict) and "by_project_id" in blob:
    src = blob["by_project_id"] or {}
    for pid, payload in src.items():
      if not isinstance(payload, dict):
        continue
      gemini = payload.get("gemini") or {}
      sig = Signal(
        project_id=pid,
        headline=str(payload.get("headline") or ""),
        summary=str(payload.get("summary") or ""),
        kind=_optional_str(payload.get("kind")),
        reason=_optional_str(payload.get("reason")),
        source=_optional_str(payload.get("source")),
        published_at=_optional_str(payload.get("published_at")),
        url=_optional_str(payload.get("url")),
        gemini_status=_optional_str(gemini.get("status")),
        gemini_confidence=_safe_number(gemini.get("extraction_confidence")),
      )
      by_id.setdefault(pid, []).append(sig)
    return by_id

  if isinstance(blob, dict) and isinstance(blob.get("signals"), list):
    for payload in blob["signals"]:
      if not isinstance(payload, dict):
        continue
      pid = payload.get("project_id") or payload.get("projectId")
      if not pid:
        continue
      sig = Signal(
        project_id=pid,
        headline=str(payload.get("headline") or ""),
        summary=str(payload.get("summary") or ""),
        kind=_optional_str(payload.get("kind")),
        reason=_optional_str(payload.get("reason")),
        source=_optional_str(payload.get("source")),
        published_at=_optional_str(payload.get("published_at")),
        url=_optional_str(payload.get("url")),
      )
      by_id.setdefault(pid, []).append(sig)
    return by_id

  raise ValueError(f"Unrecognized signals structure in {path}")


def augment_signals_with_links(
  signals_by_id: Dict[str, List[Signal]],
  links_path: Optional[Path],
) -> Dict[str, List[Signal]]:
  """
  Optionally augment signals with titles from facility-signal-links.json so that
  our keyword rules see more evidence (especially older articles).
  """
  if links_path is None:
    return signals_by_id

  blob = json.loads(links_path.read_text())
  if not isinstance(blob, dict) or "by_project_id" not in blob:
    return signals_by_id

  by_pid = blob.get("by_project_id") or {}
  for pid, payload in by_pid.items():
    if not isinstance(payload, dict):
      continue
    links = payload.get("links") or []
    for link in links:
      if not isinstance(link, dict):
        continue
      if link.get("excluded") is True:
        continue
      title = str(link.get("title") or "").strip()
      if not title:
        continue
      url = _optional_str(link.get("url"))
      source = _optional_str(link.get("domain"))
      # Treat each link title as a lightweight Signal, primarily to feed our
      # keyword rules (planned / construction / cancelled, etc.).
      sig = Signal(
        project_id=str(pid),
        headline=title,
        summary="",
        kind=None,
        reason=None,
        source=source,
        published_at=None,
        url=url,
      )
      signals_by_id.setdefault(str(pid), []).append(sig)

  return signals_by_id


# ---- Inference logic ------------------------------------------------------------


STATUS_CANONICAL = [
  "Operational",
  "Under Construction",
  "Planned",
  "Paused",
  "Cancelled",
]


def infer_status_from_signals(fac: Facility, signals: List[Signal]) -> Optional[str]:
  """
  Rule-based inference of a better status label from signals + numeric fields.
  Returns a canonical label or None if no confident inference can be made.
  """
  # 1) Prefer high-confidence Gemini status when available.
  for s in signals:
    if s.gemini_status and (s.gemini_confidence or 0.0) >= 0.8:
      mapped = _map_gemini_status(s.gemini_status)
      if mapped:
        return mapped

  if not signals and fac.installed_mw and fac.installed_mw > 0:
    # Installed capacity but no signals → likely operational.
    return "Operational"

  text_chunks: List[str] = []
  for s in signals:
    text_chunks.append(s.headline or "")
    text_chunks.append(s.summary or "")
    if s.kind:
      text_chunks.append(s.kind)
    if s.reason:
      text_chunks.append(s.reason)

  blob = " ".join(ch for ch in text_chunks if ch).lower()

  installed = fac.installed_mw or 0.0
  planned = fac.planned_mw or 0.0
  total = fac.total_mw or 0.0
  any_capacity = max(installed, planned, total)

  # Strong cancelling / scrapping cues
  if _contains_any(blob, ["cancelled", "canceled", "scrapped", "shelved", "terminated"]):
    return "Cancelled"

  # Paused / delayed
  if _contains_any(blob, ["paused", "on hold", "delayed", "postponed"]):
    return "Paused"

  # Under construction
  if _contains_any(blob, ["under construction", "broke ground", "groundbreaking", "construction began", "started building"]):
    if any_capacity > 0:
      return "Under Construction"

  # Operational cues
  if installed > 0:
    # If we know installed_mw > 0 and no explicit cancel/paused terms, treat as Operational
    if not _contains_any(blob, ["decommissioned", "shut down", "shutdown"]):
      return "Operational"

  if _contains_any(blob, ["in operation", "operational", "went live", "now live", "began operations"]):
    return "Operational"

  # Planned / announced
  if _contains_any(blob, ["announced", "proposal", "proposed", "seeking permits", "site selection", "planned"]) or planned > 0 or total > 0:
    return "Planned"

  return None


def enrich_all_statuses(
  facilities: Dict[str, Facility],
  signals_by_id: Dict[str, List[Signal]],
) -> Tuple[Dict[str, Dict[str, Any]], Counter]:
  """
  Produce an enriched facility dict (suitable for writing back to JSON) and
  a Counter of new status_label_new values.
  """
  enriched: Dict[str, Dict[str, Any]] = {}
  stats = Counter()

  for pid, fac in facilities.items():
    row = dict(fac.raw)  # shallow copy
    original = (fac.status_label or "").strip() or None

    if original and original.lower() != "unknown":
      # Leave existing non-Unknown statuses untouched
      enriched[pid] = row
      continue

    signals = signals_by_id.get(pid, [])
    inferred = infer_status_from_signals(fac, signals)
    if inferred and inferred in STATUS_CANONICAL:
      row["status_label_new"] = inferred
      row["status_label_source"] = "rules"
      stats[inferred] += 1
    else:
      # Explicitly mark that we attempted, but did not change the status.
      row["status_label_new"] = original or "Unknown"
      row["status_label_source"] = "unchanged"
      stats["unchanged"] += 1

    enriched[pid] = row

  return enriched, stats


# ---- Helpers --------------------------------------------------------------------


def _safe_number(value: Any) -> Optional[float]:
  try:
    if value is None:
      return None
    n = float(value)
    if n != n:  # NaN check
      return None
    return n
  except (TypeError, ValueError):
    return None


def _optional_str(value: Any) -> Optional[str]:
  if value is None:
    return None
  s = str(value).strip()
  return s or None


def _contains_any(blob: str, needles: List[str]) -> bool:
  return any(n in blob for n in needles)


def _map_gemini_status(raw_status: str) -> Optional[str]:
  """
  Map Gemini's normalized status into our canonical labels.
  """
  s = (raw_status or "").strip().lower()
  if not s:
    return None
  if s in {"operational", "in_operation", "in operation", "live"}:
    return "Operational"
  if s in {"under_construction", "construction", "building"}:
    return "Under Construction"
  if s in {"planned", "announced", "speculative"}:
    return "Planned"
  if s in {"cancelled", "canceled", "abandoned", "scrapped"}:
    return "Cancelled"
  if s in {"paused", "on_hold"}:
    return "Paused"
  return None


def _build_output_structure(
  original_index: Dict[str, Any],
  enriched_by_id: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
  """
  Preserve the original top-level structure of address-search-index.json but
  replace facility rows with their enriched versions.
  """
  if isinstance(original_index.get("facilities"), list):
    facilities_out: List[Dict[str, Any]] = []
    for row in original_index["facilities"]:
      pid = row.get("project_id") or row.get("projectId")
      if pid and pid in enriched_by_id:
        facilities_out.append(enriched_by_id[pid])
      else:
        facilities_out.append(row)
    out = dict(original_index)
    out["facilities"] = facilities_out
    return out

  # Fallback: assume the whole file is a list of facilities.
  if isinstance(original_index, list):
    facilities_out = []
    for row in original_index:
      if not isinstance(row, dict):
        facilities_out.append(row)
        continue
      pid = row.get("project_id") or row.get("projectId")
      if pid and pid in enriched_by_id:
        facilities_out.append(enriched_by_id[pid])
      else:
        facilities_out.append(row)
    return {"facilities": facilities_out}

  # Last resort: wrap enriched rows in a facilities array.
  return {"facilities": list(enriched_by_id.values())}


# ---- CLI ------------------------------------------------------------------------


def main(argv: Optional[List[str]] = None) -> None:
  parser = argparse.ArgumentParser(description="Enrich facility status labels from signals.")
  parser.add_argument(
    "--address-index",
    type=Path,
    default=Path("public/data/address-search-index.json"),
    help="Path to address-search-index.json (or similar facility index).",
  )
  parser.add_argument(
    "--signals-json",
    type=Path,
    default=None,
    help="Path to JSON containing latest facility signals (see module docstring for expected shape).",
  )
  parser.add_argument(
    "--links-json",
    type=Path,
    default=None,
    help="Optional path to facility-signal-links.json to augment text evidence.",
  )
  parser.add_argument(
    "--output",
    type=Path,
    default=None,
    help="Where to write enriched index JSON. If omitted, script only prints summary.",
  )
  parser.add_argument(
    "--only-unknown",
    action="store_true",
    help="If set, only include facilities that were originally Unknown in the output (for inspection).",
  )
  parser.add_argument(
    "--dry-run",
    action="store_true",
    help="Do not write output file, just print summary stats.",
  )

  args = parser.parse_args(argv)

  index_raw = json.loads(args.address_index.read_text())
  facilities = load_address_index(args.address_index)
  signals_by_id = load_signals(args.signals_json) if args.signals_json else {}
  signals_by_id = augment_signals_with_links(signals_by_id, args.links_json)

  total = len(facilities)
  unknown_before = sum(
    1
    for fac in facilities.values()
    if (fac.status_label or "").strip().lower() == "unknown"
  )

  enriched_by_id, stats = enrich_all_statuses(facilities, signals_by_id)

  unknown_after = sum(
    1
    for row in enriched_by_id.values()
    if str(row.get("status_label_new") or "").strip().lower() == "unknown" or row.get("status_label_source") == "unchanged"
  )

  print(f"Total facilities: {total}")
  print(f"Unknown before:  {unknown_before}")
  print(f"Unknown after:   {unknown_after}")
  print("New labels (status_label_new):")
  for label, count in stats.most_common():
    print(f"  {label:12s} {count}")

  if args.dry_run and not args.output:
    return

  # Build output structure.
  output_struct = _build_output_structure(index_raw, enriched_by_id)

  if args.only_unknown:
    # Filter down to rows that changed (helpful for manual inspection).
    facilities_out = []
    for row in output_struct.get("facilities", []):
      if not isinstance(row, dict):
        continue
      src = str(row.get("status_label_source") or "")
      if src in {"rules", "ml"}:
        facilities_out.append(row)
    output_struct["facilities"] = facilities_out

  target_path = args.output or Path("public/data/address-search-index.enriched-status.json")
  target_path.write_text(json.dumps(output_struct, indent=2, sort_keys=True))
  print(f"\nWrote enriched index to {target_path}")


if __name__ == "__main__":
  main()


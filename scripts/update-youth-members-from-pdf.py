#!/usr/bin/env python3

import argparse
import json
import re
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

try:
    import pdfplumber
except ImportError as exc:  # pragma: no cover - dependency check for local runs
    raise SystemExit(
        "pdfplumber가 필요합니다. 먼저 `python3 -m pip install --user pdfplumber` 를 실행해 주세요."
    ) from exc

try:
    import certifi
except ImportError:  # pragma: no cover - optional dependency
    certifi = None


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF_PATH = ROOT / "2025년 익산교회 주소록.pdf"
ENV_LOCAL = ROOT / ".env.local"
ENV_RTF = ROOT / ".env.rtf"
PHONE_RE = re.compile(r"^010-\d{4}-\d{4}$")
SALVATION_RE = re.compile(r"^(?P<yy>\d{2})\.(?P<mm>\d{2})\.(?P<dd>\d{2})$")
HEADER_NAME = "이름"
HEADER_AREA = "구역"
HEADER_SALVATION = "구원일"
HEADER_PHONE = "핸드폰"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "PDF 전체 페이지를 읽고 `청년회` 섹션만 자동 탐지하여 "
            "members.phone / members.salvation_date를 안전하게 업데이트합니다."
        )
    )
    parser.add_argument(
        "--pdf",
        default=str(DEFAULT_PDF_PATH),
        help="대상 PDF 경로",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="실제 DB 업데이트를 수행합니다. 지정하지 않으면 dry-run만 실행합니다.",
    )
    parser.add_argument(
        "--report",
        help="검토용 JSON 리포트를 저장할 경로",
    )
    parser.add_argument(
        "--strict-exact-name",
        action="store_true",
        help="이름 완전일치만 허용합니다. 지정하지 않으면 공백만 제거한 유일 매칭도 허용합니다.",
    )
    return parser.parse_args()


def parse_env_text(text: str) -> dict[str, str]:
    env: dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        normalized = line[1:].strip() if line.startswith("#") else line
        if "=" not in normalized:
            continue
        key, value = normalized.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key:
            env[key] = value
    return env


def load_credentials() -> tuple[str, str]:
    env: dict[str, str] = {}

    if ENV_LOCAL.exists():
        env |= parse_env_text(ENV_LOCAL.read_text(encoding="utf-8"))

    if ENV_RTF.exists() and (
        not env.get("NEXT_PUBLIC_SUPABASE_URL") or not env.get("SUPABASE_SERVICE_ROLE_KEY")
    ):
        env |= parse_env_text(ENV_RTF.read_text(encoding="utf-8"))

    url = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    service_role = env.get("SUPABASE_SERVICE_ROLE_KEY", "")

    if not url or not service_role:
        raise SystemExit("Supabase URL 또는 service role key를 찾지 못했습니다 (.env.local 또는 .env.rtf).")

    return url.rstrip("/"), service_role


def normalize_name(value: str | None) -> str:
    return re.sub(r"\s+", "", str(value or "")).strip()


def normalize_header(value: str | None) -> str:
    return normalize_name(value)


def parse_salvation_date(raw_value: str | None) -> tuple[str | None, str | None]:
    raw = str(raw_value or "").strip()
    if not raw:
        return None, None

    matched = SALVATION_RE.match(raw)
    if not matched:
        return None, raw

    yy = int(matched.group("yy"))
    mm = int(matched.group("mm"))
    dd = int(matched.group("dd"))
    year = 2000 + yy if yy <= 26 else 1900 + yy
    return f"{year:04d}-{mm:02d}-{dd:02d}", raw


def parse_phone(raw_value: str | None) -> str | None:
    raw = str(raw_value or "").strip()
    return raw if PHONE_RE.match(raw) else None


def request_json(
    base_url: str,
    service_role: str,
    method: str,
    resource: str,
    *,
    query: dict[str, str] | None = None,
    body: object | None = None,
) -> object:
    url = f"{base_url}/rest/v1/{resource}"
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"

    headers = {
        "apikey": service_role,
        "Authorization": f"Bearer {service_role}",
        "Accept": "application/json",
    }

    data = None
    if body is not None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = "return=representation"

    request = urllib.request.Request(url, data=data, method=method, headers=headers)

    context = None
    if certifi is not None:
        context = ssl.create_default_context(cafile=certifi.where())

    try:
        with urllib.request.urlopen(request, context=context) as response:
            payload = response.read().decode("utf-8")
            if not payload:
                return None
            return json.loads(payload)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase 요청 실패 ({method} {resource}): {detail}") from exc
    except urllib.error.URLError as exc:
        if isinstance(exc.reason, ssl.SSLCertVerificationError):
            raise RuntimeError(
                "SSL 인증서 검증에 실패했습니다. `python3 -m pip install --user certifi` 후 다시 시도해 주세요."
            ) from exc
        raise RuntimeError(f"Supabase 요청 실패 ({method} {resource}): {exc.reason}") from exc


def fetch_members(base_url: str, service_role: str) -> list[dict[str, object]]:
    response = request_json(
        base_url,
        service_role,
        "GET",
        "members",
        query={
            "select": "id,name,phone,salvation_date",
            "order": "name.asc",
        },
    )
    return list(response or [])


def detect_youth_pages(pdf_path: Path) -> tuple[list[dict[str, object]], list[int]]:
    extracted_rows: list[dict[str, object]] = []
    youth_pages: list[int] = []

    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_index, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            if "청년회" not in text:
                continue

            page_rows = extract_rows_from_page(page_index + 1, page)
            if not page_rows:
                continue

            youth_pages.append(page_index + 1)
            extracted_rows.extend(page_rows)

    return extracted_rows, youth_pages


def extract_rows_from_page(page_number: int, page: pdfplumber.page.Page) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []

    for table in page.extract_tables() or []:
        if not table or len(table) < 2:
            continue

        header = [normalize_header(cell) for cell in table[0]]
        if len(header) < 4:
            continue

        if header[0] != HEADER_NAME or header[1] != HEADER_AREA or header[2] != HEADER_SALVATION or header[3] != HEADER_PHONE:
            continue

        for row in table[1:]:
            if not row or len(row) < 4:
                continue

            raw_name = str(row[0] or "").strip()
            if not raw_name:
                continue

            salvation_date, raw_salvation = parse_salvation_date(row[2])
            phone = parse_phone(row[3])

            rows.append(
                {
                    "page": page_number,
                    "raw_name": raw_name,
                    "normalized_name": normalize_name(raw_name),
                    "raw_salvation": raw_salvation,
                    "salvation_date": salvation_date,
                    "phone": phone,
                }
            )

    return rows


def build_member_index(members: list[dict[str, object]]) -> tuple[dict[str, list[dict[str, object]]], dict[str, list[dict[str, object]]]]:
    exact: dict[str, list[dict[str, object]]] = defaultdict(list)
    normalized: dict[str, list[dict[str, object]]] = defaultdict(list)

    for member in members:
        name = str(member.get("name") or "").strip()
        exact[name].append(member)
        normalized[normalize_name(name)].append(member)

    return exact, normalized


def match_member(
    row: dict[str, object],
    exact_index: dict[str, list[dict[str, object]]],
    normalized_index: dict[str, list[dict[str, object]]],
    *,
    strict_exact_name: bool,
) -> tuple[dict[str, object] | None, str]:
    exact_matches = exact_index.get(str(row["raw_name"]), [])
    if len(exact_matches) == 1:
        return exact_matches[0], "exact"
    if len(exact_matches) > 1:
        return None, "ambiguous_exact"

    if strict_exact_name:
        return None, "missing_exact"

    normalized_matches = normalized_index.get(str(row["normalized_name"]), [])
    if len(normalized_matches) == 1:
        return normalized_matches[0], "normalized"
    if len(normalized_matches) > 1:
        return None, "ambiguous_normalized"
    return None, "missing"


def build_update_plan(
    extracted_rows: list[dict[str, object]],
    members: list[dict[str, object]],
    *,
    strict_exact_name: bool,
) -> dict[str, object]:
    exact_index, normalized_index = build_member_index(members)

    updates: list[dict[str, object]] = []
    skipped_missing_db: list[dict[str, object]] = []
    skipped_ambiguous: list[dict[str, object]] = []
    normalized_matches: list[dict[str, object]] = []
    skipped_non_exact_salvation: list[dict[str, object]] = []

    for row in extracted_rows:
        member, match_type = match_member(
            row,
            exact_index,
            normalized_index,
            strict_exact_name=strict_exact_name,
        )

        if member is None:
            target = skipped_ambiguous if match_type.startswith("ambiguous") else skipped_missing_db
            target.append(
                {
                    "page": row["page"],
                    "raw_name": row["raw_name"],
                    "phone": row["phone"],
                    "raw_salvation": row["raw_salvation"],
                    "reason": match_type,
                }
            )
            continue

        if match_type == "normalized":
            normalized_matches.append(
                {
                    "page": row["page"],
                    "raw_name": row["raw_name"],
                    "db_name": member["name"],
                }
            )

        payload: dict[str, object] = {}
        if row["phone"]:
            payload["phone"] = row["phone"]
        if row["salvation_date"]:
            payload["salvation_date"] = row["salvation_date"]
        elif row["raw_salvation"]:
            skipped_non_exact_salvation.append(
                {
                    "page": row["page"],
                    "raw_name": row["raw_name"],
                    "db_name": member["name"],
                    "raw_salvation": row["raw_salvation"],
                }
            )

        if not payload:
            continue

        current_phone = member.get("phone")
        current_salvation = member.get("salvation_date")
        phone_changed = payload.get("phone") != current_phone if "phone" in payload else False
        salvation_changed = (
            payload.get("salvation_date") != current_salvation if "salvation_date" in payload else False
        )

        if not phone_changed and not salvation_changed:
            continue

        updates.append(
            {
                "id": member["id"],
                "name": member["name"],
                "page": row["page"],
                "match_type": match_type,
                "payload": payload,
                "before": {
                    "phone": current_phone,
                    "salvation_date": current_salvation,
                },
            }
        )

    return {
        "updates": updates,
        "skipped_missing_db": skipped_missing_db,
        "skipped_ambiguous": skipped_ambiguous,
        "normalized_matches": normalized_matches,
        "skipped_non_exact_salvation": skipped_non_exact_salvation,
    }


def apply_updates(base_url: str, service_role: str, updates: list[dict[str, object]]) -> None:
    for item in updates:
        request_json(
            base_url,
            service_role,
            "PATCH",
            "members",
            query={"id": f"eq.{item['id']}"},
            body=item["payload"],
        )


def write_report(report_path: Path, payload: dict[str, object]) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    pdf_path = Path(args.pdf).expanduser().resolve()
    if not pdf_path.exists():
        raise SystemExit(f"PDF 파일을 찾을 수 없습니다: {pdf_path}")

    base_url, service_role = load_credentials()
    members = fetch_members(base_url, service_role)
    extracted_rows, youth_pages = detect_youth_pages(pdf_path)

    if not youth_pages:
        raise SystemExit("`청년회` 페이지를 찾지 못했습니다. PDF 원문을 확인해 주세요.")

    plan = build_update_plan(
        extracted_rows,
        members,
        strict_exact_name=args.strict_exact_name,
    )

    updates = list(plan["updates"])
    if args.apply:
        apply_updates(base_url, service_role, updates)

    phone_update_count = sum(1 for item in updates if "phone" in item["payload"])
    salvation_update_count = sum(1 for item in updates if "salvation_date" in item["payload"])

    summary = {
        "mode": "apply" if args.apply else "dry-run",
        "pdf_path": str(pdf_path),
        "youth_pages": youth_pages,
        "detected_youth_page_count": len(youth_pages),
        "extracted_rows": len(extracted_rows),
        "matched_update_count": len(updates),
        "phone_update_count": phone_update_count,
        "salvation_update_count": salvation_update_count,
        "skipped_missing_db_count": len(plan["skipped_missing_db"]),
        "skipped_ambiguous_count": len(plan["skipped_ambiguous"]),
        "normalized_match_count": len(plan["normalized_matches"]),
        "skipped_non_exact_salvation_count": len(plan["skipped_non_exact_salvation"]),
        "strict_exact_name": bool(args.strict_exact_name),
    }

    payload = {
        "summary": summary,
        "normalized_matches": plan["normalized_matches"],
        "skipped_missing_db": plan["skipped_missing_db"],
        "skipped_ambiguous": plan["skipped_ambiguous"],
        "skipped_non_exact_salvation": plan["skipped_non_exact_salvation"],
        "updates": updates,
    }

    if args.report:
        write_report(Path(args.report).expanduser().resolve(), payload)

    print("YOUTH_DIRECTORY_UPDATE_RESULT")
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if plan["normalized_matches"]:
        print("normalized_matches_sample")
        print(json.dumps(plan["normalized_matches"][:10], ensure_ascii=False, indent=2))

    if plan["skipped_missing_db"]:
        print("skipped_missing_db_sample")
        print(json.dumps(plan["skipped_missing_db"][:10], ensure_ascii=False, indent=2))

    if plan["skipped_non_exact_salvation"]:
        print("skipped_non_exact_salvation_sample")
        print(json.dumps(plan["skipped_non_exact_salvation"][:10], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("중단되었습니다.", file=sys.stderr)
        sys.exit(130)

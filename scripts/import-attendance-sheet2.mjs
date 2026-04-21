import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const XLSX_PATH = path.join(ROOT, "member.xlsx");
const ENV_LOCAL = path.join(ROOT, ".env.local");
const ENV_RTF = path.join(ROOT, ".env.rtf");
const TARGET_MEETING_TYPE = "청년회 모임";

function parseEnvText(text) {
  const out = {};
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line) continue;

    const normalized = line.startsWith("#") ? line.slice(1).trim() : line;
    const idx = normalized.indexOf("=");
    if (idx <= 0) continue;

    const key = normalized.slice(0, idx).trim();
    const value = normalized.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function loadCredentials() {
  let env = {};
  if (fs.existsSync(ENV_LOCAL)) {
    env = { ...env, ...parseEnvText(fs.readFileSync(ENV_LOCAL, "utf8")) };
  }
  if ((!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) && fs.existsSync(ENV_RTF)) {
    env = { ...env, ...parseEnvText(fs.readFileSync(ENV_RTF, "utf8")) };
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) {
    throw new Error("Supabase 연결값(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)을 찾지 못했습니다.");
  }
  return { url, serviceKey };
}

function toDateText(value) {
  const toLocalDateText = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toLocalDateText(value);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed?.y) {
      const dt = new Date(Date.UTC(parsed.y, (parsed.m ?? 1) - 1, parsed.d ?? 1));
      return toLocalDateText(dt);
    }
  }

  const asText = String(value ?? "").trim();
  if (!asText) return "";
  const parsed = new Date(asText);
  if (Number.isNaN(parsed.getTime())) return "";
  return toLocalDateText(parsed);
}

function normalizeCode(value) {
  return String(value ?? "")
    .replace(/\\/g, "")
    .trim();
}

function mapAttendance(code) {
  if (!code) {
    return { status: "결석", note: null };
  }

  const upper = code.toUpperCase();

  if (upper === "A") {
    return { status: "정상출석", note: null };
  }
  if (upper === "Q") {
    return { status: "지각", note: null };
  }
  if (code === "집회") {
    return { status: "행사", note: "집회" };
  }
  if (code === "집호") {
    return { status: "행사", note: "집회" };
  }
  if (code === "행사") {
    return { status: "행사", note: "행사" };
  }

  // 기타 값은 행사로 보존하고 원본 코드를 비고에 남긴다.
  return { status: "행사", note: code };
}

function makeMemberKey(name, gender) {
  return `${name}||${gender}`;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`파일이 없습니다: ${XLSX_PATH}`);
  }

  const { url, serviceKey } = loadCredentials();
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const workbook = XLSX.readFile(XLSX_PATH, { cellDates: true });
  if (workbook.SheetNames.length < 2) {
    throw new Error("2번째 시트를 찾지 못했습니다.");
  }

  const sheetName = workbook.SheetNames[1];
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet["!ref"]);

  // row 1 headers: A=name, B=gender, C..=dates
  const dateColumns = [];
  for (let c = 2; c <= range.e.c; c += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    const dateText = toDateText(cell?.v ?? null);
    if (dateText) {
      dateColumns.push({ c, dateText });
    }
  }

  if (dateColumns.length === 0) {
    throw new Error("2번째 시트에서 날짜 컬럼을 찾지 못했습니다.");
  }

  const { data: meetingType, error: meetingTypeError } = await supabase
    .from("meeting_types")
    .upsert(
      {
        name: TARGET_MEETING_TYPE,
        is_active: true,
      },
      { onConflict: "name" },
    )
    .select("id,name")
    .single();

  if (meetingTypeError || !meetingType) {
    throw new Error(`모임 종류 생성/조회 실패: ${meetingTypeError?.message}`);
  }

  const { data: adminUser } = await supabase
    .from("users")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const checkedBy = adminUser?.id ?? null;

  const { data: existingMeetings } = await supabase
    .from("meetings")
    .select("id")
    .eq("meeting_type_id", meetingType.id);

  if ((existingMeetings?.length ?? 0) > 0) {
    const existingMeetingIds = existingMeetings.map((meeting) => meeting.id);
    const { error: deleteAttendanceError } = await supabase
      .from("attendance_records")
      .delete()
      .in("meeting_id", existingMeetingIds);

    if (deleteAttendanceError) {
      throw new Error(`기존 출석 삭제 실패: ${deleteAttendanceError.message}`);
    }

    const { error: deleteMeetingError } = await supabase
      .from("meetings")
      .delete()
      .eq("meeting_type_id", meetingType.id);

    if (deleteMeetingError) {
      throw new Error(`기존 모임 삭제 실패: ${deleteMeetingError.message}`);
    }
  }

  const meetingRows = dateColumns.map((it) => ({
    meeting_type_id: meetingType.id,
    meeting_date: it.dateText,
    title: `${TARGET_MEETING_TYPE} (${it.dateText})`,
    created_by: checkedBy,
  }));

  const { error: meetingUpsertError } = await supabase
    .from("meetings")
    .upsert(meetingRows, { onConflict: "meeting_type_id,meeting_date" });

  if (meetingUpsertError) {
    throw new Error(`모임 생성/갱신 실패: ${meetingUpsertError.message}`);
  }

  const { data: meetings, error: meetingsError } = await supabase
    .from("meetings")
    .select("id,meeting_date")
    .eq("meeting_type_id", meetingType.id)
    .in(
      "meeting_date",
      dateColumns.map((it) => it.dateText),
    );

  if (meetingsError) {
    throw new Error(`모임 조회 실패: ${meetingsError.message}`);
  }

  const meetingByDate = new Map((meetings ?? []).map((m) => [m.meeting_date, m.id]));

  const { data: members, error: membersError } = await supabase
    .from("members")
    .select("id,name,gender")
    .eq("is_active", true);

  if (membersError) {
    throw new Error(`활성 멤버 조회 실패: ${membersError.message}`);
  }

  const memberMap = new Map();
  const duplicateMemberKeys = new Set();

  for (const m of members ?? []) {
    const key = makeMemberKey(m.name, m.gender);
    if (memberMap.has(key)) {
      duplicateMemberKeys.add(key);
      continue;
    }
    memberMap.set(key, m.id);
  }

  const attendanceRows = [];
  const missingMembers = [];
  let blankAsAbsentCount = 0;
  let customEventCodeCount = 0;
  let sourceCells = 0;

  for (let r = 1; r <= range.e.r; r += 1) {
    const nameCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    const genderCell = sheet[XLSX.utils.encode_cell({ r, c: 1 })];
    const name = String(nameCell?.v ?? "").trim();
    const gender = String(genderCell?.v ?? "").trim();

    if (!name || !gender) continue;

    const memberId = memberMap.get(makeMemberKey(name, gender));
    if (!memberId) {
      missingMembers.push(`${name}(${gender})`);
      continue;
    }

    for (const { c, dateText } of dateColumns) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      const code = normalizeCode(cell?.v ?? null);

      sourceCells += 1;
      const mapped = mapAttendance(code);
      if (!code) {
        blankAsAbsentCount += 1;
      } else if (!["A", "Q", "집회", "집호", "행사"].includes(code.toUpperCase())) {
        customEventCodeCount += 1;
      }

      const meetingId = meetingByDate.get(dateText);
      if (!meetingId) continue;

      attendanceRows.push({
        meeting_id: meetingId,
        member_id: memberId,
        status: mapped.status,
        note: mapped.note,
        checked_by: checkedBy,
        checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  for (const batch of chunk(attendanceRows, 500)) {
    const { error } = await supabase
      .from("attendance_records")
      .upsert(batch, { onConflict: "meeting_id,member_id" });

    if (error) {
      throw new Error(`출석 upsert 실패: ${error.message}`);
    }
  }

  console.log("ATTENDANCE_IMPORT_RESULT");
  console.log(`sheet_name=${sheetName}`);
  console.log(`meeting_type=${TARGET_MEETING_TYPE}`);
  console.log(`meeting_dates=${dateColumns.length}`);
  console.log(`source_marked_cells=${sourceCells}`);
  console.log(`attendance_upserted=${attendanceRows.length}`);
  console.log(`blank_cells_treated_as_absent=${blankAsAbsentCount}`);
  console.log(`custom_codes_treated_as_event=${customEventCodeCount}`);
  console.log(`missing_members=${missingMembers.length}`);
  console.log(`duplicate_member_keys=${duplicateMemberKeys.size}`);

  if (missingMembers.length > 0) {
    console.log(`missing_members_sample=${missingMembers.slice(0, 10).join(",")}`);
  }
}

main().catch((err) => {
  console.error("ATTENDANCE_IMPORT_FAILED");
  console.error(err.message);
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const XLSX_PATH = path.join(ROOT, "member.xlsx");
const ENV_LOCAL = path.join(ROOT, ".env.local");
const TARGET_MEETING_TYPE = "청년회 모임";

function parseEnvText(text) {
  const out = {};
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line) continue;
    const normalized = line.startsWith("#") ? line.slice(1).trim() : line;
    const idx = normalized.indexOf("=");
    if (idx <= 0) continue;
    out[normalized.slice(0, idx).trim()] = normalized.slice(idx + 1).trim();
  }
  return out;
}

function loadCredentials() {
  const env = parseEnvText(fs.readFileSync(ENV_LOCAL, "utf8"));
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    key: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function toDateText(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return "";
}

function normalizeCode(value) {
  return String(value ?? "")
    .replace(/\\/g, "")
    .trim();
}

function mapExpected(code) {
  if (!code) return { status: "결석", note: null };
  if (code.toUpperCase() === "A") return { status: "정상출석", note: null };
  if (code.toUpperCase() === "Q") return { status: "지각", note: null };
  if (code === "집회" || code === "집호") return { status: "행사", note: "집회" };
  if (code === "행사") return { status: "행사", note: "행사" };
  return { status: "행사", note: code };
}

function key(name, gender) {
  return `${name}||${gender}`;
}

async function main() {
  const { url, key: serviceKey } = loadCredentials();
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const workbook = XLSX.readFile(XLSX_PATH, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[1]];
  const range = XLSX.utils.decode_range(sheet["!ref"]);

  const dates = [];
  for (let c = 2; c <= range.e.c; c += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    const dt = toDateText(cell?.v ?? null);
    if (dt) dates.push({ c, dt });
  }

  const { data: meetingType } = await supabase
    .from("meeting_types")
    .select("id")
    .eq("name", TARGET_MEETING_TYPE)
    .single();

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id,meeting_date")
    .eq("meeting_type_id", meetingType.id);

  const meetingIdByDate = new Map((meetings ?? []).map((m) => [m.meeting_date, m.id]));

  const { data: members } = await supabase
    .from("members")
    .select("id,name,gender")
    .eq("is_active", true);

  const memberIdByKey = new Map((members ?? []).map((m) => [key(m.name, m.gender), m.id]));

  const records = [];
  for (const meetingId of meetingIdByDate.values()) {
    const { data: partial } = await supabase
      .from("attendance_records")
      .select("meeting_id,member_id,status,note")
      .eq("meeting_id", meetingId);
    records.push(...(partial ?? []));
  }

  const recordMap = new Map(records.map((r) => [`${r.member_id}||${r.meeting_id}`, r]));

  let checked = 0;
  let missing = 0;
  let mismatch = 0;
  const samples = [];

  for (let r = 1; r <= range.e.r; r += 1) {
    const name = String(sheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v ?? "").trim();
    const gender = String(sheet[XLSX.utils.encode_cell({ r, c: 1 })]?.v ?? "").trim();
    if (!name || !gender) continue;

    const memberId = memberIdByKey.get(key(name, gender));
    if (!memberId) continue;

    for (const { c, dt } of dates) {
      const expected = mapExpected(normalizeCode(sheet[XLSX.utils.encode_cell({ r, c })]?.v ?? null));
      const meetingId = meetingIdByDate.get(dt);
      if (!meetingId) continue;

      checked += 1;
      const found = recordMap.get(`${memberId}||${meetingId}`);
      if (!found) {
        missing += 1;
        if (samples.length < 10) {
          samples.push(`missing:${name}:${dt}:${expected.status}`);
        }
        continue;
      }

      const sameStatus = found.status === expected.status;
      const foundNote = found.note ?? null;
      const expectedNote = expected.note ?? null;
      const sameNote = foundNote === expectedNote;

      if (!sameStatus || !sameNote) {
        mismatch += 1;
        if (samples.length < 10) {
          samples.push(
            `mismatch:${name}:${dt}:db=${found.status}/${foundNote ?? "-"}:xlsx=${expected.status}/${expectedNote ?? "-"}`,
          );
        }
      }
    }
  }

  console.log("ATTENDANCE_VERIFY_RESULT");
  console.log(`checked=${checked}`);
  console.log(`missing=${missing}`);
  console.log(`mismatch=${mismatch}`);
  console.log(`ok=${checked - missing - mismatch}`);
  if (samples.length > 0) {
    console.log(`samples=${samples.join(" | ")}`);
  }
}

main().catch((err) => {
  console.error("ATTENDANCE_VERIFY_FAILED");
  console.error(err.message);
  process.exit(1);
});

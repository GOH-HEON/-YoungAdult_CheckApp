import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const ROOT = process.cwd();
const XLSX_PATH = path.join(ROOT, "member.xlsx");
const ENV_LOCAL = path.join(ROOT, ".env.local");
const ENV_RTF = path.join(ROOT, ".env.rtf");
const DEFAULT_BIRTH_YEAR = 1900;

function parseEnvText(text) {
  const lines = text.split(/\r?\n/);
  const map = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const normalized = line.startsWith("#") ? line.slice(1).trim() : line;
    const idx = normalized.indexOf("=");
    if (idx <= 0) continue;

    const key = normalized.slice(0, idx).trim();
    const value = normalized.slice(idx + 1).trim();

    if (key) {
      map[key] = value;
    }
  }

  return map;
}

function loadCredentials() {
  let env = {};

  if (fs.existsSync(ENV_LOCAL)) {
    env = {
      ...env,
      ...parseEnvText(fs.readFileSync(ENV_LOCAL, "utf8")),
    };
  }

  // fallback only when .env.local does not have required keys
  if (
    fs.existsSync(ENV_RTF) &&
    (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    env = {
      ...env,
      ...parseEnvText(fs.readFileSync(ENV_RTF, "utf8")),
    };
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !serviceRole) {
    throw new Error("Supabase URL 또는 service role key를 찾지 못했습니다 (.env.local 또는 .env.rtf).");
  }

  return { url, serviceRole };
}

function normalizeGender(raw) {
  const value = String(raw ?? "").trim();
  if (["형제", "남", "남자", "M", "male", "Male"].includes(value)) return "형제";
  if (["자매", "여", "여자", "F", "female", "Female"].includes(value)) return "자매";
  return value;
}

function normalizeBirthYear(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { value: DEFAULT_BIRTH_YEAR, fallback: true };
  }

  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) {
    return { value: DEFAULT_BIRTH_YEAR, fallback: true };
  }

  return { value: n, fallback: false };
}

function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/[^0-9-]/g, "").trim();
  return cleaned || null;
}

function normalizeDate(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }

  const text = String(raw).trim();
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) {
    out.push(array.slice(i, i + size));
  }
  return out;
}

async function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`엑셀 파일 없음: ${XLSX_PATH}`);
  }

  const { url, serviceRole } = loadCredentials();
  const supabase = createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const workbook = XLSX.readFile(XLSX_PATH, { cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const totalRows = rows.length;
  if (totalRows === 0) {
    console.log("IMPORT_RESULT");
    console.log("total_excel_rows=0");
    console.log("members_inserted=0");
    return;
  }

  const teamSet = new Set();
  for (const row of rows) {
    const team = String(row.team ?? "").trim();
    if (team) teamSet.add(team);
  }

  const teams = Array.from(teamSet).sort();
  if (teams.length > 0) {
    const { error } = await supabase
      .from("departments")
      .upsert(
        teams.map((name) => ({ name, is_active: true })),
        { onConflict: "name" },
      );

    if (error) {
      throw new Error(`departments upsert 실패: ${error.message}`);
    }
  }

  const { data: departments, error: depError } = await supabase
    .from("departments")
    .select("id,name");

  if (depError) {
    throw new Error(`departments 조회 실패: ${depError.message}`);
  }

  const depMap = new Map((departments ?? []).map((d) => [d.name, d.id]));

  const { data: existingMembers, error: existingError } = await supabase
    .from("members")
    .select("name,gender,birth_year,phone,department_id");

  if (existingError) {
    throw new Error(`기존 members 조회 실패: ${existingError.message}`);
  }

  const existingKeys = new Set();
  for (const m of existingMembers ?? []) {
    existingKeys.add(
      [m.name ?? "", m.gender ?? "", String(m.birth_year ?? DEFAULT_BIRTH_YEAR), m.phone ?? "", String(m.department_id ?? "")].join("||"),
    );
  }

  const inserts = [];
  let skipped = 0;
  let invalid = 0;
  let birthYearFallback = 0;

  for (const row of rows) {
    const name = String(row.name ?? "").trim();
    const gender = normalizeGender(row.gender);
    const team = String(row.team ?? "").trim();
    const departmentId = depMap.get(team);
    const birth = normalizeBirthYear(row.birth_year);
    if (birth.fallback) birthYearFallback += 1;

    if (!name || !departmentId || !["형제", "자매"].includes(gender)) {
      invalid += 1;
      continue;
    }

    const phone = normalizePhone(row.phone);
    const key = [name, gender, String(birth.value), phone ?? "", String(departmentId)].join("||");
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }

    inserts.push({
      name,
      gender,
      birth_year: birth.value,
      salvation_date: normalizeDate(row.salvation_date),
      phone,
      department_id: departmentId,
      is_active: true,
      is_newcomer: false,
    });
    existingKeys.add(key);
  }

  let inserted = 0;
  for (const batch of chunk(inserts, 100)) {
    const { data, error } = await supabase.from("members").insert(batch).select("id");
    if (error) {
      throw new Error(`members insert 실패: ${error.message}`);
    }
    inserted += data?.length ?? batch.length;
  }

  console.log("IMPORT_RESULT");
  console.log(`sheet_name=${firstSheetName}`);
  console.log(`total_excel_rows=${totalRows}`);
  console.log(`departments_upserted=${teams.length}`);
  console.log(`members_inserted=${inserted}`);
  console.log(`rows_skipped_duplicate=${skipped}`);
  console.log(`rows_invalid=${invalid}`);
  console.log(`birth_year_fallback_applied=${birthYearFallback}`);
  console.log(`default_birth_year=${DEFAULT_BIRTH_YEAR}`);
}

main().catch((err) => {
  console.error("IMPORT_FAILED");
  console.error(err.message);
  process.exit(1);
});

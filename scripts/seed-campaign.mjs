// 목표대비 달성: 캠페인 1건 + 명단(Sheet1) 접수/참여 행 시드.
// 사용법:
//   node scripts/seed-campaign.mjs "/절대경로/청년회_모임_2026-07-09_명단.xlsx"
// 전제: 마이그레이션 08(테이블/RLS)이 이미 적용되어 있어야 한다.
// 명단(개인정보)은 외부 경로에서만 읽으며 리포지토리에 커밋하지 않는다.

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

const ROOT = process.cwd();
const ENV_LOCAL = path.join(ROOT, ".env.local");
const ENV_RTF = path.join(ROOT, ".env.rtf");

const CAMPAIGN = {
  name: "2026 하계 전도캠페인",
  description: "청년회 여름 전도",
  start_date: "2026-07-01",
  end_date: "2026-08-31",
  goal_registration: 155,
  goal_participation: 155,
  goal_evangelism: 45,
  goal_invitation: 150,
  is_active: true,
};

function parseEnvText(text) {
  const map = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const normalized = line.startsWith("#") ? line.slice(1).trim() : line;
    const idx = normalized.indexOf("=");
    if (idx <= 0) continue;
    map[normalized.slice(0, idx).trim()] = normalized.slice(idx + 1).trim();
  }
  return map;
}

function loadCredentials() {
  let env = {};
  if (fs.existsSync(ENV_LOCAL)) env = { ...env, ...parseEnvText(fs.readFileSync(ENV_LOCAL, "utf8")) };
  if (fs.existsSync(ENV_RTF) && (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)) {
    env = { ...env, ...parseEnvText(fs.readFileSync(ENV_RTF, "utf8")) };
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 찾지 못했습니다.");
  return { url, key };
}

function readRoster(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets["Sheet1"];
  if (!ws) throw new Error("'Sheet1' 시트를 찾지 못했습니다.");
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
  // 헤더: 이름, 성별, 소속부서
  return rows
    .slice(1)
    .filter((r) => r[0] && String(r[0]).trim())
    .map((r) => ({ name: String(r[0]).trim(), gender: String(r[1] ?? "").trim(), dept: String(r[2] ?? "").trim() }));
}

async function main() {
  const xlsxPath = process.argv[2];
  if (!xlsxPath || !fs.existsSync(xlsxPath)) {
    throw new Error("명단 xlsx 경로를 인자로 전달하세요: node scripts/seed-campaign.mjs <경로>");
  }

  const { url, key } = loadCredentials();
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const roster = readRoster(xlsxPath);
  console.log(`명단 ${roster.length}명 로드`);

  // 부서 이름 → id
  const { data: depts, error: deptErr } = await supabase.from("departments").select("id, name");
  if (deptErr) throw deptErr;
  const deptId = new Map(depts.map((d) => [d.name, d.id]));

  // 멤버 (이름+부서id) → member.id
  const { data: members, error: memErr } = await supabase
    .from("members")
    .select("id, name, department_id, is_active");
  if (memErr) throw memErr;
  const memberKey = new Map();
  for (const m of members) memberKey.set(`${m.name}||${m.department_id}`, m.id);

  const matched = [];
  const missing = [];
  for (const person of roster) {
    const did = deptId.get(person.dept);
    const mid = did ? memberKey.get(`${person.name}||${did}`) : undefined;
    if (mid) matched.push(mid);
    else missing.push(person);
  }
  console.log(`매칭 ${matched.length}명 / 미매칭 ${missing.length}명`);
  if (missing.length) console.log("미매칭:", missing.map((p) => `${p.name}(${p.dept})`).join(", "));

  // 캠페인 1건 (이미 있으면 재사용)
  let campaignId;
  const { data: existing } = await supabase
    .from("campaigns")
    .select("id")
    .eq("name", CAMPAIGN.name)
    .maybeSingle();
  if (existing?.id) {
    campaignId = existing.id;
    await supabase.from("campaigns").update(CAMPAIGN).eq("id", campaignId);
    console.log("기존 캠페인 재사용:", campaignId);
  } else {
    const { data: created, error: createErr } = await supabase
      .from("campaigns")
      .insert(CAMPAIGN)
      .select("id")
      .single();
    if (createErr) throw createErr;
    campaignId = created.id;
    console.log("캠페인 생성:", campaignId);
  }

  // 참여자 시드 (중복은 무시)
  const rows = matched.map((member_id) => ({ campaign_id: campaignId, member_id }));
  const { error: seedErr } = await supabase
    .from("campaign_participants")
    .upsert(rows, { onConflict: "campaign_id,member_id", ignoreDuplicates: true });
  if (seedErr) throw seedErr;
  console.log(`campaign_participants ${rows.length}행 시드 완료`);
}

main().catch((err) => {
  console.error("시드 실패:", err.message);
  process.exit(1);
});

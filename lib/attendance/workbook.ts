import * as XLSX from "xlsx";
import { ATTENDANCE_STATUS_OPTIONS, type AttendanceStatus } from "@/lib/constants/domain";

export type AttendanceWorkbookMember = {
  id: string;
  name: string;
  gender: "형제" | "자매";
  departmentName: string;
};

export type AttendanceWorkbookRecord = {
  member_id: string;
  status: AttendanceStatus;
  note: string | null;
};

export type AttendanceWorkbookMeta = {
  meetingTypeId?: number;
  meetingTypeName?: string;
  meetingDate: string;
};

export type ParsedAttendanceWorkbook = {
  meta: AttendanceWorkbookMeta;
  rows: Array<{
    memberId: string;
    status: AttendanceStatus | "";
    note: string;
  }>;
};

const SHEET_NAME = "출석명단";
const META_SHEET_NAME = "_meta";
const HEADER_ROW_INDEX = 3;
const DATA_START_ROW_INDEX = 4;

function statusGuideText() {
  return `상태는 ${ATTENDANCE_STATUS_OPTIONS.join(", ")} 중 하나만 입력하세요. 비워두면 미기록으로 처리됩니다.`;
}

export function buildAttendanceWorkbook({
  meta,
  members,
  existingRecords,
}: {
  meta: AttendanceWorkbookMeta;
  members: AttendanceWorkbookMember[];
  existingRecords: AttendanceWorkbookRecord[];
}) {
  const recordByMemberId = new Map(existingRecords.map((record) => [record.member_id, record]));

  const rows = [
    [`출석 명단 · ${meta.meetingTypeName ?? `모임 ID ${meta.meetingTypeId ?? "-"}`}`],
    [`날짜: ${meta.meetingDate}`],
    [statusGuideText()],
    ["member_id", "이름", "성별", "소속부서", "상태", "비고"],
    ...members.map((member) => {
      const record = recordByMemberId.get(member.id);
      return [
        member.id,
        member.name,
        member.gender,
        member.departmentName,
        record?.status ?? "",
        record?.note ?? "",
      ];
    }),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { hidden: true },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
  ];
  sheet["!freeze"] = { xSplit: 0, ySplit: DATA_START_ROW_INDEX };

  const metaSheet = XLSX.utils.aoa_to_sheet([
    ["meetingTypeId", meta.meetingTypeId ?? ""],
    ["meetingTypeName", meta.meetingTypeName ?? ""],
    ["meetingDate", meta.meetingDate],
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
  XLSX.utils.book_append_sheet(workbook, metaSheet, META_SHEET_NAME);
  workbook.Workbook = {
    Sheets: [
      { name: SHEET_NAME, Hidden: 0 },
      { name: META_SHEET_NAME, Hidden: 1 },
    ],
  };

  return workbook;
}

function readCell(sheet: XLSX.WorkSheet, row: number, col: number) {
  const address = XLSX.utils.encode_cell({ r: row, c: col });
  return String(sheet[address]?.v ?? "").trim();
}

function parseMeta(workbook: XLSX.WorkBook): AttendanceWorkbookMeta {
  const metaSheet = workbook.Sheets[META_SHEET_NAME];
  if (!metaSheet) {
    return {
      meetingDate: "",
    };
  }

  const metaRows = XLSX.utils.sheet_to_json<(string | number)[]>(metaSheet, {
    header: 1,
    raw: false,
    defval: "",
  });
  const metaMap = new Map(metaRows.map((row) => [String(row[0] ?? ""), String(row[1] ?? "")]));
  const meetingDate = metaMap.get("meetingDate")?.trim() ?? "";
  const meetingTypeName = metaMap.get("meetingTypeName")?.trim() ?? "";
  const meetingTypeIdRaw = metaMap.get("meetingTypeId")?.trim() ?? "";
  const parsedMeetingTypeId = Number.parseInt(meetingTypeIdRaw, 10);

  return {
    meetingDate,
    meetingTypeName: meetingTypeName || undefined,
    meetingTypeId: Number.isNaN(parsedMeetingTypeId) ? undefined : parsedMeetingTypeId,
  };
}

export function parseAttendanceWorkbook(buffer: ArrayBuffer): ParsedAttendanceWorkbook {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    throw new Error(`엑셀에서 \`${SHEET_NAME}\` 시트를 찾지 못했습니다.`);
  }

  const headerMemberId = readCell(sheet, HEADER_ROW_INDEX, 0);
  const headerName = readCell(sheet, HEADER_ROW_INDEX, 1);
  const headerStatus = readCell(sheet, HEADER_ROW_INDEX, 4);
  if (headerMemberId !== "member_id" || headerName !== "이름" || headerStatus !== "상태") {
    throw new Error("엑셀 형식이 올바르지 않습니다. Export 한 템플릿 파일을 사용해 주세요.");
  }

  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const rows: ParsedAttendanceWorkbook["rows"] = [];

  for (let rowIndex = DATA_START_ROW_INDEX; rowIndex <= range.e.r; rowIndex += 1) {
    const memberId = readCell(sheet, rowIndex, 0);
    const statusText = readCell(sheet, rowIndex, 4);
    const note = readCell(sheet, rowIndex, 5);
    if (!memberId) {
      continue;
    }

    const status = ATTENDANCE_STATUS_OPTIONS.includes(statusText as AttendanceStatus)
      ? (statusText as AttendanceStatus)
      : "";

    rows.push({
      memberId,
      status,
      note,
    });
  }

  return {
    meta: parseMeta(workbook),
    rows,
  };
}

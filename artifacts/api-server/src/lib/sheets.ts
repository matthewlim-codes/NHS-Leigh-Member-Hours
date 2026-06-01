import { ReplitConnectors } from "@replit/connectors-sdk";

// --- SPREADSHEET CONFIG ------------------------------------------------------
// To connect a different Google Sheet, update SPREADSHEET_ID and MEMBER_SHEET_TABS below.
// SPREADSHEET_ID: the long ID in the spreadsheet URL between /d/ and /edit
// MEMBER_SHEET_TABS: the exact tab names containing member names and hours
const SPREADSHEET_ID = "1NAfPUYygYC_AuIVHrguiGO_7sixenv3P2JREIawRKrk";
const MEMBER_SHEET_TABS = ["11/12", "10"];
// ----------------------------------------------------------------------------

const NAME_HEADER = "name";
const STUDENT_ID_HEADER = "student id";
const HOURS_HEADER = "total hours";
const HEADER_SCAN_ROW_COUNT = 5;

export interface SheetMember {
  studentId: string;
  username: string;
  displayName: string;
  hours: number;
}

export async function getMemberFromSheet(username: string): Promise<SheetMember | null> {
  const members = await listMembersFromSheet();
  const normalizedUsername = normalizeNameForMatching(username.replace(/-/g, " "));

  return members.find((member) => normalizeNameForMatching(member.username.replace(/-/g, " ")) === normalizedUsername) ?? null;
}

export async function listMembersFromSheet(): Promise<SheetMember[]> {
  const connectors = new ReplitConnectors();
  const members: SheetMember[] = [];

  for (const sheetTab of MEMBER_SHEET_TABS) {
    const range = encodeURIComponent(`${quoteSheetName(sheetTab)}!A:ZZ`);
    const response = await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`,
      { method: "GET" }
    );

    const data = await response.json() as { values?: string[][] };
    const rows = data.values ?? [];

    if (rows.length < 2) continue;

    const columns = findMemberColumns(rows);

    if (!columns) continue;

    for (let i = columns.dataStartRow; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length <= columns.nameColumn || row.length <= columns.studentIdColumn) continue;

      const studentId = normalizeStudentId(row[columns.studentIdColumn]);
      const cellName = (row[columns.nameColumn] ?? "").trim();
      if (!studentId || !cellName) continue;

      const rawHours = row[columns.hoursColumn] ?? "0";
      const hours = parseHours(rawHours);
      const displayName = toDisplayName(cellName);
      members.push({
        studentId,
        username: generateUsername(displayName),
        displayName,
        hours,
      });
    }
  }

  return members;
}

export function generateUsername(fullName: string): string {
  return toDisplayName(fullName)
    .trim()
    .replace(/\s+/g, "-");
}

export function generateTempPassword(studentId: string): string {
  return normalizeStudentId(studentId);
}

function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function normalizeHeader(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function findMemberColumns(rows: string[][]): {
  studentIdColumn: number;
  nameColumn: number;
  hoursColumn: number;
  dataStartRow: number;
} | null {
  const studentIdHeader = findHeader(rows, STUDENT_ID_HEADER);
  const nameHeader = findHeader(rows, NAME_HEADER);
  const hoursHeader = findHeader(rows, HOURS_HEADER);

  if (!studentIdHeader || !nameHeader || !hoursHeader) {
    return null;
  }

  return {
    studentIdColumn: studentIdHeader.column,
    nameColumn: nameHeader.column,
    hoursColumn: hoursHeader.column,
    dataStartRow: Math.max(studentIdHeader.row, nameHeader.row, hoursHeader.row) + 1,
  };
}

function findHeader(rows: string[][], headerName: string): { row: number; column: number } | null {
  const rowsToScan = Math.min(rows.length, HEADER_SCAN_ROW_COUNT);

  for (let row = 0; row < rowsToScan; row++) {
    const column = rows[row].findIndex((cell) => normalizeHeader(cell) === headerName);
    if (column !== -1) {
      return { row, column };
    }
  }

  return null;
}

function toDisplayName(fullName: string): string {
  const trimmed = fullName.trim();
  const commaIndex = trimmed.indexOf(",");

  if (commaIndex === -1) {
    return trimmed;
  }

  const lastName = trimmed.slice(0, commaIndex).trim();
  const firstNames = trimmed.slice(commaIndex + 1).trim();

  return [firstNames, lastName].filter(Boolean).join(" ");
}

function normalizeNameForMatching(fullName: string): string {
  return toDisplayName(fullName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseHours(rawHours: string): number {
  const hours = Number.parseFloat(rawHours.replace(/,/g, ""));
  return Number.isFinite(hours) ? hours : 0;
}

function normalizeStudentId(studentId: string | undefined): string {
  return (studentId ?? "").trim();
}

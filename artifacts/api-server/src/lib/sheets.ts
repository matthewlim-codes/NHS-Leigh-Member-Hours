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
const GRADE_HEADER = "grade";
const INFO_FORM_HEADER = "info form";
const CLUB_DUES_HEADER = "club dues";
const HOURS_HEADER = "total hours";
const SEMESTER_1_HEADER = "sem 1 hours";
const HEADER_SCAN_ROW_COUNT = 5;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export interface SheetMember {
  studentId: string;
  username: string;
  displayName: string;
  grade: number;
  infoFormComplete: boolean;
  clubDuesPaid: boolean;
  hours: number;
  semester1Hours: number;
  semester2Hours: number;
  monthlyHours: SheetMonthHours[];
}

export interface SheetMonthHours {
  month: string;
  shortLabel: string;
  hwCenter: string;
  tutorial: string;
  total: number;
  hasData: boolean;
}

interface MemberColumns {
  studentIdColumn: number;
  nameColumn: number;
  gradeColumn: number | null;
  infoFormColumn: number | null;
  clubDuesColumn: number | null;
  hoursColumn: number | null;
  semester1Column: number | null;
  monthColumns: MonthColumns[];
  dataStartRow: number;
}

interface MonthColumns {
  month: string;
  shortLabel: string;
  hwCenterColumn: number;
  tutorialColumn: number;
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

      const hours = parseHours(getCell(row, columns.hoursColumn));
      const semester1Hours = parseHours(getCell(row, columns.semester1Column));
      const displayName = toDisplayName(cellName);

      members.push({
        studentId,
        username: generateUsername(displayName),
        displayName,
        grade: parseGrade(getCell(row, columns.gradeColumn)),
        infoFormComplete: parseCompletion(getCell(row, columns.infoFormColumn)),
        clubDuesPaid: parseCompletion(getCell(row, columns.clubDuesColumn)),
        hours,
        semester1Hours,
        semester2Hours: Math.max(0, hours - semester1Hours),
        monthlyHours: buildMonthlyHours(row, columns.monthColumns),
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

function findMemberColumns(rows: string[][]): MemberColumns | null {
  const studentIdHeader = findHeader(rows, STUDENT_ID_HEADER);
  const nameHeader = findHeader(rows, NAME_HEADER);
  const gradeHeader = findHeader(rows, GRADE_HEADER);
  const infoFormHeader = findHeader(rows, INFO_FORM_HEADER);
  const clubDuesHeader = findHeader(rows, CLUB_DUES_HEADER);
  const hoursHeader = findHeader(rows, HOURS_HEADER);
  const semester1Header = findHeader(rows, SEMESTER_1_HEADER);
  const monthColumns = findMonthColumns(rows);

  if (!studentIdHeader || !nameHeader) {
    return null;
  }

  return {
    studentIdColumn: studentIdHeader.column,
    nameColumn: nameHeader.column,
    gradeColumn: gradeHeader?.column ?? null,
    infoFormColumn: infoFormHeader?.column ?? null,
    clubDuesColumn: clubDuesHeader?.column ?? null,
    hoursColumn: hoursHeader?.column ?? null,
    semester1Column: semester1Header?.column ?? null,
    monthColumns,
    dataStartRow: Math.max(studentIdHeader.row, nameHeader.row) + 1,
  };
}

function findMonthColumns(rows: string[][]): MonthColumns[] {
  return MONTHS.flatMap((month) => {
    const header = findHeader(rows, month);
    if (!header) {
      return [];
    }

    return [{
      month,
      shortLabel: month.slice(0, 3).toUpperCase(),
      hwCenterColumn: header.column,
      tutorialColumn: header.column + 1,
    }];
  });
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

function getCell(row: string[], column: number | null): string {
  if (column === null) return "";
  return row[column] ?? "";
}

function normalizeStudentId(studentId: string | undefined): string {
  return (studentId ?? "").trim();
}

function parseGrade(rawGrade: string | undefined): number {
  const grade = Number.parseInt((rawGrade ?? "").trim(), 10);
  return Number.isFinite(grade) ? grade : 0;
}

function parseCompletion(rawValue: string | undefined): boolean {
  const normalized = (rawValue ?? "").trim().toLowerCase();
  return normalized === "✅" || normalized === "yes" || normalized === "y" || normalized === "true" || normalized === "complete" || normalized === "paid";
}

function buildMonthlyHours(row: string[], monthColumns: MonthColumns[]): SheetMonthHours[] {
  const byMonth = new Map(monthColumns.map((monthColumn) => {
    const hwCenter = formatHourCell(row[monthColumn.hwCenterColumn]);
    const tutorial = formatHourCell(row[monthColumn.tutorialColumn]);

    return [monthColumn.month, {
      month: monthColumn.month,
      shortLabel: monthColumn.shortLabel,
      hwCenter,
      tutorial,
      total: parseHours(hwCenter) + parseHours(tutorial),
      hasData: hasMonthData(hwCenter) || hasMonthData(tutorial),
    }];
  }));

  return MONTHS.map((month) => byMonth.get(month) ?? {
    month,
    shortLabel: month.slice(0, 3).toUpperCase(),
    hwCenter: "0",
    tutorial: "0",
    total: 0,
    hasData: false,
  });
}

function formatHourCell(rawValue: string | undefined): string {
  return (rawValue ?? "").trim() || "0";
}

function hasMonthData(value: string): boolean {
  return value !== "0" && value.length > 0;
}

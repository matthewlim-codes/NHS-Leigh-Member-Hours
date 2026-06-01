import { ReplitConnectors } from "@replit/connectors-sdk";

// --- SPREADSHEET CONFIG ------------------------------------------------------
// To connect a different Google Sheet, update SPREADSHEET_ID and MEMBER_SHEET_TABS below.
// SPREADSHEET_ID: the long ID in the spreadsheet URL between /d/ and /edit
// MEMBER_SHEET_TABS: the exact tab names containing member names and hours
const SPREADSHEET_ID = "1NAfPUYygYC_AuIVHrguiGO_7sixenv3P2JREIawRKrk";
const MEMBER_SHEET_TABS = ["11/12", "10"];
// ----------------------------------------------------------------------------

const NAME_HEADER = "name";
const HOURS_HEADER = "total hours";

export interface SheetMember {
  displayName: string;
  hours: number;
}

export async function getMemberFromSheet(username: string): Promise<SheetMember | null> {
  const connectors = new ReplitConnectors();
  const normalizedUsername = normalizeNameForMatching(username.replace(/-/g, " "));

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

    const headers = rows[0].map((header) => normalizeHeader(header));
    const nameColumn = headers.indexOf(NAME_HEADER);
    const hoursColumn = headers.indexOf(HOURS_HEADER);

    if (nameColumn === -1 || hoursColumn === -1) continue;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length <= nameColumn) continue;

      const cellName = (row[nameColumn] ?? "").trim();
      if (normalizeNameForMatching(cellName) === normalizedUsername) {
        const rawHours = row[hoursColumn] ?? "0";
        const hours = parseHours(rawHours);
        return { displayName: toDisplayName(cellName), hours };
      }
    }
  }

  return null;
}

export function generateUsername(fullName: string): string {
  return toDisplayName(fullName)
    .trim()
    .replace(/\s+/g, "-");
}

export function generateTempPassword(fullName: string): string {
  const parts = toDisplayName(fullName).trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts[parts.length - 1] ?? "";

  const firstLen = firstName.replace(/[^a-zA-Z]/g, "").length;
  const lastLen = lastName.replace(/[^a-zA-Z]/g, "").length;

  const toLetter = (n: number): string => {
    if (n === 0) return "a";
    const idx = ((n - 1) % 26) + 1;
    return String.fromCharCode(96 + idx);
  };

  return `${firstLen}${lastLen}${toLetter(firstLen)}${toLetter(lastLen)}`;
}

function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function normalizeHeader(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
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

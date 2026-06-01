import { ReplitConnectors } from "@replit/connectors-sdk";

const SPREADSHEET_ID = "1NAfPUYygYC_AuIVHrguiGO_7sixenv3P2JREIawRKrk";

export interface SheetMember {
  displayName: string;
  hours: number;
}

export async function getMemberFromSheet(username: string): Promise<SheetMember | null> {
  const connectors = new ReplitConnectors();

  const response = await connectors.proxy(
    "google-sheet",
    `/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet1`,
    { method: "GET" }
  );

  const data = await response.json() as { values?: string[][] };
  const rows = data.values ?? [];

  if (rows.length < 2) return null;

  const displayNameFromUsername = username.replace(/-/g, " ").trim();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 1) continue;

    const cellName = (row[0] ?? "").trim();
    if (cellName.toLowerCase() === displayNameFromUsername.toLowerCase()) {
      const rawHours = row[1] ?? "0";
      const hours = parseFloat(rawHours) || 0;
      return { displayName: cellName, hours };
    }
  }

  return null;
}

export function generateUsername(fullName: string): string {
  return fullName
    .trim()
    .replace(/\s+/g, "-");
}

export function generateTempPassword(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
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

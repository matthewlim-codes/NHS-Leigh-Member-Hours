const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;
const RAG_COLLECTION = "course-materials";
/** Persist full image bytes for high-res tutor preview (Butterbase text column). */
const MAX_INLINE_BASE64_CHARS = 12_000_000;

function getApiKey(): string | undefined {
  return process.env.BUTTERBASE_API_KEY;
}

export interface CourseMaterialRecord {
  id: string;
  filename: string;
  subject?: string | null;
  topic?: string | null;
  teacherInstructions?: string | null;
  preview?: string | null;
  documentId?: string | null;
  storageObjectId?: string | null;
  contentType?: string | null;
  contentBase64?: string | null;
  status: "ingested" | "queued" | "local";
  uploadedBy?: string | null;
  createdAt: string;
}

export interface SessionMaterialPreview {
  id: string;
  filename: string;
  teacherInstructions?: string;
  preview?: string;
  contentType?: string;
  isImage?: boolean;
  /** Absolute or app-relative URL tutors use to load the file */
  fileUrl?: string;
  /** High-res data URL for images when bytes are available inline */
  previewDataUrl?: string;
}

const localMaterials: CourseMaterialRecord[] = [];

function isImageContentType(contentType?: string | null, filename?: string): boolean {
  const type = (contentType ?? "").toLowerCase();
  if (type.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|tiff?|heic|svg)$/i.test(filename ?? "");
}

function guessContentType(filename: string, contentType?: string): string {
  if (contentType && contentType !== "application/octet-stream") return contentType;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
  return contentType || "application/octet-stream";
}

function mapRow(row: Record<string, unknown>): CourseMaterialRecord {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    filename: String(row.filename ?? "worksheet"),
    subject: (row.subject as string | null) ?? null,
    topic: (row.topic as string | null) ?? null,
    teacherInstructions: (row.teacher_instructions as string | null) ?? null,
    preview: (row.preview as string | null) ?? null,
    documentId: (row.document_id as string | null) ?? null,
    storageObjectId: (row.storage_object_id as string | null) ?? null,
    contentType: (row.content_type as string | null) ?? null,
    contentBase64: (row.content_base64 as string | null) ?? null,
    status: (row.status as CourseMaterialRecord["status"]) ?? "local",
    uploadedBy: (row.uploaded_by as string | null) ?? null,
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

async function bbFetch(path: string, init?: RequestInit): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) return null;
  return response.json();
}

export async function listCourseMaterials(filter?: {
  subject?: string;
  topic?: string;
}): Promise<CourseMaterialRecord[]> {
  const rows = await bbFetch(`/course_materials?order=created_at.desc&limit=40`);
  let materials: CourseMaterialRecord[] = [];
  if (Array.isArray(rows)) {
    materials = rows.map((r) => mapRow(r as Record<string, unknown>));
    // Prefer DB rows but keep any in-memory uploads from this process that
    // haven't landed in the table yet.
    for (const local of localMaterials) {
      if (!materials.some((m) => m.id === local.id)) materials.push(local);
    }
  } else {
    materials = [...localMaterials];
  }

  if (filter?.subject) {
    const subject = filter.subject.toLowerCase();
    materials = materials.filter(
      (m) =>
        !m.subject ||
        m.subject.toLowerCase().includes(subject) ||
        subject.includes(m.subject.toLowerCase()),
    );
  }
  if (filter?.topic) {
    const topic = filter.topic.toLowerCase();
    materials = materials.filter((m) => {
      if (!m.topic) return true;
      return m.topic.toLowerCase().includes(topic) || topic.includes(m.topic.toLowerCase());
    });
  }
  return materials;
}

export async function getCourseMaterial(id: string): Promise<CourseMaterialRecord | null> {
  const local = localMaterials.find((m) => m.id === id);
  if (local) return local;
  const row = await bbFetch(`/course_materials?id=eq.${encodeURIComponent(id)}&limit=1`);
  if (Array.isArray(row) && row[0]) return mapRow(row[0] as Record<string, unknown>);
  return null;
}

function toSessionMaterial(m: CourseMaterialRecord): SessionMaterialPreview {
  const contentType = guessContentType(m.filename, m.contentType ?? undefined);
  const image = isImageContentType(contentType, m.filename);
  return {
    id: m.id,
    filename: m.filename,
    teacherInstructions: m.teacherInstructions?.trim() || undefined,
    preview: m.preview?.trim() || undefined,
    contentType,
    isImage: image,
    fileUrl: `/api/tutoros/materials/${m.id}/file`,
  };
}

export async function materialsForSession(input: {
  subject: string;
  topic: string;
}): Promise<SessionMaterialPreview[]> {
  const materials = await listCourseMaterials({
    subject: input.subject,
    topic: input.topic,
  });
  return materials.slice(0, 8).map(toSessionMaterial);
}

export async function getStorageDownloadUrl(
  storageObjectId: string,
): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `https://api.butterbase.ai/storage/${APP_ID}/download/${storageObjectId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { downloadUrl?: string };
    return data.downloadUrl ?? null;
  } catch {
    return null;
  }
}

export async function ingestTeacherMaterial(input: {
  filename: string;
  subject?: string;
  topic?: string;
  teacherInstructions?: string;
  text?: string;
  contentBase64?: string;
  contentType?: string;
  uploadedBy?: string;
}): Promise<CourseMaterialRecord> {
  const filename = input.filename.trim() || "worksheet.pdf";
  const text = input.text?.trim();
  const teacherInstructions = input.teacherInstructions?.trim() || "";
  const contentType = guessContentType(filename, input.contentType);
  if (!text && !input.contentBase64) {
    throw new Error("Provide a worksheet file");
  }

  const apiKey = getApiKey();
  const metadata = {
    source: "teacher-upload",
    ...(input.subject ? { subject: input.subject } : {}),
    ...(input.topic ? { topic: input.topic } : {}),
  };

  let storageObjectId: string | undefined;
  let documentId: string | undefined;
  let status: CourseMaterialRecord["status"] = "local";

  if (apiKey && input.contentBase64) {
    const bytes = Buffer.from(input.contentBase64, "base64");
    try {
      const uploadMeta = await fetch(`https://api.butterbase.ai/storage/${APP_ID}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename,
          contentType,
          sizeBytes: bytes.length,
        }),
      });
      if (uploadMeta.ok) {
        const meta = (await uploadMeta.json()) as {
          uploadUrl?: string;
          objectId?: string;
        };
        if (meta.uploadUrl && meta.objectId) {
          const put = await fetch(meta.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: bytes,
          });
          if (put.ok) storageObjectId = meta.objectId;
        }
      }
    } catch {
      // continue
    }
  }

  if (apiKey) {
    const body: Record<string, unknown> = { filename, metadata };
    if (text) body.text = text;
    else if (storageObjectId) body.storage_object_id = storageObjectId;
    if (teacherInstructions) {
      body.text = [
        text,
        teacherInstructions && `\n\nTeacher instructions for tutors:\n${teacherInstructions}`,
      ]
        .filter(Boolean)
        .join("");
    }

    try {
      const response = await fetch(`${API_BASE}/rag/${RAG_COLLECTION}/documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const data = (await response.json()) as { id?: string; document_id?: string };
        documentId = data.document_id ?? data.id;
        status = documentId ? "ingested" : "queued";
      }
    } catch {
      // local fallback
    }
  }

  const preview =
    teacherInstructions.slice(0, 180) ||
    text?.slice(0, 180) ||
    filename;

  // Keep full-resolution image bytes for tutor preview (high res).
  const shouldInline =
    Boolean(input.contentBase64) &&
    (isImageContentType(contentType, filename) ||
      (input.contentBase64?.length ?? 0) <= MAX_INLINE_BASE64_CHARS);
  const contentBase64 =
    shouldInline && input.contentBase64 && input.contentBase64.length <= MAX_INLINE_BASE64_CHARS
      ? input.contentBase64
      : null;

  const record: CourseMaterialRecord = {
    id: crypto.randomUUID(),
    filename,
    subject: input.subject ?? null,
    topic: input.topic ?? null,
    teacherInstructions: teacherInstructions || null,
    preview,
    documentId: documentId ?? null,
    storageObjectId: storageObjectId ?? null,
    contentType,
    contentBase64,
    status,
    uploadedBy: input.uploadedBy ?? null,
    createdAt: new Date().toISOString(),
  };

  localMaterials.unshift(record);

  await bbFetch(`/course_materials`, {
    method: "POST",
    body: JSON.stringify({
      id: record.id,
      filename: record.filename,
      subject: record.subject,
      topic: record.topic,
      teacher_instructions: record.teacherInstructions,
      preview: record.preview,
      document_id: record.documentId,
      storage_object_id: record.storageObjectId,
      content_type: record.contentType,
      content_base64: record.contentBase64,
      status: record.status,
      uploaded_by: record.uploadedBy,
      created_at: record.createdAt,
    }),
  });

  return record;
}

/** @deprecated use listCourseMaterials */
export function listLocalMaterials(): CourseMaterialRecord[] {
  return [...localMaterials];
}

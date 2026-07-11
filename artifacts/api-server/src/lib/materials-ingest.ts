const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;
const RAG_COLLECTION = "course-materials";

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
  status: "ingested" | "queued" | "local";
  uploadedBy?: string | null;
  createdAt: string;
}

const localMaterials: CourseMaterialRecord[] = [];

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
  const rows = await bbFetch(
    `/course_materials?order=created_at.desc&limit=40`,
  );
  let materials: CourseMaterialRecord[] = [];
  if (Array.isArray(rows)) {
    materials = rows.map((r) => mapRow(r as Record<string, unknown>));
  } else {
    materials = [...localMaterials];
  }

  if (filter?.subject) {
    const subject = filter.subject.toLowerCase();
    materials = materials.filter(
      (m) => !m.subject || m.subject.toLowerCase().includes(subject) || subject.includes(m.subject.toLowerCase()),
    );
  }
  if (filter?.topic) {
    const topic = filter.topic.toLowerCase();
    // Prefer topic matches but keep subject-wide materials when topic is blank on the upload
    materials = materials.filter((m) => {
      if (!m.topic) return true;
      return m.topic.toLowerCase().includes(topic) || topic.includes(m.topic.toLowerCase());
    });
  }
  return materials;
}

export async function materialsForSession(input: {
  subject: string;
  topic: string;
}): Promise<
  Array<{
    id: string;
    filename: string;
    teacherInstructions?: string;
    preview?: string;
  }>
> {
  const materials = await listCourseMaterials({
    subject: input.subject,
    topic: input.topic,
  });
  return materials.slice(0, 8).map((m) => ({
    id: m.id,
    filename: m.filename,
    teacherInstructions: m.teacherInstructions?.trim() || undefined,
    preview: m.preview?.trim() || undefined,
  }));
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
    const contentType = input.contentType || "application/octet-stream";
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

  const record: CourseMaterialRecord = {
    id: crypto.randomUUID(),
    filename,
    subject: input.subject ?? null,
    topic: input.topic ?? null,
    teacherInstructions: teacherInstructions || null,
    preview,
    documentId: documentId ?? null,
    storageObjectId: storageObjectId ?? null,
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

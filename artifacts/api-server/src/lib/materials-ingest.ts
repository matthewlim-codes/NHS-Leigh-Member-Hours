const APP_ID = process.env.BUTTERBASE_APP_ID ?? "app_tsc2mvlq21yo";
const API_BASE = process.env.BUTTERBASE_API_URL ?? `https://api.butterbase.ai/v1/${APP_ID}`;
const RAG_COLLECTION = "course-materials";

function getApiKey(): string | undefined {
  return process.env.BUTTERBASE_API_KEY;
}

export interface UploadedMaterial {
  filename: string;
  documentId?: string;
  storageObjectId?: string;
  status: "ingested" | "queued" | "local";
  preview: string;
}

const localMaterials: UploadedMaterial[] = [];

export function listLocalMaterials(): UploadedMaterial[] {
  return [...localMaterials];
}

export async function ingestTeacherMaterial(input: {
  filename: string;
  subject?: string;
  topic?: string;
  text?: string;
  contentBase64?: string;
  contentType?: string;
}): Promise<UploadedMaterial> {
  const filename = input.filename.trim() || "worksheet.txt";
  const text = input.text?.trim();
  if (!text && !input.contentBase64) {
    throw new Error("Provide worksheet text or a file");
  }

  const apiKey = getApiKey();
  const metadata = {
    source: "teacher-upload",
    ...(input.subject ? { subject: input.subject } : {}),
    ...(input.topic ? { topic: input.topic } : {}),
  };

  let storageObjectId: string | undefined;

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
      // fall through to text ingest / local
    }
  }

  if (apiKey) {
    const body: Record<string, unknown> = {
      filename,
      metadata,
    };
    if (text) body.text = text;
    else if (storageObjectId) body.storage_object_id = storageObjectId;

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
        const material: UploadedMaterial = {
          filename,
          documentId: data.document_id ?? data.id,
          storageObjectId,
          status: "ingested",
          preview: (text ?? filename).slice(0, 180),
        };
        localMaterials.unshift(material);
        return material;
      }
    } catch {
      // local fallback below
    }
  }

  const local: UploadedMaterial = {
    filename,
    storageObjectId,
    status: "local",
    preview: (text ?? filename).slice(0, 180),
  };
  localMaterials.unshift(local);
  return local;
}

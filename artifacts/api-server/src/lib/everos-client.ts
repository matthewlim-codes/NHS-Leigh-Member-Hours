const EVEROS_API_BASE = "https://api.evermind.ai";

export interface EverOSMessage {
  role: "user" | "assistant";
  timestamp: number;
  content: string;
}

export interface EverOSEpisode {
  id?: string;
  summary?: string;
  episode?: string;
  subject?: string;
  timestamp?: string;
}

export interface EverOSProfile {
  profile_data?: {
    explicit_info?: Record<string, unknown>;
    implicit_traits?: Record<string, unknown>;
  };
  scenario?: string;
}

export interface EverOSSearchData {
  episodes?: EverOSEpisode[];
  profiles?: EverOSProfile[];
}

interface EverOSResponse<T> {
  data?: T;
  request_id?: string;
}

function getApiKey(): string {
  const apiKey = process.env.EVEROS_API_KEY;
  if (!apiKey) {
    throw new Error("EVEROS_API_KEY environment variable is required for tutoring memory");
  }
  return apiKey;
}

async function everosRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${EVEROS_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EverOS API ${path} failed (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

export function tuteeUserId(tuteeId: string): string {
  const slug = tuteeId.trim().toLowerCase().replace(/\s+/g, "-");
  return `leigh-nhs-tutee-${slug}`;
}

export async function addMemories(params: {
  userId: string;
  sessionId: string;
  messages: EverOSMessage[];
  asyncMode?: boolean;
}): Promise<EverOSResponse<{ status?: string; task_id?: string }>> {
  return everosRequest("/api/v1/memories", {
    user_id: params.userId,
    session_id: params.sessionId,
    messages: params.messages,
    async_mode: params.asyncMode ?? true,
  });
}

export async function flushMemories(params: {
  userId: string;
  sessionId?: string;
}): Promise<EverOSResponse<{ status?: string }>> {
  return everosRequest("/api/v1/memories/flush", {
    user_id: params.userId,
    ...(params.sessionId ? { session_id: params.sessionId } : {}),
  });
}

export async function searchMemories(params: {
  userId: string;
  query: string;
  method?: "keyword" | "vector" | "hybrid" | "agentic";
  memoryTypes?: string[];
  topK?: number;
}): Promise<EverOSResponse<EverOSSearchData>> {
  return everosRequest("/api/v1/memories/search", {
    filters: { user_id: params.userId },
    query: params.query,
    method: params.method ?? "hybrid",
    memory_types: params.memoryTypes ?? ["episodic_memory", "profile"],
    top_k: params.topK ?? 5,
  });
}

export function isEverOSConfigured(): boolean {
  return Boolean(process.env.EVEROS_API_KEY);
}

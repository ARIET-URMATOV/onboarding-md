export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

async function req<T>(path: string, opts?: RequestInit & { json?: unknown }): Promise<T> {
  const url = `${API_BASE}${path}`;
  const { json, ...rest } = opts ?? {};
  const res = await fetch(url, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const raw = (data as { detail?: unknown } | null)?.detail;
    let message = 'Ошибка сервера';
    if (typeof raw === 'string' && raw.trim()) message = raw;
    else if (Array.isArray(raw)) {
      const msgs = raw
        .map((e) =>
          e && typeof e === 'object' && 'msg' in e ? String((e as { msg: unknown }).msg) : '',
        )
        .filter(Boolean);
      if (msgs.length) message = msgs.join('\n');
    } else if (raw && typeof raw === 'object' && 'msg' in raw) {
      message = String((raw as { msg: unknown }).msg);
    }
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export type Role = 'frontend' | 'backend' | 'design';

export interface MeResponse {
  user: {
    email: string;
    name: string;
    role: Role | null;
    avatar: string | null;
    intro_seen: boolean;
    voice_enabled: boolean;
  };
  progress: {
    done_tasks: Record<string, string[]>;
    xp: number;
    level: number;
    completed_at: string | null;
  };
}

export interface UserResponse {
  email: string;
  name: string;
  role: Role | null;
  avatar: string | null;
  intro_seen: boolean;
  voice_enabled: boolean;
}

export interface ProgressResponse {
  done_tasks: Record<string, string[]>;
  xp: number;
  level: number;
  completed_at: string | null;
}

export const api = {
  get: <T,>(path: string) => req<T>(path),
  post: <T,>(path: string, json?: unknown) => req<T>(path, { method: 'POST', json }),
  patch: <T,>(path: string, json?: unknown) => req<T>(path, { method: 'PATCH', json }),
};

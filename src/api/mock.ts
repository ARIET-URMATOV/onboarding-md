import type { Role } from '../data/stages';

export interface MockUser {
  email: string;
  name: string;
  password: string; // mock-only, never real
}

const STORAGE_KEY = 'onb:users';

const delay = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms));

function loadUsers(): MockUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MockUser[]) : [];
  } catch {
    return [];
  }
}
function saveUsers(users: MockUser[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export interface AuthPayload {
  email: string;
  password: string;
  name?: string;
}

export async function mockRegister(payload: AuthPayload): Promise<{ ok: true; user: { email: string; name: string } } | { ok: false; error: string }> {
  await delay();
  const users = loadUsers();
  if (users.some((u) => u.email.toLowerCase() === payload.email.toLowerCase())) {
    return { ok: false, error: 'Пользователь с такой почтой уже существует' };
  }
  const user: MockUser = {
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    password: payload.password,
  };
  users.push(user);
  saveUsers(users);
  return { ok: true, user: { email: user.email, name: user.name } };
}

export async function mockLogin(payload: AuthPayload): Promise<{ ok: true; user: { email: string; name: string } } | { ok: false; error: string }> {
  await delay();
  const users = loadUsers();
  const user = users.find(
    (u) => u.email.toLowerCase() === payload.email.toLowerCase() && u.password === payload.password,
  );
  if (!user) return { ok: false, error: 'Неверная почта или пароль' };
  return { ok: true, user: { email: user.email, name: user.name } };
}

export async function mockSetRole(_role: Role): Promise<void> {
  await delay();
}

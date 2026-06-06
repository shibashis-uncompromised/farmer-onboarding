// Local-only auth gate (works fully offline). Replace with real auth when the
// backend is added — keep the same isAuthed()/login()/logout() surface.

const AUTH_KEY = "fo_auth_v1";

// Preset local credentials. Change as needed (or wire to backend later).
const USERS: Record<string, string> = {
  admin: "admin123",
  field: "field123",
};

export interface AuthUser {
  username: string;
  at: number;
}

export function login(username: string, password: string): AuthUser | null {
  const u = username.trim().toLowerCase();
  if (USERS[u] && USERS[u] === password) {
    const user: AuthUser = { username: u, at: Date.now() };
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    return user;
  }
  return null;
}

export function currentUser(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const COOKIE = "kobi_token";

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setToken(token: string): void {
  document.cookie = `${COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
}

export function clearToken(): void {
  document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const baseHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const initHeaders = init?.headers
    ? Object.fromEntries(new Headers(init.headers).entries())
    : {};

  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...baseHeaders, ...initHeaders },
  });

  if (res.status === 401 && typeof window !== "undefined") {
    clearToken();
    window.location.href = "/login";
  }
  return res;
}

export function logout(): void {
  clearToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

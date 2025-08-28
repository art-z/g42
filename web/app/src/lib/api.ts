// src/lib/api.ts
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = init.headers ?? {};

    if (init.body && !("Content-Type" in headers)) {
        headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`/api${path}`, {
        credentials: "include",
        ...init,
        headers,
    });

    if (!res.ok) {
        let text = await res.text().catch(() => "");
        throw new Error(text || res.statusText);
    }
    return res.json() as Promise<T>;
}

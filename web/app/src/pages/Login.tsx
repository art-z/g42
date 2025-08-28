// src/pages/Login.tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useNavigate, useOutletContext } from "react-router-dom";
import type { AppContext } from "../App";

export default function Login() {
    const [username, setU] = useState("");
    const [password, setP] = useState("");
    const [error, setError] = useState("");
    const nav = useNavigate();
    const { setMe } = useOutletContext<AppContext>();

    useEffect(() => {
        (async () => {
            try {
                const me = await api<{ id: number; username: string; role: string }>("/me");
                console.log("[login] /me ok:", me);
                setMe(me);             // 💡 <— вот здесь обновляем App
                nav("/rounds");
            } catch (e) {
                console.log("[login] /me not authorized:", (e as Error).message);
            }
        })();
    }, [nav, setMe]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            await api("/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
            });
            const me = await api("/me");
            setMe(me);
            nav("/rounds");
        } catch {
            setError("Неверное имя или пароль");
        }
    };

    return (
        <div className="page">
            <h1>Вход</h1>
            <form onSubmit={submit} className="card form">
                <input
                    placeholder="Имя"
                    value={username}
                    onChange={(e) => setU(e.target.value)}
                    autoComplete="username"
                />
                <input
                    placeholder="Пароль"
                    type="password"
                    value={password}
                    onChange={(e) => setP(e.target.value)}
                    autoComplete="current-password"
                />
                <button type="submit">Войти</button>
                {error && <div className="error">{error}</div>}
            </form>
        </div>
    );
}

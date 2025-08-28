// src/pages/Rounds.tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Link } from "react-router-dom";

type RoundRow = {
    id: string;
    createdAt: string;
    startsAt: string;
    endsAt: string;
    totalPoints: number;
    totalTaps: number;
    state: "Cooldown" | "Активен" | "Завершен";
};

type Me = { id: number; username: string; role: string };

export default function Rounds() {
    const [rows, setRows] = useState<RoundRow[]>([]);
    const [err, setErr] = useState("");
    const [me, setMe] = useState<Me | null>(null);

    const load = () =>
        api<RoundRow[]>("/rounds").then(setRows).catch(() => {});
    useEffect(() => {
        load();
        const t = setInterval(load, 1000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        api<Me>("/me").then(setMe).catch(() => setMe(null));
    }, []);

    const createRound = async () => {
        setErr("");
        try {
            const r = await api<RoundRow>("/rounds", { method: "POST" });
            location.href = `/rounds/${r.id}`;
        } catch {
            setErr("Недостаточно прав (нужен admin).");
        }
    };

    const statusLabel: Record<RoundInfo["state"], string> = {
        cooldown: "Сooldown",
        active: "Активен!",
        finished: "Завершён"
    };

    return (
        <div className="page">
            <div className="row">
                <h1>Раунды</h1>
                {me?.role === "admin" && (
                    <button onClick={createRound}>Создать раунд</button>
                )}
            </div>

            {err && <div className="error">{err}</div>}

            <div className="grid">
                {rows.map((r) => (
                    <div key={r.id} className={`card ${r.state}`}>
                        <div className="card-row">
                            <div className="round-status"></div>
                            <b>Round ID:</b>{" "}
                            <Link to={`/rounds/${r.id}`}>{r.id}</Link>
                        </div>
                        <div className="card-row">
                            <b>Start:</b>{" "}
                            {new Date(r.startsAt).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                            })}
                        </div>
                        <div className="card-row">
                            <b>End:</b>{" "}
                            {new Date(r.endsAt).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                            })}
                        </div>
                        <div className="card-row">
                            <b>Статус:</b> {statusLabel[r.state]}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

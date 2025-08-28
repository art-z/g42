// src/pages/Round.tsx
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useParams } from "react-router-dom";

type RoundInfo = {
    id: string;
    startsAt: string;
    endsAt: string;
    totalTaps: number;
    totalPoints: number;
    state: "cooldown"|"active"|"finished";
    winner: { userId: number; role: string; points: number } | null;
    me: { taps: number; points: number };
};

export default function Round() {
    const { id } = useParams();
    const [info, setInfo] = useState<RoundInfo | null>(null);
    const [err, setErr] = useState("");


    function isUUID(str?: string): str is string {
        return typeof str === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
    }

    function formatTime(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }

    const load = () => {
        if (!isUUID(id)) return;
        api<RoundInfo>(`/rounds/${id}`).then(setInfo).catch(() => {});
    };
    useEffect(() => {
        load();
        const t = setInterval(load, 1000);
        return () => clearInterval(t);
    }, [id]);

    const tap = async () => {
        setErr("");
        if (!isUUID(id)) {
            setErr("Некорректный UUID раунда");
            return;
        }
        try {
            await api<{ myTaps: number; myPoints: number }>(`/rounds/${id}/tap`, { method: "POST" });
            await load();
        } catch {
            setErr("Тап недоступен.");
            setTimeout(() => setErr(""), 1200);
        }
    };

    if (!info) return <div className="page">Загрузка…</div>;

    const now = Date.now();
    const startsAt = new Date(info.startsAt).getTime();
    const endsAt = new Date(info.endsAt).getTime();

    const countdownSeconds = info.state === "cooldown"
        ? Math.max(0, Math.floor((startsAt - now)/1000))
        : 0;

    const remainingSeconds = info.state === "active"
        ? Math.max(0, Math.floor((endsAt - now)/1000))
        : 0;

    const countdown = formatTime(countdownSeconds);
    const remaining = formatTime(remainingSeconds);


    return (
        <div className="page">
            <h1>Раунд #{info.id}</h1>

            <div
                className={`goose ${info.state !== "active" ? "disabled": ""}`}
                onClick={info.state === "active" ? tap : undefined}
                aria-disabled={info.state !== "active"}
                role="button"
                tabIndex={0}
                onKeyDown={(e)=>{ if (e.key === " " || e.key === "Enter") info.state === "active" && tap(); }}
                title={info.state === "active" ? "Тапни!" : "Недоступно"}
            >
                🪿
            </div>


            {info.state === "cooldown" && (
                <div className="stats">
                    <div className="stat"><b>До начала раунда: {countdown}</b></div>
                </div>
            )}

            {info.state === "active" && (
                <div className="stats">
                    <div className="stat"><b>Раунд активен!</b></div>
                    <div className="stat">До конца осталось: {remaining}</div>
                    <div className="stat">Мои очки: {info.me.points}</div>
                </div>
            )}

            {info.state === "finished" && (
                <div className="stats">
                    <div className="stat"><b>Всего:</b> {info.totalPoints} </div>
                    <div className="stat">Победитель: {info.winner ? `${info.winner.role} (${info.winner.points} очков)` : "—"}</div>
                    <div className="stat">Мои очки: {info.me.points}</div>
                </div>
            )}

            {err && <div className="error">{err}</div>}
        </div>

    );
}

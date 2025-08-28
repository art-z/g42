// src/App.tsx
import { Outlet, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "./lib/api";

export type Me = { id: number; username: string; role: string };
export type AppContext = {
    me: Me | null;
    setMe: (me: Me | null) => void;
};

export default function App() {
    const loc = useLocation();
    const [me, setMe] = useState<Me | null>(null);

    useEffect(() => {
        api("/me").then(setMe).catch(() => setMe(null));
    }, []);

    return (
        <div className="layout">
            <header className="topbar">
                <Link to="/rounds" className="brand">G-42</Link>
                <nav className="nav">
                    <Link to="/rounds">Раунды</Link>
                </nav>

                {me ? (
                    <span>{me.username}</span>
                ) : (
                    <Link to="/">Вход</Link>
                )}
            </header>

            <main className="content" data-path={loc.pathname}>
                <Outlet context={{ me, setMe }} />
            </main>
        </div>
    );
}

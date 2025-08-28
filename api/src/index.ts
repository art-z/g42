// src/index.ts
import fs from "fs";
import path from "path";
import Fastify from "fastify";
import { FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import {PrismaClient} from "@prisma/client";
import bcrypt from "bcryptjs";
import {env} from "./env.js";
import {z} from "zod";

type JWTPayload = { userId: number; role: string; username: string };

interface AuthenticatedRequest extends FastifyRequest {
    user: JWTPayload;
}

const bannedUsernames = new Set<string>(
    JSON.parse(fs.readFileSync(path.join(process.cwd(), "banned-users.json"), "utf-8"))
        .map((u: string) => u.toLowerCase())
);

function resolveRole(username: string): string {
    const raw = username.trim().toLowerCase();
    return transliterate(raw);
}

function transliterate(text: string): string {
    const map: Record<string, string> = {
        а: "a", б: "b", в: "v", г: "g", д: "d",
        е: "e", ё: "e", ж: "zh", з: "z", и: "i",
        й: "y", к: "k", л: "l", м: "m", н: "n",
        о: "o", п: "p", р: "r", с: "s", т: "t",
        у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch",
        ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "",
        э: "e", ю: "yu", я: "ya"
    };

    return text
        .split("")
        .map(char => map[char] ?? char)
        .join("");
}


async function main() {
    const app = Fastify({logger: true});
    const prisma = new PrismaClient();

    await app.register(cookie);
    await app.register(jwt, {
        secret: env.JWT_SECRET,
        cookie: {cookieName: "token", signed: false}
    });
    await app.register(sensible);

    await app.register(rateLimit, {
        global: false
    });

    const auth = async (req: any, rep: any) => {
        try {
            await req.jwtVerify();
        } catch {
            return rep.code(401).send({error: "Unauthorized"});
        }
    };


    // httpOnly cookie
    app.get("/me", {preHandler: auth}, async (req) => {
        const u = (req as any).user as JWTPayload;
        return {id: u.userId, username: u.username, role: u.role};
    });


    // --- AUTH ---
    app.post("/login", async (req, rep) => {
        const body = z.object({username: z.string().min(1), password: z.string().min(1)}).parse(req.body);
        const username = body.username.trim();
        const role = resolveRole(username);

        let user = await prisma.user.findUnique({where: {username}});
        if (!user) {
            const hash = await bcrypt.hash(body.password, 10);
            user = await prisma.user.create({data: {username, passwordHash: hash, role}});
        } else {
            const ok = await bcrypt.compare(body.password, user.passwordHash);
            if (!ok) return rep.code(400).send({error: "Неверный пароль"});
        }

        const token = await rep.jwtSign({userId: user.id, role: user.role, username: user.username} as JWTPayload);
        rep.setCookie("token", token, {httpOnly: true, sameSite: "lax", path: "/"});
        return {id: user.id, username: user.username, role: user.role};
    });

    // --- Round list ---
    app.get("/rounds", async () => {
        const now = new Date();
        const rows = await prisma.round.findMany({
            orderBy: {createdAt: "desc"},
            select: {id: true, createdAt: true, startsAt: true, endsAt: true, totalPoints: true, totalTaps: true},
        });
        return rows.map(r => ({
            ...r,
            state: now < r.startsAt ? "cooldown" : (now >= r.startsAt && now < r.endsAt ? "active" : "finished")
        }));
    });

    // --- Round create ---
    app.post("/rounds", {preHandler: auth}, async (req, rep) => {
        const user = (req as any).user as JWTPayload;
        if (user.role !== "admin") return rep.code(403).send({error: "Forbidden"});

        const now = new Date();
        const startsAt = new Date(now.getTime() + env.COOLDOWN_DURATION * 1000);
        const endsAt = new Date(startsAt.getTime() + env.ROUND_DURATION * 1000);

        const round = await prisma.round.create({data: {startsAt, endsAt}});
        return round;
    });

    // --- Get round ---
    app.get("/rounds/:id", { preHandler: auth }, async (req, rep) => {
        const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
        const user = (req as any).user as JWTPayload;

        const round = await prisma.round.findUnique({
            where: { id },
            include: {
                stats: {
                    where: { userId: user.userId },
                    select: { taps: true, points: true }
                }
            }
        });

        if (!round) return rep.code(404).send({ error: "Not found" });

        const now = new Date();
        const state = now < round.startsAt
            ? "cooldown"
            : now >= round.startsAt && now < round.endsAt
                ? "active"
                : "finished";

        let winner: { userId: number; points: number; role?: string } | null = null;

        if (state === "finished") {
            const top = await prisma.userRoundStat.findFirst({
                where: { roundId: id },
                orderBy: [{ points: "desc" }, { id: "asc" }],
                select: { userId: true, points: true }
            });

            if (top) {
                const winnerUser = await prisma.user.findUnique({
                    where: { id: top.userId },
                    select: { role: true }
                });

                winner = {
                    userId: top.userId,
                    points: top.points,
                    role: winnerUser?.role ?? undefined
                };
            }
        }

        return {
            id: round.id,
            startsAt: round.startsAt,
            endsAt: round.endsAt,
            totalTaps: round.totalTaps,
            totalPoints: round.totalPoints,
            state,
            winner,
            me:round.stats[0] ?? { taps: 0, points: 0 }
        };
    });


    // --- TAP ---
    app.post("/rounds/:id/tap", {
        preHandler: auth,
        config: {
            rateLimit: {
                max: 5,
                timeWindow: 1000,
                keyGenerator: (req: AuthenticatedRequest) => {
                    return req.user?.userId?.toString() ?? req.ip;
                },
                errorResponseBuilder: () => ({
                    error: "Слишком много запросов. Подожди немного."
                })
            }
        }
    }, async (req, rep) => {
        const {id} = z.object({id: z.string().uuid()}).parse(req.params);
        const user = (req as any).user as JWTPayload;

        if (bannedUsernames.has(<string>user.role)) {
            const r = await prisma.round.findUnique({where: {id}, select: {startsAt: true, endsAt: true}});
            if (!r) return rep.code(404).send({error: "Not found"});
            const now = new Date();
            const active = now >= r.startsAt && now < r.endsAt;
            if (!active) return rep.code(400).send({error: "Раунд не активен"});
            return {myTaps: 0, myPoints: 0};
        }

        const active = await prisma.round.findFirst({
            where: {
                id,
                startsAt: {lte: new Date()},
                endsAt: {gt: new Date()}
            },
            select: {id: true}
        });
        if (!active) return rep.code(400).send({error: "Раунд не активен или не найден"});


        await prisma.$executeRawUnsafe(`
            INSERT INTO "UserRoundStat"("userId", "roundId", "taps", "points")
            VALUES ($1::int, $2::uuid, 0, 0) ON CONFLICT ("userId", "roundId") DO NOTHING
        `, user.userId, id);


        const result = await prisma.$queryRaw<Array<{ my_taps: number; my_points: number; awarded: number }>>`
            WITH up AS (
            UPDATE "UserRoundStat" urs
            SET "points" = urs."points" + CASE WHEN (urs."taps" % 11) = 10 THEN 10 ELSE 1 END,
                "taps"   = urs."taps" + 1
            WHERE urs."userId" = ${user.userId}::int AND urs."roundId" = ${id}::uuid
                RETURNING urs."taps"
                , urs."points"
                , (CASE WHEN (urs."taps" % 11) = 10 THEN 10 ELSE 1 END) AS awarded
                )
                , upd AS (
            UPDATE "Round" r
            SET
                "totalPoints" = r."totalPoints" + (SELECT awarded FROM up), "totalTaps" = r."totalTaps" + 1
            WHERE r.id = ${id}::uuid
                RETURNING 1
                )
            SELECT *
            FROM up;
        `;

        if (!result.length) return rep.code(500).send({error: "Не удалось обновить тап"});
        const row = result[0];
        return {
            myTaps: Number(row.my_taps),
            myPoints: Number(row.my_points)
        };
    });


    // START
    app.listen({port: env.PORT, host: "0.0.0.0"})
        .then(() => app.log.info(`API on :${env.PORT}`))
        .catch(err => {
            app.log.error(err);
            process.exit(1);
        });
}

main();

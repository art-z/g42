// src/env.ts
export const env = {
    PORT: Number(process.env.PORT ?? 3000),
    JWT_SECRET: process.env.JWT_SECRET ?? "dev_secret_at_least_32_chars",
    ROUND_DURATION: Number(process.env.ROUND_DURATION ?? 60),
    COOLDOWN_DURATION: Number(process.env.COOLDOWN_DURATION ?? 30),
};

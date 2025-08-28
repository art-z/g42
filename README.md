# 🪿API

Простой Fastify + Prisma API.
 
```bash
git clone https://github.com/art-z/g42
cd g42
```

```bash
docker compose up --build
```

Будет доступен по адресу:

```
http://localhost:4321
```

### Внутри:

- Node.js + Fastify
- PostgreSQL
- Prisma ORM
- JWT + Cookie auth
- Rate limiting
- Простая система ролей через транслитерацию имени

Переменные окружения определены в `docker-compose.yml`

`banned-users.json` не могут участвовать в активных раундах (тапы игнорируются).

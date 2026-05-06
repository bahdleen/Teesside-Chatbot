# Security notes

Do not expose `/ask` publicly without an API key.

Set in `.env`:

```env
API_KEY=generate-a-long-secret-with-openssl-rand-hex-32
```

Generate:

```bash
openssl rand -hex 32
```

Call with:

```bash
-H "x-api-key: YOUR_API_KEY"
```

Never include in submitted or shared materials:

```text
.env
Neon database URL
Cloudflare credentials JSON
API keys
```

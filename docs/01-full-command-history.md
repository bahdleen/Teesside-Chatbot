# Full command history / build order

## Scraper server

```bash
sudo apt update
sudo apt install -y curl wget git unzip build-essential ca-certificates gnupg lsb-release postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo -u postgres psql
```

Inside psql:

```sql
CREATE USER campuspaddy WITH PASSWORD 'campuspaddy';
CREATE DATABASE campuspaddy_local OWNER campuspaddy;
GRANT ALL PRIVILEGES ON DATABASE campuspaddy_local TO campuspaddy;
\q
```

Create project:

```bash
mkdir campuspaddy-ai-importer
cd campuspaddy-ai-importer
npm init -y
npm install pg cheerio dotenv pdf-parse mammoth
npm install -D typescript tsx @types/node @types/pg
mkdir -p src db storage/raw-html storage/pdfs storage/other
cp .env.example .env
psql postgresql://campuspaddy:campuspaddy@localhost:5432/campuspaddy_local < db/schema.sql
npm run crawl:tees
npm run process:all -- --dry-run
npm run process:all -- --limit=20
npm run process:all
npm run report
```

Adminer:

```bash
./scripts/setup-adminer.sh
./scripts/start-adminer.sh
# open http://SERVER_IP:8080/adminer.php
```

Migration:

```bash
export LOCAL_DATABASE_URL='postgresql://campuspaddy:campuspaddy@localhost:5432/campuspaddy_local'
export NEON_DATABASE_URL='YOUR_NEON_URL'
./scripts/migrate-to-neon.sh
```

## AI server

```bash
mkdir -p ~/campuspaddy-retrieval-api
cd ~/campuspaddy-retrieval-api
npm init -y
npm install express cors pg dotenv
npm install -D tsx typescript @types/node @types/express @types/cors @types/pg
mkdir -p src
cp .env.example .env
npm run indexes
npm run optimize:search
ollama list
curl http://127.0.0.1:11434/api/chat -H 'Content-Type: application/json' -d '{"model":"llama3.1:8b","stream":false,"keep_alive":"24h","messages":[{"role":"user","content":"Reply with ready."}],"options":{"num_predict":10}}'
npm run dev
```

Test:

```bash
curl -s http://127.0.0.1:3011/health | jq
curl -X POST http://127.0.0.1:3011/ask -H 'Content-Type: application/json' -d '{"question":"How do I contact accommodation?"}'
```

Cloudflare/systemd:

```bash
sudo cp deployment/campuspaddy-ai-api.service /etc/systemd/system/campuspaddy-ai-api.service
sudo systemctl daemon-reload
sudo systemctl enable campuspaddy-ai-api
sudo systemctl start campuspaddy-ai-api
sudo nano /etc/cloudflared/config.yml
cloudflared tunnel route dns 01077474-1853-460b-9744-7f5136679ea2 campuspaddy-ai.edjenuwahome.uk
sudo systemctl restart cloudflared
curl -s https://campuspaddy-ai.edjenuwahome.uk/health | jq
```

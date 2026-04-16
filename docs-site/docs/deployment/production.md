---
sidebar_position: 3
title: "Production Deployment"
description: "Production checklist, TLS, secrets, monitoring, and scaling"
---

# Production Deployment

Guidelines for deploying HIVE to production.

## Pre-Deployment Checklist

- [ ] Database: Postgres or managed RDS with automated backups
- [ ] Network: VPC, private subnets, security groups configured
- [ ] TLS: Valid certificates for Node and Dashboard domains
- [ ] Secrets: API keys in vault (HashiCorp, AWS Secrets Manager)
- [ ] Monitoring: CloudWatch/Datadog/Prometheus configured
- [ ] Logging: Centralized logging (CloudWatch, ELK, Datadog)
- [ ] Alerts: PagerDuty/Slack configured for critical alerts
- [ ] Backup: Database backups automated and tested
- [ ] Compliance: Governance settings configured (regulation, residency)
- [ ] Security: Firewall rules, rate limiting, DDoS protection

## TLS Configuration

### Generate Certificates

Self-signed (dev):

```bash
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365
```

Production (use Let's Encrypt or your CA):

```bash
certbot certonly --standalone -d hive-node.mycompany.com
certbot certonly --standalone -d hive-dashboard.mycompany.com
```

### Configure Docker

Update `docker-compose.yml`:

```yaml
services:
  node:
    environment:
      TLS_CERT: /run/secrets/tls_cert
      TLS_KEY: /run/secrets/tls_key
    secrets:
      - tls_cert
      - tls_key

secrets:
  tls_cert:
    external: true
  tls_key:
    external: true
```

Load secrets:

```bash
docker secret create tls_cert /path/to/cert.pem
docker secret create tls_key /path/to/key.pem
```

### Nginx Reverse Proxy

Or use Nginx/HAProxy as reverse proxy:

```nginx
upstream hive_node {
  server hive-node:3001;
}

server {
  listen 443 ssl;
  server_name hive-node.mycompany.com;

  ssl_certificate /etc/letsencrypt/live/hive-node.mycompany.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/hive-node.mycompany.com/privkey.pem;

  location / {
    proxy_pass http://hive_node;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Secrets Management

### AWS Secrets Manager

Store sensitive data:

```bash
aws secretsmanager create-secret \
  --name hive/prod/db-password \
  --secret-string "$(openssl rand -base64 32)"

aws secretsmanager create-secret \
  --name hive/prod/openai-key \
  --secret-string "sk-..."
```

Retrieve in app:

```bash
export DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id hive/prod/db-password \
  --query 'SecretString' \
  --output text)

docker-compose up -d
```

### HashiCorp Vault

Store secrets in Vault:

```bash
vault write secret/hive/prod/db \
  username=hive_prod \
  password="$(openssl rand -base64 32)"

vault write secret/hive/prod/openai \
  api_key="sk-..."
```

Retrieve in Docker:

```bash
# Use Vault agent or init script to populate .env
docker-compose up -d
```

## Monitoring

### Prometheus

Scrape metrics from Node:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'hive'
    static_configs:
      - targets: ['hive-node.mycompany.com:9090']
```

Dashboards:

- Total events ingested
- Cost per provider
- Anomalies detected
- Ingestion latency
- Database query latency

### CloudWatch

AWS CloudWatch metrics:

```bash
# Node logs
aws logs create-log-group --log-group-name /hive/node
aws logs create-log-stream --log-group-name /hive/node --log-stream-name prod

# Metrics
aws cloudwatch put-metric-data \
  --namespace HIVE \
  --metric-name EventsIngested \
  --value 1000
```

### Datadog

Integrate with Datadog:

```yaml
# docker-compose.yml
services:
  node:
    environment:
      DD_TRACE_ENABLED: true
      DD_SERVICE: hive-node
      DD_ENV: production
```

Datadog agent runs as sidecar and sends metrics.

## Logging

Centralize logs:

```yaml
services:
  node:
    logging:
      driver: awslogs
      options:
        awslogs-group: /hive/node
        awslogs-region: us-east-1
        awslogs-stream-prefix: prod
```

Or ELK stack:

```yaml
services:
  node:
    logging:
      driver: awslogs
      options:
        awslogs-group: hive-node
        awslogs-region: us-east-1
```

## Database

### Backup Strategy

Daily automated backups:

```bash
# AWS RDS
aws rds create-db-snapshot \
  --db-instance-identifier hive-prod \
  --db-snapshot-identifier hive-prod-$(date +%Y%m%d)

# Cron job
0 2 * * * aws rds create-db-snapshot --db-instance-identifier hive-prod --db-snapshot-identifier hive-prod-$(date +\%Y\%m\%d)
```

Test restore procedures monthly.

### High Availability

Use managed Postgres (RDS, Cloud SQL):

```
Application → RDS (Multi-AZ)
              ├─ Primary (us-east-1a)
              └─ Standby (us-east-1b)
```

RDS handles failover automatically.

## Scaling

### Horizontal Scaling

Run multiple Node instances behind load balancer:

```yaml
version: '3.8'

services:
  node-1:
    image: hive:node-latest
    environment:
      DATABASE_URL: postgresql://...
      NODE_ID: node-1

  node-2:
    image: hive:node-latest
    environment:
      DATABASE_URL: postgresql://...
      NODE_ID: node-2

  load-balancer:
    image: nginx:latest
    ports:
      - "3001:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
```

Load balancer config:

```nginx
upstream hive_nodes {
  least_conn;
  server node-1:3001;
  server node-2:3001;
}

server {
  listen 80;
  location / {
    proxy_pass http://hive_nodes;
  }
}
```

### Database Scaling

Postgres can handle:
- 10,000 events/sec
- 10 billion events stored
- 1 billion/month retention (with compression)

For larger volumes:
- Sharding by department or provider
- Read replicas for analytics
- Archive old data to S3

## Rate Limiting

Prevent abuse:

```bash
# Node environment
RATE_LIMIT_BATCHES_PER_SECOND=100
RATE_LIMIT_BATCHES_PER_MINUTE=1000
```

## Security

### Network

VPC configuration:

```
┌─────────────────────────────┐
│ VPC (10.0.0.0/16)           │
├─────────────────────────────┤
│ Public Subnet (NAT)         │
│ ├─ Load Balancer            │
│ └─ Bastion host             │
├─────────────────────────────┤
│ Private Subnet              │
│ ├─ Node instances           │
│ ├─ Dashboard                │
│ └─ Database                 │
└─────────────────────────────┘
```

Security groups:

```
Load Balancer → Allow 443/80 from 0.0.0.0/0
Node → Allow 3001 from Load Balancer only
Database → Allow 5432 from Node only
```

### API Keys

Never commit API keys. Use environment variables:

```bash
# ✗ Bad
const openai = new OpenAI({ apiKey: 'sk-...' });

# ✓ Good
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

### Audit Logging

Enable audit logs:

```bash
ENABLE_AUDIT_LOGS=true
AUDIT_LOG_DESTINATION=cloudwatch
```

All governance-relevant actions are logged:
- API calls
- Configuration changes
- Data deletions
- User actions

## Disaster Recovery

### RTO/RPO Targets

- **RTO** (Recovery Time Objective): < 1 hour
- **RPO** (Recovery Point Objective): < 5 minutes

### Backup and Restore

```bash
# Backup
pg_dump -h hive-db.mycompany.com -U hive hive > backup.sql

# Restore
psql -h new-db.mycompany.com -U hive hive < backup.sql
```

Test restore procedures quarterly.

---

Next: [Contributing](/contributing) or [Architecture Overview](/architecture/overview).

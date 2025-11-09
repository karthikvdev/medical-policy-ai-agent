# syntax=docker/dockerfile:1

# -------- Frontend (dev) --------
FROM node:20-alpine AS frontend-dev
WORKDIR /usr/src/app

# Deps first for better caching
COPY frontend/package.json frontend/package-lock.json* frontend/pnpm-lock.yaml* frontend/yarn.lock* ./ 
RUN if [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm i --frozen-lockfile; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm install; fi

# App sources
COPY frontend/ ./

ENV HOST=0.0.0.0 \
    PORT=5173
EXPOSE 5173
CMD ["sh", "-c", "npm run dev -- --host 0.0.0.0 --port ${PORT:-5173}"]

# -------- Backend --------
FROM python:3.11-slim AS backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY policy.json /app/policy.json
COPY README.md /app/README.md

ENV HOST=0.0.0.0 \
    PORT=8080

EXPOSE 8080

# Use a non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser
CMD ["sh", "-c", "uvicorn backend.api:app --host 0.0.0.0 --port ${PORT:-8080}"]
# syntax=docker/dockerfile:1

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY policy.json /app/policy.json
COPY README.md /app/README.md

ENV HOST=0.0.0.0 \
    PORT=8080

EXPOSE 8080

# Use a non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser
CMD ["sh", "-c", "uvicorn backend.api:app --host 0.0.0.0 --port ${PORT:-8080}"]


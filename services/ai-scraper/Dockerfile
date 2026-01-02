FROM python:3.11-slim

WORKDIR /app

# Prevent Python from buffering output (helps with logging)
ENV PYTHONUNBUFFERED=1
# Suppress DBus connection attempts in containers
ENV DBUS_SESSION_BUS_ADDRESS=/dev/null

# Install system dependencies for Playwright (matching Crawl4AI official Dockerfile)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    lsof \
    procps \
    # Browser libraries
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcb1 \
    libxkbcommon0 \
    libx11-6 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    # Fonts (required for rendering)
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install only Chromium (not all browsers)
RUN playwright install chromium --with-deps

# Setup Crawl4AI
RUN crawl4ai-setup

# Copy application code
COPY . .

# Railway uses PORT env var
ENV PORT=8000
EXPOSE 8000

# Run FastAPI with uvicorn (use $PORT for Railway compatibility)
CMD uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}

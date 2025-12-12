FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Playwright (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
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
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]

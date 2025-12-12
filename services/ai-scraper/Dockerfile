FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Setup Crawl4AI (installs browser dependencies)
RUN crawl4ai-setup

# Copy application code
COPY . .

# Railway uses PORT env var
ENV PORT=8000
EXPOSE 8000

# Run FastAPI with uvicorn (use $PORT for Railway compatibility)
CMD uvicorn api:app --host 0.0.0.0 --port $PORT

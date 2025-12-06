#!/bin/bash

# Startup script for AI Scraper Service

cd "$(dirname "$0")"

# Activate virtual environment
if [ -d "venv" ]; then
    source venv/bin/activate
elif [ -d ~/ai-scraper-venv ]; then
    source ~/ai-scraper-venv/bin/activate
else
    echo "❌ Error: Python virtual environment not found!"
    echo "Please create venv: python3 -m venv ~/ai-scraper-venv"
    echo "Then install dependencies: pip install -r requirements.txt"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found. Using config.env.example as reference."
    echo "Please create .env file with your ANTHROPIC_API_KEY"
fi

# Start the FastAPI server
echo "🚀 Starting AI Scraper Service on http://0.0.0.0:8000"
arch -arm64 uvicorn api:app --host 0.0.0.0 --port 8000 --reload


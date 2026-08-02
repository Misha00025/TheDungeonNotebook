FROM ghcr.io/misha00025/pyapi-gate:0.4.0

COPY configs/ /app/configs/
COPY handlers/ /app/handlers/
COPY main.py /app/main.py

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]

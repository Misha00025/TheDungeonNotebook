FROM python:3.13
WORKDIR /app
COPY ./req.txt ./req.txt
RUN pip install --no-cache-dir -r req.txt
COPY . .
EXPOSE 8090
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090"]

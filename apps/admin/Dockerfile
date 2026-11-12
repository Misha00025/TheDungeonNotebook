FROM python:3.13

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

COPY . .

EXPOSE 80

CMD ["gunicorn", "--bind", "0.0.0.0:80", "-w", "2", "app:create_app()"]

FROM python:3.11-slim-buster

LABEL maintainer="Misha00025<misha00025@mail.ru>"

ENV TZ=Europe/Moscow
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /app

# Копируем все файлы из текущей директории в контейнер
COPY . .

# Создаем виртуальное окружение и устанавливаем зависимости
RUN python3 -m venv venv \
    && source venv/bin/activate \
    && pip install -r req.txt

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "-w", "4", "wsgi:application"]
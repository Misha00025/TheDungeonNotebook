FROM python:3.13

LABEL maintainer="Misha00025<misha00025@mail.ru>"

ENV TZ=Europe/Moscow
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
WORKDIR /app

# Копируем все файлы из текущей директории в контейнер
COPY . .

# Создаем виртуальное окружение и устанавливаем зависимости
# RUN /bin/python3 -m venv venv
RUN pip install -r req.txt \
	&& pip install gunicorn

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "-w", "4", "wsgi:application"]
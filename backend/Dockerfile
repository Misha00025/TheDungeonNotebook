FROM python:3.11

MAINTAINER Misha00025<misha00025@mail.ru>

ENV TZ=Europe/Moscow

WORKDIR /root
RUN apt-get update
RUN apt install -y git

RUN git clone https://github.com/Misha00025/TheDungeonNotebook/ ./tdn
WORKDIR /root/tdn/backend
RUN python3 -m venv venv
RUN ./venv/bin/pip install -r req.txt
RUN ./venv/bin/pip install gunicorn

CMD ./venv/bin/gunicorn --bind 0.0.0.0:5000 --pythonpath /root/tdn/backend/venv wsgi:application
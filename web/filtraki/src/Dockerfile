FROM python:slim

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

ENV EXTERNAL_APP_PORT 4242
ENV INTERNAL_APP_PORT 8000

RUN apt-get update && \
    apt-get install -y supervisor && \
    rm -rf /var/lib/apt/lists/*

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY ./external_api/ /opt/external_api/
COPY ./internal_api/ /opt/internal_api/

# Install python requirements
RUN pip install -r /opt/external_api/requirements.txt --no-cache-dir
RUN pip install -r /opt/internal_api/requirements.txt --no-cache-dir

# Execute
EXPOSE 4242
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

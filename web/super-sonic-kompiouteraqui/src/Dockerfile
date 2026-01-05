FROM python:slim

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV APP_PORT 4242

# Copy challenge files
RUN mkdir -p /opt/app
COPY ./app/ /opt/app/
WORKDIR /opt/app

# Install python requirements
RUN pip install -r requirements.txt --no-cache-dir

# Execute
EXPOSE 4242
CMD ["/bin/sh", "/opt/app/serve.sh"]

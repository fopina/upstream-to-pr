FROM python:3.10-alpine

RUN apk add --no-cache git

# shame on missing buildkit, github!
# RUN --mount=source=requirements.txt,target=/requirements.txt pip install -r requirements.txt

COPY requirements.txt /requirements.txt
RUN pip install -r requirements.txt

COPY autoupdate.py /autoupdate.py

# will every workflow clone git as user 1001?
# newest git will complain if ownership does not match
USER 1001

ENTRYPOINT ["python", "-u", "/autoupdate.py"]

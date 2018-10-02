FROM node:8.12-alpine

WORKDIR /data

RUN apk add --no-cache unzip git curl

ADD . .

RUN npm install .

RUN curl -O https://s3.amazonaws.com/cubedhost-prisma/misc/gsdb-data.zip \
    && unzip -qo gsdb-data.zip \
    && rm gsdb-data.zip

CMD bin/run

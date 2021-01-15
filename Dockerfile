FROM node:10

WORKDIR /data

RUN apt-get update && apt-get -y install unzip git curl \
    && rm -rf /var/lib/apt/lists/*

ADD . .

RUN yarn

RUN curl -O https://s3.amazonaws.com/cubedhost-prisma/misc/gsdb-data.zip \
    && unzip -qo gsdb-data.zip \
    && rm gsdb-data.zip

CMD bin/run

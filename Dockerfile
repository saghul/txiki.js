FROM alpine:latest
ENV VERSION 20191124
WORKDIR /
RUN apk add build-base cmake curl-dev git autoconf automake libtool texinfo linux-headers --update-cache
RUN git clone --recursive https://github.com/saghul/txiki.js && cd txiki.js && make && make test

FROM alpine:latest
RUN apk add libstdc++ libcurl --update-cache
COPY --from=0 /txiki.js/build/tjs /bin/tjs
COPY --from=0 /txiki.js/examples /examples
CMD [ "tjs" ]

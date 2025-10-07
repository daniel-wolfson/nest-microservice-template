FROM postgres:15-alpine

#  Ubuntu: RUN apt-get clean && apt-get update && \
#     apt-get install -y postgresql-contrib && \
#     rm -rf /var/lib/apt/lists/*

 # Alpine: it uses apk, but not the apt-get
 RUN apk add --no-cache postgresql-contrib

 ADD *.sql /docker-entrypoint-initdb.d/

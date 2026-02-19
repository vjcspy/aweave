# ------------------------------------- wonkers-nedap -------------------------------------

start-wonkers-nedap:
    {{compose}} up -d \
      mysql-wonkers-db wonkers-db mailcatcher wonkers
    -{{compose}} logs -f \
      mysql-wonkers-db wonkers-db mailcatcher wonkers

test-wonkers-nedap:
    {{compose}} rm -sf mysql-wonkers-db
    {{compose}} up -d \
      mysql-wonkers-db wonkers-db mailcatcher wonkers
    {{compose}} run --rm --use-aliases wonkers-nedap

log-wonkers-nedap:
    {{compose}} logs -f \
      mysql-wonkers-db wonkers-db mailcatcher wonkers

# ------------------------------------- Wonkers TAAS Orders -------------------------------------

# Start dependencies for development
start-wonkers-taas-orders:
    {{compose}} up -d \
      mysql-wonkers-db wonkers-db kryten wonkers wonkers-taas wonkers-account mailcatcher
    -{{compose}} logs -f \
      mysql-wonkers-db wonkers-db kryten wonkers wonkers-taas wonkers-account mailcatcher

# Run integration tests with clean DB
test-wonkers-taas-orders:
    {{compose}} rm -sf mysql-wonkers-db
    {{compose}} up -d \
      mysql-wonkers-db wonkers-db kryten wonkers wonkers-taas wonkers-account mailcatcher
    {{compose}} run --rm --use-aliases wonkers-taas-orders

# View logs
log-wonkers-taas-orders:
    {{compose}} logs -f \
      mysql-wonkers-db wonkers-db kryten wonkers wonkers-taas wonkers-account mailcatcher

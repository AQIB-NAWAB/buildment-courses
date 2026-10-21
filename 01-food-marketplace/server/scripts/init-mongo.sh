#!/usr/bin/env bash
set -euo pipefail

# Wait for the Docker Mongo container, then initiate a single-node replica set.
# Transactions (checkout, reservations, coupon redemption) require this.

HOST="${MONGO_INIT_HOST:-127.0.0.1}"
PORT="${MONGO_INIT_PORT:-27017}"
CONTAINER="${MONGO_CONTAINER:-freshmarket-mongo}"

for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" mongosh --quiet --eval "db.adminCommand({ ping: 1 })" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$CONTAINER" mongosh --quiet --eval "db.adminCommand({ ping: 1 })" >/dev/null 2>&1; then
  echo "MongoDB container '$CONTAINER' is not reachable. Run 'npm run services:up' first." >&2
  exit 1
fi

STATUS=$(docker exec "$CONTAINER" mongosh --quiet --eval "try { rs.status().ok } catch (e) { 0 }")
if [ "$STATUS" = "1" ]; then
  echo "Replica set rs0 is already initialized."
else
  docker exec "$CONTAINER" mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'${HOST}:${PORT}'}]})"
  echo "Initialized replica set rs0 at ${HOST}:${PORT}."
fi

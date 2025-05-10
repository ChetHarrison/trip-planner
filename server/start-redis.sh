#!/bin/bash

REDIS_CONTAINER=redis-dev
RETRIES=10
SUCCESS=0

# Start Redis container in detached mode (ignore error if already running)
docker start $REDIS_CONTAINER >/dev/null 2>&1 || \
  docker run -d -p 6379:6379 --name $REDIS_CONTAINER redis > server/redis.cid 2>/dev/null

# Cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Stopping Redis..."
  docker stop $REDIS_CONTAINER > /dev/null
  echo "✅ Redis container stopped"
  exit 0
}

# Trap Ctrl+C (SIGINT) and kill signals
trap cleanup SIGINT SIGTERM

# Wait for Redis to respond to ping
for ((i=1; i<=RETRIES; i++)); do
  sleep 0.5
  if docker exec $REDIS_CONTAINER redis-cli ping >/dev/null 2>&1; then
    echo "✅ Redis is ready"
    SUCCESS=1
    break
  fi
done

if [[ "$SUCCESS" -eq 0 ]]; then
  echo "❌ Redis failed to start. Dumping logs:"
  docker logs $REDIS_CONTAINER
  docker stop $REDIS_CONTAINER > /dev/null
  exit 1
fi

# Keep the process alive (important: must *not* background this script)
echo "📡 Press Ctrl+C to stop Redis..."
tail -f /dev/null
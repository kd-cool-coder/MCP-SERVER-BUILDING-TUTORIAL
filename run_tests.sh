#!/bin/bash
set -e

echo "Starting MCPJam inspector..."
# Start the inspector in the background and log output
npx -y @mcpjam/inspector npx tsx src/stdio.ts > inspector_out.log 2>&1 &
INSPECTOR_PID=$!

echo "Waiting for inspector URL..."
URL=""
# Timeout after 30 seconds
for i in {1..30}; do
  if grep -q "http://" inspector_out.log; then
    # Extract the URL. It usually looks like "http://127.0.0.1:6274?MCP_INSPECTOR_API_TOKEN=..." or similar
    URL=$(grep -oE "http://[a-zA-Z0-9.:?=&_-]+" inspector_out.log | head -n 1)
    if [ -n "$URL" ]; then
      break
    fi
  fi
  sleep 1
done

if [ -z "$URL" ]; then
  echo "Failed to find inspector URL."
  cat inspector_out.log
  kill $INSPECTOR_PID
  exit 1
fi

echo "Found URL: $URL"
echo "Running screenshots script..."
node take_screenshots.js "$URL"

echo "Killing inspector..."
kill $INSPECTOR_PID
echo "Done."

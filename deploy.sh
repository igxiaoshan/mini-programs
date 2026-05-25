#!/bin/bash
set -e

REMOTE=s2serv00
APP_DIR=~/app/couple-food-picker
SESSION=couplefood

echo "[1] Build"
npm run build

echo "[2] Upload dist"
ssh $REMOTE "rm -rf $APP_DIR/dist/*"
scp -q -r dist/* $REMOTE:$APP_DIR/dist/

if [[ "$1" == "--full" ]]; then
  echo "[3] Upload server & deps"
  scp -q -r server/* $REMOTE:$APP_DIR/server/
  scp -q package.json package-lock.json $REMOTE:$APP_DIR/

  echo "[4] npm install"
  ssh $REMOTE "cd $APP_DIR && npm install --omit=dev"

  echo "[5] Restart"
  ssh $REMOTE "screen -S $SESSION -X quit 2>/dev/null; screen -dmS $SESSION bash -c 'cd $APP_DIR && node server/index.mjs > server.log 2>&1'"
  sleep 2
  ssh $REMOTE "cat $APP_DIR/server.log"
fi

echo "[6] Health check"
curl -sf https://igxshan.serv00.net/api/health && echo " OK" || echo " FAIL"

echo "Done → https://igxshan.serv00.net/"
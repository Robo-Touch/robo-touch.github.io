#!/usr/bin/env bash
# Start both live render servers on the GPU machine (run there, from /tmp/optisense).
# Expects: blender-4.5.3-linux-x64/, tools/{render_server,render_jobs}/, src/belt/scene.blend (= roller_sim3.blend)
set -e
cd "$(dirname "$0")/../.."
BL=./blender-4.5.3-linux-x64/blender
pkill -f "render_server/server.py" || true
nohup $BL -b --factory-startup -P tools/render_server/server.py -- custom 8767 > log_srv_custom.txt 2>&1 < /dev/null &
nohup $BL -b src/belt/scene.blend -P tools/render_server/server.py -- belt 8766 > log_srv_belt.txt 2>&1 < /dev/null &
sleep 20
grep -h serving log_srv_*.txt

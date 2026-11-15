#!/bin/zsh
# One command: a worktree at origin/main, deps, native project, a Release build for the simulator, installed on the walk device.
# usage: zsh scripts/ios-sim.sh <worktree name> [api origin]   (on the Mac; app/e2e/sim/README.md)
set -e
name=$1; origin=${2:-http://localhost:8790}; wt=~/dev/projects/secondhand-wt/$name; udid=$(cat /tmp/sh-sim-udid)
cd ~/dev/projects/secondhand && git fetch -q origin
[ -d $wt ] || git worktree add -q -b w/$name $wt origin/main
cd $wt && git log --oneline -1
ln -sfn ~/dev/projects/secondhand/db/node_modules db/node_modules
cd app && npm ci --no-audit --no-fund >/dev/null && node ../scripts/fonts.mjs >/dev/null
export EXPO_PUBLIC_API_ORIGIN=$origin EXPO_NO_TELEMETRY=1 CI=1
npx expo prebuild --platform ios --no-install >/dev/null
(cd ios && pod install >/dev/null)
cd ios && xcodebuild -workspace secondhand.xcworkspace -scheme secondhand -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/sh-dd-$name ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build > /tmp/sh-xb-$name.log 2>&1 \
  || { tail -30 /tmp/sh-xb-$name.log; exit 1; }
xcrun simctl install $udid /tmp/sh-dd-$name/Build/Products/Release-iphonesimulator/secondhand.app
echo "installed $name built against $origin"

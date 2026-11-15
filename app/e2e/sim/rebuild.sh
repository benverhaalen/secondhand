#!/bin/zsh
# Incremental Release rebuild of a worktree scripts/ios-sim.sh already built, then install (about 25 s). usage: rebuild.sh <name> [origin]
set -e
name=$1; origin=${2:-http://localhost:8790}; udid=$(cat /tmp/sh-sim-udid)
cd ~/dev/projects/secondhand-wt/$name/app/ios
EXPO_PUBLIC_API_ORIGIN=$origin EXPO_NO_TELEMETRY=1 CI=1 xcodebuild -workspace secondhand.xcworkspace -scheme secondhand -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/sh-dd-$name ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build > /tmp/sh-xb-$name.log 2>&1 || { tail -30 /tmp/sh-xb-$name.log; exit 1; }
xcrun simctl install $udid /tmp/sh-dd-$name/Build/Products/Release-iphonesimulator/secondhand.app 2>&1 | grep -v Authoriz || true
echo "rebuilt $name against $origin"

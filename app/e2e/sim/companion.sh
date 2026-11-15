#!/bin/zsh
# Starts idb_companion for the walk device against a shadow of Xcode's Contents folder, because Xcode 27 moved
# SimulatorKit.framework to Contents/SharedFrameworks and idb_companion still looks in Developer/Library/PrivateFrameworks.
# shortcut: a shim for one idb release, drop it when idb_companion finds SimulatorKit itself.
C=/Applications/Xcode.app/Contents; S=~/xcode-shim
rm -rf $S; mkdir -p $S/Developer/Library/PrivateFrameworks
for e in $C/*; do [ "$(basename $e)" = Developer ] || ln -s $e $S/; done
for e in $C/Developer/*; do [ "$(basename $e)" = Library ] || ln -s $e $S/Developer/; done
for e in $C/Developer/Library/*; do ln -s $e $S/Developer/Library/; done
ln -s $C/SharedFrameworks/SimulatorKit.framework $S/Developer/Library/PrivateFrameworks/
udid=$(cat /tmp/sh-sim-udid)
DEVELOPER_DIR=$S/Developer exec idb_companion --udid $udid

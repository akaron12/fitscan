#!/bin/sh
# Runs the unit tests with macOS's built-in JavaScriptCore shell (or a `jsc` on PATH). No Node needed.
cd "$(dirname "$0")/.." || exit 1
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
[ -x "$JSC" ] || JSC=$(command -v jsc)
[ -n "$JSC" ] || { echo "No jsc found (it ships with macOS)." >&2; exit 2; }
status=0
echo "== day file";  "$JSC" dayfile.js tests/dayfile.test.js || status=1
echo "== drive client"; "$JSC" dayfile.js driveclient.js tests/fake-drive.js tests/drive.test.js || status=1
echo "== security (CSP, inline code, service worker list)"; "$JSC" tests/security.test.js || status=1
echo "== usda"; "$JSC" usda.js tests/usda.test.js || status=1
echo "== merge"; "$JSC" dayfile.js merge.js tests/merge.test.js || status=1
echo "== sync engine"; "$JSC" dayfile.js merge.js driveclient.js sync.js tests/fake-drive.js tests/sync.test.js || status=1
exit $status

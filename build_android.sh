#!/bin/bash
# PatchLab Android release bundle (AAB), built locally (never cloud). Run: nohup ./build_android.sh > ~/pl_android_build.log 2>&1 &
# Steps: expo prebuild (android) -> sign with signing/patchlab-upload.keystore (properties in signing/keystore.properties) -> gradle bundleRelease.
# Output: android/app/build/outputs/bundle/release/app-release.aab  (copied to ~/pl_android_build/patchlab-<versionCode>.aab)
set -euo pipefail
cd "$(dirname "$0")"
export ANDROID_HOME=/Users/milo/android-sdk ANDROID_SDK_ROOT=/Users/milo/android-sdk
npx expo prebuild --platform android --no-install --clean
python3 - <<'PY'
import re
p='android/app/build.gradle'; s=open(p).read()
s=s.replace("android {\n    ndkVersion","def keystoreProps = new Properties()\nfile('../../signing/keystore.properties').withInputStream { keystoreProps.load(it) }\nandroid {\n    ndkVersion",1)
s=s.replace("    signingConfigs {\n        debug {","    signingConfigs {\n        release {\n            storeFile file(keystoreProps['storeFile'].replace('../../','../../'))\n            storePassword keystoreProps['storePassword']\n            keyAlias keystoreProps['keyAlias']\n            keyPassword keystoreProps['keyPassword']\n        }\n        debug {",1)
s=s.replace("            // Caution! In production, you need to generate your own keystore file.\n            // see https://reactnative.dev/docs/signed-apk-android.\n            signingConfig signingConfigs.debug","            signingConfig signingConfigs.release",1)
open(p,'w').write(s)
PY
grep -q "signingConfigs.release" android/app/build.gradle || { echo "signing patch failed"; exit 1; }
cd android && ./gradlew --no-daemon bundleRelease
mkdir -p ~/pl_android_build
VC=$(grep -m1 versionCode app/build.gradle | tr -dc 0-9)
cp app/build/outputs/bundle/release/app-release.aab ~/pl_android_build/patchlab-$VC.aab
ls -la ~/pl_android_build

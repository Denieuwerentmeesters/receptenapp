#!/bin/sh
# Bouwt de app en uploadt 'm naar TestFlight. Draaien via `npm run testflight`
# in app/. Xcode moet ingelogd zijn (Settings → Apple Accounts); het
# buildnummer hoogt App Store Connect zelf op.
set -e
cd "$(dirname "$0")"
rm -rf build/Kookmaatje.xcarchive build/export
xcodebuild -project App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -derivedDataPath build \
  -archivePath build/Kookmaatje.xcarchive -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath build/Kookmaatje.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/export \
  -allowProvisioningUpdates

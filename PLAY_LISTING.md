# PatchLab — Google Play listing + forms (package com.patchlab.app)
AAB: ~/pl_android_build/patchlab-1.aab (versionCode 1, signed with signing/patchlab-upload.keystore; backup ~/patchlab-android-keystore-backup/)
Assets: ~/pl_android_build/assets/ (play-icon-512.png, play-feature-1024x500.png, phone-1..5.png 1080x1920)
Build again: `nohup ./build_android.sh > ~/pl_android_build.log 2>&1 &` (bump android.versionCode in app.json first)

## Store listing (en-US)
- App name: PatchLab
- Short description (80): Giant pumpkin & vegetable growing: grow tracker, seed research, community chat.
- Full description: PatchLab is the home for giant vegetable growers. Track every grow from seed to weigh-off, research seed genetics and crosses, see how the community's grows are doing, and chat with other growers. Share photos, follow leaderboards and get notified when someone messages you. PatchLab is free to join. Available in English, German and Spanish.
- Category: Lifestyle (or Tools) — App; Free; Contact e-mail: jason.bragg@k12.wv.us (or jsnbrgg@gmail.com — Jason's choice); Website https://patchlab.app
- Privacy policy: https://patchlab.app/privacy · Account deletion URL: https://patchlab.app/account-deletion · Support: https://patchlab.app/support

## App content answers
- App access: login required for most features -> provide the demo account (same one used for the App Store review).
- Ads: No. Target audience: 13+ (not for children). News app: No. Government app: No. Financial features: None (seed-store card payments happen on the website via Stripe).
- Content rating questionnaire: user-generated content + chat = Yes; no violence/sex/gambling/drugs. Expect Teen/PEGI 12 or similar.
- Data safety: collects e-mail, username, user-generated content (photos, notes, messages), photos, device/other ID (push token), app activity; encrypted in transit; users can request deletion (URL above); data shared with processors only (Vercel, Neon, Stripe, Google FCM, e-mail provider); not sold.
- Permissions used: camera (photos), microphone (voice messages), notifications.

## Push (done)
Firebase project extended-bongo-491823-q8, Android app 1:381043505:android:fe36660f75837cc0cd6610, sender service account patchlab-fcm (key in signing/patchlab-fcm-sa.json and Vercel env FCM_SERVICE_ACCOUNT_JSON on project patchlab). Web: src/lib/push.ts sends FCM to push_devices.platform='android'.

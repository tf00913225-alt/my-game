# 四象江湖傳：Facebook Android 原生登入 PoC

這是獨立的 Android 原生登入驗證專案，不是網站容器，也沒有 WebView。它的唯一流程是：

```text
Meta Android SDK LoginManager / CallbackManager
    -> Facebook AccessToken
    -> Firebase Android FacebookAuthProvider credential
    -> FirebaseAuth.signInWithCredential
    -> 顯示 Firebase UID（只讀）
```

它**不會**載入遊戲、修改 `js/firebase/firebase-auth.js`、呼叫 Web `signInWithPopup()`、讀寫 Firestore、讀寫 localStorage、存檔、UID ownership、角色或遷移資料。

## 固定 PoC 身分

| 項目 | 值 |
| --- | --- |
| Firebase project | `four-symbols-jianghu` |
| Meta App ID | `1712957419809925` |
| Android package name | `com.foursymbols.jianghu.authpoc` |
| Default Android Activity | `com.foursymbols.jianghu.authpoc.MainActivity` |
| Meta callback scheme | `fb1712957419809925` |
| 最低 Android 版本 | Android 6.0 / API 23 |

如果正式遊戲日後決定使用不同的 package name，必須在 Meta 與 Firebase **重新新增那個正式套件**；Android package name 不是可任意在發布前後替換的設定。

## Meta for Developers：精確設定

使用既有 App「四象江湖傳」（App ID `1712957419809925`）。App Secret 只保留在 Meta Console 與 Firebase Authentication 的既有 Facebook provider 設定，絕不寫入本專案。

1. 在 Meta App Dashboard 的 **設定 → 基本資料 → 新增平台 → Android** 新增平台。
2. 填入：

   | Meta 欄位 | 填入值 |
   | --- | --- |
   | Google Play Package Name / Android package name | `com.foursymbols.jianghu.authpoc` |
   | Class Name / Default Activity Class Name | `com.foursymbols.jianghu.authpoc.MainActivity` |
   | Key Hashes | 依下方命令產出的 **debug 與 release** Base64 SHA-1 值，各新增一筆 |

3. 在 **產品 → Facebook Login → 設定**，確認原本的 Firebase redirect URI 仍存在：

   ```text
   https://four-symbols-jianghu.firebaseapp.com/__/auth/handler
   ```

   Android 原生 PoC 不需新增 Web redirect、`location.assign()`、direct Meta OAuth callback 或 dev Pages URL。
4. 測試期間若 Meta App 仍是 Development mode，登入 Facebook 帳號必須在該 App 的角色（administrator/developer/tester）內。
5. 不要關閉 Facebook App 的「開啟支援的連結」。原生 SDK 可以正常 app-switch 或使用 Custom Tab；重點是驗證後必須回到本 PoC Activity，不能停在舊有 Web OAuth 的「Error Facebook」頁。

### 產生 Meta Key Hash

Meta 要的是 **Base64 編碼的 SHA-1 certificate hash**，與 Firebase Console 顯示的冒號分隔 SHA-1 fingerprint 不是同一種格式。

```sh
cd android/facebook-login-poc
./scripts/print-facebook-key-hash.sh <keystore-path> <key-alias>
```

debug 通常以 Android Studio 自動產生的 debug keystore 與 alias `androiddebugkey` 執行；release 則使用日後正式簽章檔與它自己的 alias。請把兩個輸出值都加到 Meta 的同一個 Android platform 設定。

若你偏好手動命令，等價寫法是：

```sh
keytool -exportcert -alias <key-alias> -keystore <keystore-path> | openssl sha1 -binary | openssl base64
```

## Firebase Console：精確設定

1. 開啟 Firebase Console 專案 `four-symbols-jianghu`。
2. 到 **專案設定 → 一般 → 你的應用程式 → 新增應用程式 → Android**。
3. 填入 Android package name：`com.foursymbols.jianghu.authpoc`。暱稱可填「Facebook Native Login PoC」。
4. 註冊後下載 `google-services.json`，只放在：

   ```text
   android/facebook-login-poc/app/google-services.json
   ```

   此檔已被 Git 忽略；不要提交、傳到 PR 或貼到聊天室。
5. 到 **Authentication → Sign-in method → Facebook**，確認 provider 持續啟用，且使用既有 Meta App ID `1712957419809925` 及既有 App Secret。這一輪不建立新 provider、不重設 secret。
6. Firebase Android app registration 若顯示新增 SHA certificate fingerprint，Facebook 流程不依賴它；可以選擇加入 debug/release 的冒號分隔 SHA-1 作日後 Google Sign-In 使用。Meta Key Hash 仍必須另外依上節設定。

Firebase 官方文件要求 Android 專案先註冊 Firebase app、啟用 Facebook provider，並由 Meta Android Login 取得 access token 後交給 `FacebookAuthProvider.getCredential(token)` 與 `FirebaseAuth.signInWithCredential()`：[Firebase Android Facebook Login](https://firebase.google.com/docs/auth/android/facebook-login)、[Add Firebase to Android](https://firebase.google.com/docs/android/setup)。

## 建置 APK

1. 安裝 Android Studio 與 Android SDK Platform 35，並使用 JDK 17。
2. 將 `google-services.json` 放到上述位置。
3. 由 Android Studio 開啟 `android/facebook-login-poc`，或在該目錄執行（repo 已附 Gradle 8.9 wrapper）：

   ```sh
   ./gradlew :app:assembleDebug
   ```

4. 成功 APK 位置：

   ```text
   app/build/outputs/apk/debug/app-debug.apk
   ```

`google-services.json` 尚未放入時，Gradle 仍可用於 source-only 結構驗證，但應用程式會明確停用登入，不能作為 Firebase 實機驗證。

## Samsung S23 Ultra 實機驗證

1. 在手機 Facebook App 保持「開啟支援的連結」**開啟**。
2. 安裝 debug APK，開啟「四象江湖傳 Facebook 原生登入 PoC」。
3. 確認畫面顯示「已就緒」，點選「以 Facebook 原生登入」。
4. 正常的 Facebook App app-switch / Custom Tab 可以出現，但不得出現以前 Web OAuth 導航的「Error Facebook／無法載入」頁；完成後必須自動回到 `MainActivity`。
5. 畫面顯示「原生 Firebase Auth 成功」與 Firebase UID 即通過原生登入 PoC。
6. 以同一個 Facebook 帳號登入遊戲既有 Web 流程，對照帳號畫面顯示的 UID。兩端 UID 必須完全相同。
7. PoC 不會進入遊戲或讀取存檔；沒有任何遊戲資料可被它寫入或遷移。

同一 Firebase project 內，使用相同 Facebook provider subject 進行 Firebase Auth 時，Android 與 Web 應解析為同一 Firebase UID。若 UID 不同，先核對 Android 的 `google-services.json` 是否屬於 `four-symbols-jianghu`、Meta App ID 是否相同、以及 Web 端是否真的是同一個 Facebook 帳號；不要藉由改寫 UID 或存檔來「修正」結果。

## Web game handoff（本輪已實作）

目前正式接法採用 **C. 外部瀏覽器 one-time handoff**：

`Android browser → foursymbols://auth/facebook → native Meta Login → Firebase Android Auth → createNativeAuthHandoff → HTTPS game URL fragment → redeemNativeAuthHandoff → Web Firebase signInWithCustomToken`

安全邊界：

- Facebook Access Token 只存在 Android native SDK / Firebase Android Auth 流程，不會放進 URL、localStorage 或 Web JavaScript。
- Android 端只接受 allow-listed HTTPS return origins。
- handoff code 為 32-byte random base64url、固定 43 字元、兩分鐘過期、單次交易兌換。
- backend 只有在 Firebase callable 已驗證目前 session 的 provider 為 `facebook.com` 時才建立 handoff。
- redeem 會以 Firestore transaction 原子刪除 handoff，再由 Firebase Admin SDK 產生 custom token。
- Web 端兌換後立即移除 URL fragment，接著沿用既有 `onAuthStateChanged`、UID resolution、cloud-save hydration。
- 不改 Firestore Rules、遊戲存檔 schema、UID ownership 或角色資料。

不可接受的做法仍包括：假設 native/Web session 自動共享、把 Facebook access token 放入 URL/localStorage、以 UID query parameter 偽造登入、或直接寫入／遷移遊戲存檔。

**Live deployment prerequisite:** `functions/index.js` 的 `createNativeAuthHandoff` 與 `redeemNativeAuthHandoff` 必須實際部署到 Firebase project `four-symbols-jianghu`。Repository merge 本身不等於 Cloud Functions 已部署。

## 正式接入前需要決定

1. 正式 Android package name 是否沿用本 PoC，或另定 production package。
2. 如果未來改成真正的 WebView/原生殼，可把同一個 trusted one-time handoff 改為 host-controlled bridge；目前不需要再建立第二套登入 owner。
3. production signing keystore 的管理方式與 release Key Hash；不能沿用 debug hash 發布。

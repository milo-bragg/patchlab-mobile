// PatchLab iPhone app: native shell around https://patchlab.app (react-native-webview) + native push, icon badge, deep links.
// Web <-> app bridge: see patchlab/src/lib/native-app.ts (window.__PL_NATIVE, 'pl-native-token', postMessage {type:'loggedin'|'unread'}).
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Keyboard, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import * as Notifications from 'expo-notifications'
import * as SplashScreen from 'expo-splash-screen'
import Constants from 'expo-constants'

const HOME = 'https://patchlab.app'
const HOSTS = ['patchlab.app', 'www.patchlab.app']
const APP_VERSION = String(Constants.expoConfig?.version ?? '1.0')
const BG = '#1e1e1e'

SplashScreen.preventAutoHideAsync().catch(() => undefined)
// The web page already dings/pops up while the app is open, so no banner/sound while in the foreground.
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }) })

function Shell() {
  const insets = useSafeAreaInsets()
  const web = useRef<WebView>(null)
  const [uri, setUri] = useState<string | null>(null)       // initial page (a tapped push opens its chat)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [kb, setKb] = useState(0)
  const token = useRef<string | null>(null)
  const askedPush = useRef(false)

  const run = useCallback((js: string) => web.current?.injectJavaScript(js + ';true;'), [])
  const injectToken = useCallback(() => {
    if (!token.current) return
    run(`window.__PL_NATIVE={token:${JSON.stringify(token.current)},env:'production',version:${JSON.stringify(APP_VERSION)}};window.dispatchEvent(new Event('pl-native-token'))`)
  }, [run])
  const openUrl = useCallback((url: string) => { const u = url.startsWith('/') ? url : '/messages'; run(`window.location.assign(${JSON.stringify(u)})`) }, [run])

  // Ask for push permission once the user is logged in, then hand the APNs token to the web app (it registers it for the user).
  const setupPush = useCallback(async () => {
    if (askedPush.current) { injectToken(); return }
    askedPush.current = true
    try {
      let { status } = await Notifications.getPermissionsAsync()
      if (status !== 'granted') status = (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } })).status
      if (status !== 'granted') return
      const t = await Notifications.getDevicePushTokenAsync()
      token.current = String(t.data).toLowerCase()
      injectToken()
    } catch { askedPush.current = false }
  }, [injectToken])

  // Tapping a notification opens its chat (cold start + while running).
  useEffect(() => {
    let alive = true
    Notifications.getLastNotificationResponseAsync().then(r => {
      const url = (r?.notification.request.content.data as { url?: string } | undefined)?.url
      if (alive) setUri(HOME + (url && url.startsWith('/') ? url : '/community'))
    }).catch(() => alive && setUri(HOME + '/community'))
    const sub = Notifications.addNotificationResponseReceivedListener(r => {
      const url = (r.notification.request.content.data as { url?: string } | undefined)?.url
      if (url) openUrl(url)
    })
    return () => { alive = false; sub.remove() }
  }, [openUrl])

  // On-screen keyboard: shrink the web view so the chat composer stays visible (WKWebView does not resize by itself).
  useEffect(() => {
    const a = Keyboard.addListener('keyboardWillShow', e => setKb(e.endCoordinates.height))
    const b = Keyboard.addListener('keyboardWillHide', () => setKb(0))
    return () => { a.remove(); b.remove() }
  }, [])

  // Leaving the app: tell PatchLab right away (so push notifications start), coming back: wake up the page.
  useEffect(() => {
    const s = AppState.addEventListener('change', st => {
      if (st === 'active') run(`window.dispatchEvent(new Event('focus'))`)
      else run(`try{navigator.sendBeacon('/api/presence',new Blob([JSON.stringify({offline:true})],{type:'application/json'}))}catch(e){}`)
    })
    return () => s.remove()
  }, [run])

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const m = JSON.parse(e.nativeEvent.data)
      if (m.type === 'unread') Notifications.setBadgeCountAsync(Math.max(0, Number(m.n) || 0)).catch(() => undefined)
      else if (m.type === 'loggedin') setupPush()
    } catch { /* ignore */ }
  }, [setupPush])

  const allow = useCallback((req: { url: string }) => {
    const u = req.url
    if (u.startsWith('about:') || u.startsWith('blob:') || u.startsWith('data:')) return true
    try {
      const url = new URL(u)
      if ((url.protocol === 'https:' || url.protocol === 'http:') && HOSTS.includes(url.hostname)) return true
      Linking.openURL(u).catch(() => undefined)   // external links (Stripe, mail, other sites) open outside the app
      return false
    } catch { return false }
  }, [])

  if (!uri) return <View style={styles.fill} />
  const bottom = kb > 0 ? kb : insets.bottom
  return (
    <View style={[styles.fill, { paddingTop: insets.top, paddingBottom: bottom }]}>
      <StatusBar style="light" />
      {failed ? (
        <View style={styles.center}>
          <Text style={styles.title}>PatchLab</Text>
          <Text style={styles.msg}>No connection. Check your internet and try again.</Text>
          <Pressable style={styles.btn} onPress={() => { setFailed(false); setLoading(true); web.current?.reload() }}><Text style={styles.btnTxt}>Try again</Text></Pressable>
        </View>
      ) : null}
      <WebView
        ref={web}
        source={{ uri }}
        style={[styles.fill, failed && { display: 'none' }]}
        applicationNameForUserAgent={`PatchLabApp/${APP_VERSION}`}
        injectedJavaScriptBeforeContentLoaded={token.current ? `window.__PL_NATIVE={token:${JSON.stringify(token.current)},env:'production',version:${JSON.stringify(APP_VERSION)}};true;` : 'true;'}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={allow}
        onLoadEnd={() => { setLoading(false); SplashScreen.hideAsync().catch(() => undefined) }}
        onError={() => { setFailed(true); SplashScreen.hideAsync().catch(() => undefined) }}
        onHttpError={e => { if (e.nativeEvent.statusCode >= 500 && e.nativeEvent.url.startsWith(HOME)) { /* page shows its own error */ } }}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        sharedCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        allowsLinkPreview={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        bounces
        setSupportMultipleWindows={false}
        decelerationRate={Platform.OS === 'ios' ? 'normal' : undefined}
      />
      {loading && !failed ? <View style={styles.spin} pointerEvents="none"><ActivityIndicator color="#f58220" /></View> : null}
    </View>
  )
}

export default function App() {
  return <SafeAreaProvider><Shell /></SafeAreaProvider>
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14, backgroundColor: BG },
  title: { color: '#f58220', fontSize: 28, fontWeight: '800' },
  msg: { color: '#ddd', fontSize: 16, textAlign: 'center' },
  btn: { backgroundColor: '#f58220', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 10 },
  btnTxt: { color: '#1e1e1e', fontWeight: '700', fontSize: 16 },
  spin: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
})

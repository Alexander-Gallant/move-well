---
source: Context7 API and official documentation
library: WebKit, Apple UserNotifications, MDN Web Docs
package: ios-home-screen-web-push
topic: iPhone/iPad Home Screen web apps and Web Push
fetched: 2026-11-18T00:00:00Z
official_docs: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
---

# Concise authoritative facts

- **Platform gate:** iOS/iPadOS 16.4 added Web Push support specifically to web apps added to the Home Screen. A normal iPhone/iPad browser tab is not the supported Web Push target described by Apple.
- **What makes it an app:** After Home Screen installation, a manifest with `display: "standalone"` or `display: "fullscreen"` makes the site launch as a Home Screen web app rather than a browser page. iOS/iPadOS 16.4 also enabled Add to Home Screen from third-party browsers; a site without app-capable manifest metadata remains a Home Screen bookmark.
- **Permission prompt:** Request permission only from direct user interaction (for example, a button tap). Apple also says to call the push subscription method immediately from that gesture’s event handler. `Notification.requestPermission()` and `PushManager.subscribe()` are secure-context APIs.
- **HTTPS:** Production pages, service workers, Push API subscription, push events, and `showNotification()` require a secure context, normally HTTPS. `localhost`/`127.0.0.1` are suitable local-development exceptions for secure-context testing.
- **Service worker flow:** An active service worker is required. The browser may start it when a message arrives and dispatches a `push` event to its global scope. The handler reads `event.data` and should use `event.waitUntil()` for asynchronous work, then display a user-visible notification with `registration.showNotification()`.
- **Safari limitation:** Safari does not support invisible pushes. Apple says to present a notification immediately after the service worker receives the push; otherwise Safari revokes the site’s push permission.
- **User controls:** Once granted, notification permission is managed per Home Screen web app in iOS/iPadOS Notification Settings. Notifications integrate with the Lock Screen, Notification Center, paired Apple Watch, and Focus modes.
- **Server requirements:** Use standards-based Web Push: retain the subscription endpoint and encryption keys, use VAPID, and send encrypted requests to the push service. Apple’s service documentation says network restrictions must allow `https://*.push.apple.com`; Apple says an Apple Developer Program membership is not required. Apple documents a 4 KB payload limit.
- **Other limitations:** Push subscriptions are tied to a service worker; subscription endpoints are capability URLs and must be kept secret. Availability and notification presentation still depend on OS/browser support and the user’s notification settings.

## Source URLs

- Apple/WebKit, Web Push for Web Apps on iOS and iPadOS: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Apple/WebKit, Safari 16.4 feature announcement: https://webkit.org/blog/13966/webkit-features-in-safari-16-4/
- Apple Developer, Sending web push notifications in web apps and browsers: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
- MDN, Notification.requestPermission(): https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static
- MDN, PushManager.subscribe(): https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
- MDN, ServiceWorkerGlobalScope `push` event: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/push_event
- MDN, Push API: https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- MDN, ServiceWorkerRegistration.showNotification(): https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification
- MDN, Making PWAs installable: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

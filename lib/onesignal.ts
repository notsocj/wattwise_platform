"use client";

type OneSignalApi = {
  init(options: {
    appId: string;
    serviceWorkerPath: string;
    serviceWorkerParam: { scope: string };
    notifyButton: { enable: boolean };
    allowLocalhostAsSecureOrigin: boolean;
  }): Promise<void>;
  login(externalId: string): Promise<void>;
  logout(): Promise<void>;
  Notifications: {
    requestPermission(): Promise<void>;
  };
  User: {
    PushSubscription: {
      id: string | null;
      optedIn: boolean;
      optIn(): Promise<void>;
      optOut(): Promise<void>;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalApi) => void | Promise<void>>;
  }
}

export type PushCapability = {
  supported: boolean;
  secureContext: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  subscriptionId: string | null;
};

let initializationPromise: Promise<OneSignalApi> | null = null;
let activeOneSignal: OneSignalApi | null = null;

export function getBrowserPushCapability(): PushCapability {
  if (typeof window === "undefined") {
    return {
      supported: false,
      secureContext: false,
      permission: "unsupported",
      subscribed: false,
      subscriptionId: null,
    };
  }

  const supported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return {
    supported,
    secureContext: window.isSecureContext,
    permission: supported ? Notification.permission : "unsupported",
    subscribed: activeOneSignal?.User.PushSubscription.optedIn ?? false,
    subscriptionId: activeOneSignal?.User.PushSubscription.id ?? null,
  };
}

export function isIosBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isInstalledPwa(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return Boolean(
    standaloneNavigator.standalone || window.matchMedia("(display-mode: standalone)").matches
  );
}

export async function initializeOneSignal(appId: string): Promise<OneSignalApi> {
  if (initializationPromise) return initializationPromise;

  const capability = getBrowserPushCapability();
  if (!capability.supported || !capability.secureContext) {
    throw new Error("Push notifications are not supported in this browser context.");
  }

  initializationPromise = new Promise<OneSignalApi>((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push(async (oneSignal) => {
      try {
        await oneSignal.init({
          appId,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: "/push/onesignal/" },
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: process.env.NODE_ENV === "development",
        });
        activeOneSignal = oneSignal;
        resolve(oneSignal);
      } catch (error) {
        initializationPromise = null;
        reject(error);
      }
    });

    if (!document.getElementById("wattwise-onesignal-sdk")) {
      const script = document.createElement("script");
      script.id = "wattwise-onesignal-sdk";
      script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      script.defer = true;
      script.onerror = () => {
        initializationPromise = null;
        reject(new Error("The OneSignal browser SDK could not be loaded."));
      };
      document.head.appendChild(script);
    }
  });

  return initializationPromise;
}

export async function loginOneSignal(appId: string, externalId: string) {
  const oneSignal = await initializeOneSignal(appId);
  await oneSignal.login(externalId);
}

export async function logoutOneSignal() {
  if (!activeOneSignal) return;
  await activeOneSignal.logout();
}

export async function readOneSignalPushCapability(appId: string): Promise<PushCapability> {
  await initializeOneSignal(appId);
  return getBrowserPushCapability();
}

export async function optInOneSignal(appId: string, externalId: string) {
  const oneSignal = await initializeOneSignal(appId);
  await oneSignal.login(externalId);

  if (Notification.permission !== "granted") {
    await oneSignal.Notifications.requestPermission();
  }

  if (Notification.permission !== "granted") {
    throw new Error("permission_not_granted");
  }

  await oneSignal.User.PushSubscription.optIn();
  return getBrowserPushCapability();
}

export async function optOutOneSignal(appId: string) {
  const oneSignal = await initializeOneSignal(appId);
  await oneSignal.User.PushSubscription.optOut();
  return getBrowserPushCapability();
}


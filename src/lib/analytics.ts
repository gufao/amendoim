import { createBro } from "@bro-sdk/web";

export const bro = createBro({
  apiKey: "bro_pk_z4ljx8tq9Jpx7XygtOyP2Er2",
  autoPageView: false,
  webPush: false,
});

// Track app events
export function trackEvent(event: string, props?: Record<string, unknown>) {
  try {
    bro.track(event, props);
  } catch {
    // Silently fail — analytics should never break the app
  }
}

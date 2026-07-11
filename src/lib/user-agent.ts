export function parseUserAgent(ua: string | null | undefined) {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Unknown" };

  let os = "Unknown";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ios/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome\//i.test(ua) && !/chromium/i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";

  const device = /mobile/i.test(ua) ? "Mobile" : /tablet|ipad/i.test(ua) ? "Tablet" : "Desktop";

  return { browser, os, device };
}

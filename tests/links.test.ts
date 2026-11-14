import { describe, expect, it } from "vitest";
import { createLinkToken, verifyLinkToken } from "@/lib/links";

describe("checkout links", () => {
  const base = { storeId: "s1", productId: "p1", quantity: 2, baseUrl: "https://shop.example.com/p/1?color=red", agent: "claude" };

  it("round-trips and adds tracking parameters", () => {
    const { token, payload } = createLinkToken(base);
    const v = verifyLinkToken(token);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const dest = new URL(v.payload.destination);
    expect(dest.host).toBe("shop.example.com");
    expect(dest.searchParams.get("color")).toBe("red");
    expect(dest.searchParams.get("wasl_ref")).toBe(payload.id);
    expect(dest.searchParams.get("utm_source")).toBe("wasl");
    expect(dest.searchParams.get("utm_campaign")).toBe("claude");
  });

  it("rejects a tampered token", () => {
    const { token } = createLinkToken(base);
    const [body, sig] = token.split(".");
    const forged = JSON.parse(Buffer.from(body!, "base64url").toString());
    forged.destination = "https://evil.example.com/";
    const forgedBody = Buffer.from(JSON.stringify(forged)).toString("base64url");
    expect(verifyLinkToken(`${forgedBody}.${sig}`)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects an expired token", () => {
    const { token } = createLinkToken({ ...base, ttlSeconds: 1 });
    expect(verifyLinkToken(token, Date.now() + 5000)).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects garbage", () => {
    expect(verifyLinkToken("nope").ok).toBe(false);
  });
});

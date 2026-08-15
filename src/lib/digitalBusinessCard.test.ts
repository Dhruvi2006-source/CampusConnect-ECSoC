import { describe, it, expect } from "vitest";
import {
  generateConnectQrPayload,
  parseConnectQrPayload,
  exportConnectionsToCsv,
  DEFAULT_SHARE_PERMISSIONS,
  type UserConnection,
} from "./digitalBusinessCard";

describe("Digital Business Card Exchange (#3020)", () => {
  describe("QR Payload Encoding and Parsing", () => {
    it("encodes user id, event id, and granular share permissions into JSON payload", () => {
      const permissions = {
        shareEmail: true,
        shareLinkedin: true,
        shareGithub: true,
        shareInstagram: false,
        sharePhone: false,
      };

      const qrString = generateConnectQrPayload("user_123", "evt_456", permissions);
      const parsed = parseConnectQrPayload(qrString);

      expect(parsed).not.toBeNull();
      expect(parsed?.userId).toBe("user_123");
      expect(parsed?.eventId).toBe("evt_456");
      expect(parsed?.permissions.shareLinkedin).toBe(true);
      expect(parsed?.permissions.shareGithub).toBe(true);
      expect(parsed?.permissions.sharePhone).toBe(false);
    });

    it("returns null for invalid or corrupted QR payload strings", () => {
      expect(parseConnectQrPayload("invalid-qr-string")).toBeNull();
      expect(parseConnectQrPayload(JSON.stringify({ foo: "bar" }))).toBeNull();
    });

    it("provides default share permissions", () => {
      expect(DEFAULT_SHARE_PERMISSIONS.shareEmail).toBe(true);
      expect(DEFAULT_SHARE_PERMISSIONS.shareLinkedin).toBe(true);
      expect(DEFAULT_SHARE_PERMISSIONS.sharePhone).toBe(false);
    });
  });

  describe("CSV Network Export", () => {
    it("formats user network connections into CSV format", () => {
      const connections: UserConnection[] = [
        {
          id: "conn_1",
          name: "Alex Smith",
          email: "alex@university.edu",
          linkedin: "https://linkedin.com/in/alexsmith",
          github: "https://github.com/alexsmith",
          eventName: "Fall Career Fair 2026",
          connectedAt: "2026-08-15T10:00:00Z",
        },
      ];

      const csv = exportConnectionsToCsv(connections);

      expect(csv).toContain("Full Name,Email,LinkedIn,GitHub");
      expect(csv).toContain('"Alex Smith"');
      expect(csv).toContain('"alex@university.edu"');
      expect(csv).toContain('"Fall Career Fair 2026"');
    });
  });
});

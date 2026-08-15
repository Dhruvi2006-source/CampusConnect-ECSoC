import { createClient } from "./supabase/client";

export interface SharePermissions {
  shareEmail: boolean;
  shareLinkedin: boolean;
  shareGithub: boolean;
  shareInstagram: boolean;
  sharePhone: boolean;
}

export interface ConnectQrPayload {
  version: "1.0";
  userId: string;
  eventId?: string;
  permissions: SharePermissions;
  timestamp: number;
}

export interface UserConnection {
  id: string;
  name: string;
  email?: string;
  linkedin?: string;
  github?: string;
  instagram?: string;
  phone?: string;
  eventName?: string;
  connectedAt: string;
}

export const DEFAULT_SHARE_PERMISSIONS: SharePermissions = {
  shareEmail: true,
  shareLinkedin: true,
  shareGithub: false,
  shareInstagram: false,
  sharePhone: false,
};

/**
 * Encodes user connection information and granular privacy permissions into a QR code payload.
 */
export function generateConnectQrPayload(
  userId: string,
  eventId?: string,
  permissions: SharePermissions = DEFAULT_SHARE_PERMISSIONS,
): string {
  const payload: ConnectQrPayload = {
    version: "1.0",
    userId,
    eventId,
    permissions,
    timestamp: Date.now(),
  };

  return JSON.stringify(payload);
}

/**
 * Parses and validates scanned QR code payload strings.
 */
export function parseConnectQrPayload(rawQrString: string): ConnectQrPayload | null {
  try {
    const data = JSON.parse(rawQrString) as ConnectQrPayload;
    if (!data.userId || data.version !== "1.0") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Swaps digital business cards via Supabase RPC, storing connection permissions and event context.
 */
export async function swapDigitalBusinessCards(
  targetUserId: string,
  eventId?: string,
  permissions: SharePermissions = DEFAULT_SHARE_PERMISSIONS,
): Promise<{ success: boolean; message: string; connectionId?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("swap_digital_business_cards", {
    p_target_user_id: targetUserId,
    p_event_id: eventId ?? null,
    p_shared_permissions: permissions as unknown as Record<string, unknown>,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const res = data?.[0];
  return {
    success: res?.success ?? false,
    message: res?.message ?? "Digital business card swapped.",
    connectionId: res?.connection_id ?? undefined,
  };
}

/**
 * Formats a user's network connections into an exportable CSV string.
 * Columns: Name, Email, LinkedIn, GitHub, Instagram, Phone, Event Met, Connected Date
 */
export function exportConnectionsToCsv(connections: UserConnection[]): string {
  const headers = [
    "Full Name",
    "Email",
    "LinkedIn",
    "GitHub",
    "Instagram",
    "Phone",
    "Event Met",
    "Connected Date",
  ];

  const rows = connections.map((c) => [
    `"${(c.name || "Student Connection").replace(/"/g, '""')}"`,
    `"${(c.email || "").replace(/"/g, '""')}"`,
    `"${(c.linkedin || "").replace(/"/g, '""')}"`,
    `"${(c.github || "").replace(/"/g, '""')}"`,
    `"${(c.instagram || "").replace(/"/g, '""')}"`,
    `"${(c.phone || "").replace(/"/g, '""')}"`,
    `"${(c.eventName || "Campus Event").replace(/"/g, '""')}"`,
    `"${new Date(c.connectedAt).toLocaleDateString("en-US")}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

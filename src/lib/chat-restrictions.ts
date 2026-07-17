// Users restricted from sending messages (DMs + group chat composer hidden).
// User IDs only — never store names or email addresses in client-shipped code.
export const CHAT_RESTRICTED_USER_IDS = new Set<string>([
  "26334add-72c1-462f-8548-025861af0b8d",
  "c5202fdd-2302-4152-8d0d-881abb4a71c8",
]);

export function isChatRestricted(userId: string | null | undefined): boolean {
  return !!userId && CHAT_RESTRICTED_USER_IDS.has(userId);
}

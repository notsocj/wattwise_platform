/**
 * Recognises a plain "turn <device> on/off now" request without the model.
 * The model tends to copy its own earlier refusals from chat history, so these
 * commands are resolved in code; anything with a time or an amount is left to
 * the model, which turns it into a scheduled turn-off.
 */

const ON = /\b(?:turn|switch|power)\s+on\b|\b(?:turn|switch)\s+[\p{L}\p{N}\s'-]{1,40}?\s+on\b|\b(?:buksan|i-?on|paandarin)\b/iu;
const OFF = /\b(?:turn|switch|power)\s+off\b|\b(?:turn|switch)\s+[\p{L}\p{N}\s'-]{1,40}?\s+off\b|\b(?:patayin|i-?off|isara)\b/iu;
const SCHEDULE = /\b(?:at|ng|by|after|pag|kapag|when|until|hanggang|tonight|mamaya|tomorrow|bukas|later)\b|\d\s*(?:am|pm)\b|\d{1,2}:\d{2}|₱|\bphp\b|\bpesos?\b|\bkwh\b/i;

export function detectPowerCommand(
  message: string,
  devices: ReadonlyArray<{ ref: string; name: string }>
): { device_ref: string; on: boolean } | null {
  const text = message.toLowerCase().replace(/\s+/g, " ");
  const on = ON.test(text);
  const off = OFF.test(text);
  if (on === off || SCHEDULE.test(text)) return null;

  // The longest device name found in the message wins ("test" vs "test fan").
  const named = devices
    .filter((device) => device.name.trim() && text.includes(device.name.toLowerCase().replace(/\s+/g, " ").trim()))
    .sort((a, b) => b.name.length - a.name.length);
  if (!named.length) return null;
  return { device_ref: named[0].ref, on };
}

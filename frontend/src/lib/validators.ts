/**
 * Client-side validators for the candidate application form.
 * Each validator returns an error message (RU) or null when valid.
 */

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const NAME_RE = /^[A-Za-zА-Яа-яЁё\s-]+$/u;

export const KG_PHONE_PREFIX = '+996';
export const KG_PHONE_DIGITS = 9;

export function validateName(value: string): string | null {
  const v = value.trim();
  if (!v) return 'Заполните это поле';
  if (v.length < 2) return 'Слишком короткое значение';
  if (!NAME_RE.test(v)) return 'Только буквы, пробелы и дефис';
  return null;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): string | null {
  const v = normalizeEmail(value);
  if (!v) return 'Заполните это поле';
  if (v.includes('..')) return 'Введите корректный email';
  if (!EMAIL_RE.test(v)) return 'Введите корректный email';
  return null;
}

/** Strip everything except digits, drop a leading 996 country code, cap at 9 digits. */
export function normalizePhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('996')) digits = digits.slice(3);
  return digits.slice(0, KG_PHONE_DIGITS);
}

/** Format national digits for display: "508100165" -> "508 100 165" (partial groups ok, max 9 digits).
 * No country prefix — the input already shows a +996 block on the left. */
export function formatPhoneDisplay(digits: string): string {
  if (!digits) return '';
  const clean = digits.replace(/\D/g, '').slice(0, KG_PHONE_DIGITS);
  const parts = [clean.slice(0, 3), clean.slice(3, 6), clean.slice(6, 9)].filter(Boolean);
  return parts.join(' ');
}

/** E.164 for the backend: "+996508100165". */
export function toE164(digits: string): string {
  return `${KG_PHONE_PREFIX}${digits}`;
}

export function validatePhoneDigits(digits: string): string | null {
  if (!digits) return 'Заполните это поле';
  if (digits.length !== KG_PHONE_DIGITS) return 'Введите 9 цифр номера';
  return null;
}

export function validateDepartment(value: string): string | null {
  if (!value) return 'Выберите отдел';
  return null;
}

export function validatePlannedDate(value: string): string | null {
  if (!value) return 'Выберите дату';
  // "YYYY-MM-DD" strings compare lexicographically — safe for this format.
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  if (value < `${yyyy}-${mm}-${dd}`) return 'Выберите дату не раньше сегодняшней';
  return null;
}

export function validateMinLength(value: string, min = 2): string | null {
  const v = value.trim();
  if (!v) return 'Заполните это поле';
  if (v.length < min) return 'Слишком короткое значение';
  return null;
}

export function validateConsent(given: boolean): string | null {
  if (!given) return 'Необходимо согласие на обработку персональных данных';
  return null;
}

// Phone normalisation for call leads. Ugandan numbers become +256…
// so "0772 123456", "772123456" and "+256 772 123 456" all dedupe to
// the same lead. Foreign numbers keep their country code.

/**
 * Normalise a raw phone cell to "+<digits>", or null when it can't be a
 * callable number. Cells holding several numbers
 * ("0772 123456 / 0701 654321") use the first.
 */
export function normalizeUgPhone(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null
  const first = String(raw).split(/[/,;|]|\bor\b/i)[0] ?? ''
  const hasPlus = first.trim().startsWith('+')
  let digits = first.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) digits = digits.slice(2)

  if (digits.startsWith('256')) {
    // 256 + 9-digit national number; tolerate a stray trunk 0 ("2560772…").
    let national = digits.slice(3)
    if (national.length === 10 && national.startsWith('0')) national = national.slice(1)
    return national.length === 9 ? `+256${national}` : null
  }
  if (!hasPlus && digits.length === 10 && digits.startsWith('0')) return `+256${digits.slice(1)}`
  if (!hasPlus && digits.length === 9 && /^[2-7]/.test(digits)) return `+256${digits}`
  // Another country's number written with its code.
  if (digits.length >= 10 && digits.length <= 15 && !digits.startsWith('0')) return `+${digits}`
  return null
}

/** Digits-only key, matching the generated call_leads.phone_normalized. */
export function phoneKey(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}

/** wa.me link for a normalised number. */
export function whatsappLink(phone: string | null | undefined): string | null {
  const digits = phoneKey(phone)
  return digits.length >= 10 ? `https://wa.me/${digits}` : null
}

/** "+256 772 123 456" for display. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const m = phone.match(/^\+256(\d{3})(\d{3})(\d{3})$/)
  return m ? `+256 ${m[1]} ${m[2]} ${m[3]}` : phone
}

export function passwordStrength(password) {
  const pw = password || "";
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong", "Excellent"];
  const colors = ["var(--danger)", "var(--danger)", "var(--important)", "var(--important)", "var(--success)", "var(--success)"];
  return {
    score,
    label: pw ? labels[score] : "",
    color: colors[score],
    percent: Math.min(100, (score / 5) * 100),
  };
}

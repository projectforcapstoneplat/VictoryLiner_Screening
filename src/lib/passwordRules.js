export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 10 characters', test: (pw) => pw.length >= 10 },
  { id: 'lowercase', label: 'A lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { id: 'uppercase', label: 'An uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'number', label: 'A number', test: (pw) => /[0-9]/.test(pw) },
];

export function getPasswordChecklist(password) {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, passed: rule.test(password) }));
}

export function isPasswordValid(password) {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

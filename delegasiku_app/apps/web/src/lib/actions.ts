/**
 * Human-readable labels for delegation action keys.
 * The `allowedAction` field stores a stable machine key (snake_case);
 * these map it to a friendly label for non-technical users (§12.5).
 */

const ACTION_LABELS: Record<string, string> = {
  submit_building_permit_documents: 'Submit building permit documents',
  apply_permit_application: 'Apply for a permit',
  respond_to_inquiry: 'Respond to an inquiry',
  sign_documents: 'Sign documents',
  collect_documents: 'Collect documents',
  correlation_test: 'Submit building permit documents',
};

/**
 * Convert an action key (snake_case) into a human-readable label.
 * Falls back to a title-cased version of the key if no mapping exists.
 */
export function actionLabel(key: string | null | undefined): string {
  if (!key) return '—';
  if (ACTION_LABELS[key]) return ACTION_LABELS[key];
  // Fallback: "submit_permit" → "Submit permit"
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/** Preset options for the create-delegation form (key + label pairs). */
export const ACTION_OPTIONS: { key: string; label: string }[] = [
  { key: 'submit_building_permit_documents', label: 'Submit building permit documents' },
  { key: 'respond_to_inquiry', label: 'Respond to an inquiry' },
  { key: 'sign_documents', label: 'Sign documents' },
  { key: 'collect_documents', label: 'Collect documents' },
];

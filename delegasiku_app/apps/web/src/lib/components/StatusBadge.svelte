<script lang="ts">
  /**
   * Status badge — text + icon, never color alone (§12.5)
   */
  export let status: string;

  const config: Record<string, { label: string; icon: string; classes: string }> = {
    ACTIVE: { label: 'Active', icon: '✓', classes: 'bg-[var(--status-active-bg)] text-[var(--status-active)]' },
    REVOKED: { label: 'Revoked', icon: '✕', classes: 'bg-[var(--status-revoked-bg)] text-[var(--status-revoked)]' },
    EXPIRED: { label: 'Expired', icon: '◷', classes: 'bg-[var(--status-expired-bg)] text-[var(--status-expired)]' },
    NOT_VALID: { label: 'Not Valid', icon: '⊘', classes: 'bg-[var(--status-invalid-bg)] text-[var(--status-invalid)]' },
    PENDING_VERIFICATION: { label: 'Pending Verification', icon: '◷', classes: 'bg-[var(--status-pending-bg)] text-[var(--status-pending)]' },
    PENDING_ACCEPTANCE: { label: 'Pending Acceptance', icon: '◷', classes: 'bg-[var(--status-pending-bg)] text-[var(--status-pending)]' },
    INVITED: { label: 'Invited', icon: '✉', classes: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
    DRAFT: { label: 'Draft', icon: '✎', classes: 'bg-[var(--muted)] text-[var(--muted-foreground)]' },
  };

  $: c = config[status] ?? { label: status, icon: '•', classes: 'bg-[var(--muted)] text-[var(--muted-foreground)]' };
</script>

<span
  class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium {c.classes}"
  role="status"
>
  <span aria-hidden="true">{c.icon}</span>
  <span>{c.label}</span>
</span>

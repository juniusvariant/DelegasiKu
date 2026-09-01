<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { api, ApiError } from '$lib/api';
  import { actionLabel } from '$lib/actions';
  import QrCode from '$lib/components/QrCode.svelte';

  type Step = 'review' | 'verify' | 'scan' | 'accept' | 'done' | 'error';

  let step = $state<Step>('review');
  let scope = $state<{ allowedAction: string; validFrom: string; expiresAt: string } | null>(null);
  let simulation = $state(false);
  let verificationUrl = $state('');
  let error = $state('');
  let busy = $state(false);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  const token = $derived($page.params.token);

  onMount(async () => {
    try {
      const res = await api.resolveInvitation(token);
      scope = res.scopeSnapshot;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Invitation invalid or expired';
      step = 'error';
    }
  });

  onDestroy(() => {
    stopPolling();
  });

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function consent() {
    busy = true;
    try {
      await api.recordConsent(token);
      // After consent, immediately start verification to get the QR (LIVE)
      // or auto-complete (DEMO).
      await startVerification();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed';
    } finally {
      busy = false;
    }
  }

  async function startVerification() {
    const res = await api.startVerification(token);
    simulation = res.simulationMode;
    if (res.simulationMode) {
      // DEMO: completes instantly via worker → go straight to accept
      step = 'accept';
    } else {
      // LIVE: show the QR/wallet URL and wait for the holder to scan+approve
      verificationUrl = res.verificationUrl ?? '';
      step = 'scan';
      startPolling();
    }
  }

  function startPolling() {
    // Poll every 2 seconds to check if verification completed
    pollInterval = setInterval(async () => {
      try {
        const status = await api.checkInvitationStatus(token);
        if (status.canAccept) {
          // Verification complete! Move to accept step
          stopPolling();
          step = 'accept';
        } else if (status.isFailed) {
          // Verification failed
          stopPolling();
          error = 'Verification failed. Please contact support or try again.';
          step = 'error';
        }
        // If still pending, keep polling
      } catch (e) {
        // Invitation became invalid (expired, revoked, etc)
        stopPolling();
        error = e instanceof Error ? e.message : 'Invitation unavailable';
        step = 'error';
      }
    }, 2000);
  }

  async function accept() {
    busy = true;
    error = ''; // Clear any previous errors
    try {
      await api.acceptDelegation(token);
      stopPolling();
      step = 'done';
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NOT_PENDING_ACCEPTANCE') {
        // Verification still processing — keep polling, show temporary message
        error = 'Verification still processing. Please wait...';
        return;
      }
      error = e instanceof Error ? e.message : 'Acceptance failed';
      step = 'error';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Delegation Invitation — DelegasiKu</title></svelte:head>

<main class="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
  <div class="rounded-2xl border bg-[var(--card)] p-4 shadow-sm sm:p-6">
    {#if step === 'error'}
      <h1 class="text-xl font-semibold text-[var(--status-revoked)]">✕ Invitation unavailable</h1>
      <p class="mt-3 text-[var(--muted-foreground)]">{error}</p>

    {:else if step === 'review' && scope}
      <h1 class="text-xl font-semibold">Delegation Request</h1>
      <p class="mt-2 text-sm text-[var(--muted-foreground)]">
        An organization requests your verified identity to delegate the following authority:
      </p>
      <div class="mt-5 rounded-lg bg-[var(--muted)] p-4">
        <p class="text-sm text-[var(--muted-foreground)]">Authorized action</p>
        <p class="mt-1 font-medium">{actionLabel(scope.allowedAction)}</p>
        <p class="mt-3 text-xs text-[var(--muted-foreground)]">
          Valid until {new Date(scope.expiresAt).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}
        </p>
      </div>
      <p class="mt-4 text-xs text-[var(--muted-foreground)]">
        By continuing, you consent to identity verification via e.id. Only a minimized verification
        result is stored — never your raw identity data.
      </p>
      <button onclick={consent} disabled={busy} class="mt-6 min-h-[48px] w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-medium text-[var(--primary-foreground)] disabled:opacity-50">
        {busy ? 'Processing…' : 'Consent & Continue'}
      </button>

    {:else if step === 'scan'}
      <h1 class="text-xl font-semibold">Waiting for Verification</h1>
      <p class="mt-2 text-sm text-[var(--muted-foreground)]">
        Scan this QR code with your <strong>e.id wallet app</strong> and approve the credential
        presentation. We'll automatically detect when you're verified.
      </p>

      <div class="mt-5">
        <QrCode data={verificationUrl} size={220} />
      </div>

      {#if verificationUrl}
        <a
          href={verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="mt-4 block break-all text-center text-sm text-[var(--primary)] hover:underline"
        >
          Open in e.id wallet →
        </a>
      {/if}

      <div class="mt-6 rounded-lg bg-[var(--muted)] p-3">
        <div class="flex items-center gap-2">
          <div class="h-2 w-2 animate-pulse rounded-full bg-[var(--primary)]"></div>
          <p class="text-xs text-[var(--muted-foreground)]">
            Waiting for approval in your wallet app...
          </p>
        </div>
        {#if error}
          <p class="mt-2 text-xs text-[var(--status-pending)]">{error}</p>
        {/if}
      </div>

    {:else if step === 'accept'}
      <h1 class="text-xl font-semibold text-[var(--status-active)]">✓ Verified</h1>
      {#if simulation}
        <p class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--status-pending-bg)] px-2.5 py-0.5 text-xs text-[var(--status-pending)]">
          <span aria-hidden="true">⚠</span> Simulation mode
        </p>
      {/if}
      <p class="mt-3 text-sm text-[var(--muted-foreground)]">
        Your identity is verified. Accept the delegation scope to activate it.
      </p>
      <button onclick={accept} disabled={busy} class="mt-6 min-h-[48px] w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-medium text-[var(--primary-foreground)] disabled:opacity-50">
        {busy ? 'Activating…' : 'Accept & Activate'}
      </button>

    {:else if step === 'done'}
      <h1 class="text-xl font-semibold text-[var(--status-active)]">✓ Delegation Active</h1>
      <p class="mt-3 text-sm text-[var(--muted-foreground)]">
        The delegation is now active. Present your proof QR/link to any checker to show its current
        status.
      </p>
    {:else}
      <p class="text-[var(--muted-foreground)]">Loading invitation…</p>
    {/if}
  </div>
</main>

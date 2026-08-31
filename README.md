# DelegasiKu

**Verified representation and delegation for high-trust workflows.**

DelegasiKu turns a verified identity into a case-specific, expiring, and revocable authorization to act on behalf of someone else. Identity verification proves *who* a person is; DelegasiKu proves *whether that verified person is currently authorized* to perform a specific action, for a specific organization, in a specific case — and lets anyone check that status in real time.

> KYC tells us who a person is. DelegasiKu tells us whether that verified person may act here, for this purpose, right now.

## The problem

Organizations receiving permit, investment, legal, property, and other high-trust submissions often know a representative's identity but not whether that person is *currently authorized* to act. Today's workarounds — KTP copies, informal letters, chat messages, manual phone confirmation — are static, hard to revoke, and ambiguous at the exact moment a decision is needed.

## What DelegasiKu does

DelegasiKu binds a verified representative to:

- **One organization** that authorized them
- **One case** they may act on
- **One exact action** they may perform
- **One validity period** with a clear expiry
- **One revocable, publicly checkable proof**

A receiving party scans a QR code or opens a link and immediately sees the current status — `ACTIVE`, `REVOKED`, or `EXPIRED` — along with only the minimum facts needed to make a decision. The same proof updates in real time when the organization revokes it.

## How it works

1. **Create** — an organization creates a case-bound delegation and shares a secure invitation.
2. **Verify & accept** — the representative verifies their identity and explicitly accepts the exact scope.
3. **Check** — a receiving party scans the proof and sees the current authorization status.
4. **Revoke** — the organization can revoke at any time; the proof reflects it instantly.

DelegasiKu sits on top of a trusted identity-verification layer and adds the delegation, expiry, revocation, and audit workflow on top of it. It does not replace identity verification — it makes a verified identity *actionable* in real workflows.

## Use cases

Starting with permit representation, the same core model extends to regulated workflows where one party acts for another: investment, workforce, corporate, legal, property, and insurance.

## Status

Early-stage product (competition MVP). The current build demonstrates a complete verified-delegation lifecycle for a permit-representation scenario using a labeled demo organization and a verified representative identity.

## Author

Built and maintained by **[juniusvariant](https://github.com/juniusvariant)**.

## License

Proprietary — All Rights Reserved. See [`LICENSE.md`](./LICENSE.md). No use, copying, modification, or distribution is permitted without the author's prior written permission.

## Legal notice

DelegasiKu provides workflow evidence that a verified representative accepted a purpose-limited authorization. It is not a legally enforceable power of attorney and does not verify an organization's legal authority through an external registry.

import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Per-user credit / quota accounting for resource-heavy tools.
 *
 * RACE-CONDITION DEFENSE
 * ----------------------
 * The whole point of this module is to make "check remaining, then spend"
 * atomic. A naive read-then-write is vulnerable to double-spend: two concurrent
 * requests both read `credits = 1`, both pass the check, both proceed. We avoid
 * that by doing the check-and-decrement inside a Firestore transaction — the SDK
 * serialises conflicting transactions and automatically RETRIES the loser with
 * fresh data, so the balance can never go below zero.
 *
 * All writes happen here on the server via the Admin SDK, which BYPASSES the
 * Firestore security rules. The rules (firestore.rules) forbid every client
 * write to `users/*`, so a client can never tamper with its own balance.
 */

/** Credits granted to a brand-new account on first use. */
export const INITIAL_CREDITS = 20;

export class InsufficientCreditsError extends Error {
  constructor(public readonly remaining: number) {
    super("INSUFFICIENT_CREDITS");
    this.name = "InsufficientCreditsError";
  }
}

const userRef = (uid: string) => adminDb.collection("users").doc(uid);

/**
 * Atomically verify the user has at least `cost` credits and deduct them.
 * Auto-provisions the account with INITIAL_CREDITS on first use (also atomic).
 *
 * @returns the remaining balance after the deduction.
 * @throws  InsufficientCreditsError if the balance would go negative.
 */
export async function consumeCredit(uid: string, cost = 1): Promise<number> {
  if (!Number.isInteger(cost) || cost <= 0) {
    throw new Error("cost phải là số nguyên dương.");
  }

  const ref = userRef(uid);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      // First-time account: seed then spend, all in this transaction.
      const remaining = INITIAL_CREDITS - cost;
      if (remaining < 0) throw new InsufficientCreditsError(INITIAL_CREDITS);
      tx.set(ref, {
        credits: remaining,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return remaining;
    }

    const current = (snap.get("credits") as number | undefined) ?? 0;
    if (current < cost) throw new InsufficientCreditsError(current);

    const remaining = current - cost;
    tx.update(ref, {
      credits: remaining,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return remaining;
  });
}

/** Read the current balance (provisioning the account lazily if missing). */
export async function getCredits(uid: string): Promise<number> {
  const snap = await userRef(uid).get();
  if (!snap.exists) return INITIAL_CREDITS;
  return (snap.get("credits") as number | undefined) ?? 0;
}

/** Grant credits (e.g. top-up). Atomic increment; creates the doc if needed. */
export async function grantCredits(uid: string, amount: number): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("amount phải là số nguyên dương.");
  }
  // merge: true so an existing balance is incremented, not overwritten.
  // createdAt is intentionally left untouched here to avoid clobbering it on
  // existing docs; consumeCredit() is what seeds a fresh account.
  await userRef(uid).set(
    {
      credits: FieldValue.increment(amount),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

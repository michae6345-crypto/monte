# PayPal + AI demo path

For the PayPal AI Hackathon video. Runs about 2:40; the limit is under 3:00. Lines marked
**VO** are the voiceover. The figures are what the engine gives Jordan after a fresh page load.

## Before you record

- [ ] `curl https://ace-eta-beryl.vercel.app/api/health` says `"paypal":"sandbox"` and `"agent":"ready"`.
- [ ] Sign out of any real PayPal account in this browser, and allow pop-ups for the site.
- [ ] Have a sandbox personal account's login ready (dashboard, Testing Tools, Sandbox Accounts).
      It doesn't go in this repo.
- [ ] Reload the page. Cap counters from earlier takes live in memory, so a reload resets them.
- [ ] Check the rules on what can be on screen: the video "must not include third party
      trademarks, or copyrighted music or other material" without permission. Tap shows issuer
      card art and store logos. The TrojanHacks film's soundtrack can't be reused.

## The path

### 1. Jordan at Trader Joe's (0:00 to 0:20)

1. Open `https://ace-eta-beryl.vercel.app/#tap-view`, which lands on the Tap view. Jordan is
   the default person.
2. In the store list, click **Trader Joe's**.

> **VO:** This is Jordan: 24, first job in LA, three credit cards, and a $2,800 balance on one
> of them. Jordan's at Trader Joe's, about to pay. Which card should it be?

### 2. Tap ranks the cards (0:20 to 0:45)

1. Hold on the phone: **Amex Gold, +$2.57**.
2. Point at **Every card, ranked** on the right, with Apple Card struck through as carrying a balance.

> **VO:** Monte's rules engine ranks every card for this purchase, using published issuer terms
> and how much of each spending cap is already gone. It never recommends a card with a balance,
> because new purchases there start charging interest today.

### 3. The agent explains the pick (0:45 to 1:20)

1. Scroll to the two PayPal panels.
2. In **Or tell Monte what you're buying**, click **Try: I'm spending $84 on groceries at
   Trader Joe's.** and then **Ask**.
3. When the answer appears, hold on it and on the engine's card below it: **Amex Gold**,
   **+$3.36 on this $84.00**, **$24,916.00 of $25,000 left this year after this purchase**.

> **VO:** Or Jordan can just say it. Claude reads the sentence and calls two tools. The first
> runs our deterministic engine. Claude picks nothing and computes nothing: every number on
> screen comes from the engine, and if Claude's reply contains one that didn't, we throw the
> reply away. The second tool sets up a PayPal order for the engine's amount.

### 4. PayPal sandbox checkout (1:20 to 2:00)

1. Point at the **PayPal sandbox, no real money** badge.
2. Click the **PayPal** button under the agent's answer.
3. Log in with the sandbox account in PayPal's window and approve the payment.

> **VO:** The agent can propose a payment, but it can't make one. Jordan approves it in PayPal's
> own window, and nothing is charged without that click. In a real wallet, this is where Jordan
> chooses Amex Gold. This is PayPal's sandbox, so no real money moves.

### 5. The receipt updates the cap (2:00 to 2:40)

1. Hold on the receipt line: **Paid $84.00 at Trader Joe's**, then **Amex Gold +$3.36 · Cap room
   $25,000.00 → $24,916.00 of $25,000 this year**.
2. Point at the left panel. For the $64.20 Trader Joe's purchase it now says
   **$24,851.80 of $25,000 left this year after this purchase**.

> **VO:** The payment's captured, the receipt prints, and the spending cap moves, so the next
> purchase is ranked against what's really left. PayPal moves the money. Claude explains it.
> The math stays deterministic, and every dollar traces back to an issuer's published terms.

## If something goes wrong

| What you see | What to do |
|---|---|
| "PayPal isn't connected on this deployment" | `NEXT_PUBLIC_PAYPAL_CLIENT_ID` was missing at build time. Set it and redeploy. |
| "The assistant isn't connected on this deployment" | Set `ANTHROPIC_API_KEY` and redeploy. |
| "Your browser blocked PayPal's window" | Allow pop-ups for the site. |
| The cap doesn't start at $25,000.00 | An earlier take is still in memory. Reload. |

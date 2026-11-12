# PayPal + AI demo path

For the PayPal AI Hackathon video. Runs about 2:45; the limit is under 3:00. Lines marked
**VO** are the voiceover. The figures are what the engine gives Jordan after a fresh page load. The **Pay with PayPal**
panel checks out the selected store's purchase ($64.20 at Trader Joe's). If you use the
agent's example sentence instead, the amount is $84.00 (+$3.36, cap $25,000.00 → $24,916.00).

## Before you record

- [ ] `curl https://ace-eta-beryl.vercel.app/api/health` says `"paypal":"sandbox"` and `"agent":"ready"`.
- [ ] Sign out of any real PayPal account in this browser, and allow pop-ups for the site.
- [ ] Sandbox buyer login ready: a sandbox personal account from developer.paypal.com,
      Testing Tools, Sandbox Accounts. It doesn't go in this repo.
- [ ] Reload the page. Cap counters from earlier takes live in memory, so a reload resets them.
- [ ] No card art and no store logos on screen. The rules say the video "must not include
      third party trademarks" without permission. Tap shows issuer card art and store logos,
      so crop or zoom past them, or blur them in the edit.
- [ ] No copyrighted music. The TrojanHacks film's soundtrack can't be reused.

## The path

### 1. Tap ranks the cards (0:00 to 0:30)

1. Open `https://ace-eta-beryl.vercel.app/#tap-view`. Jordan is the default person.
2. In the store list, click **Trader Joe's**.
3. Hold on the pick, **Amex Gold, +$2.57**, and on **Every card, ranked**, with Apple Card struck
   through as carrying a balance.

> **VO:** This is Jordan: 24, first job in LA, three credit cards, and a $2,800 balance on one
> of them. Jordan's at Trader Joe's. Monte's rules engine ranks every card using published
> issuer terms and how much of each spending cap is already used. It never picks a card with a
> balance, because new purchases there start charging interest today.

### 2. Pay Later vs. card interest (0:30 to 0:50)

1. Scroll to **Pay with PayPal**. Under it, hold on **Pay Later vs. your card's interest**: the
   Pay in 4 schedule next to what the same purchase would cost in interest on the card with
   the balance.

> **VO:** If Jordan can't pay this off now, Monte shows what Pay in 4 looks like next to the
> interest on the card that already carries a balance. Same price, spread out, no interest.

### 3. PayPal checkout (0:50 to 1:25)

1. Point at the **PayPal sandbox, no real money** badge.
2. Click the **PayPal** button in the **Pay with PayPal** panel.
3. Log in with the sandbox buyer in PayPal's window and approve.

> **VO:** Monte proposes; Jordan approves in PayPal's own window. Nothing is charged without
> that click. This is PayPal's sandbox, so no real money moves.

### 4. The receipt moves the cap (1:25 to 1:50)

1. Hold on the receipt: **Paid $64.20 at Trader Joe's**, then
   **Amex Gold +$2.57 · Cap room $25,000.00 → $24,935.80 of $25,000 this year**.

> **VO:** The payment's captured and the spending cap moves, so the next purchase is ranked
> against what's really left.

### 5. Return it (1:50 to 2:25)

Pick one:

- **Button:** under the receipt, leave the amount blank and click **Return it**.
- **Agent:** in **Or tell Monte what you're buying**, click
  **Try: return the Trader Joe's purchase.**, then **Ask**. Monte shows **Confirm the
  return**. Click **Confirm**.

Then hold on the line that appears: **Refunded $64.20 · −$2.57 rewards · $64.20 cap room back**.

> **VO:** Returns work the same way. Claude can propose a refund, but nothing goes back until
> Jordan confirms. PayPal refunds the capture, the reward comes off, and the cap room comes back.
> Claude never computes a number: every figure on screen comes from the engine.

### 6. The activity table (2:25 to 2:45)

1. Scroll below the checkout panels to the PayPal activity table. This session's purchase is
   there with the card Monte played, the reward and the refund status.
2. Optional: open `/paypal` and click **Load PayPal history** to show the sandbox account's
   history from Transaction Search. That page starts a fresh session, so this take's checkout
   only shows on the home page table.

> **VO:** Every PayPal purchase, the card Monte played on it, what it earned and what came back.
> PayPal moves the money. Claude explains it. The math stays deterministic.

## If something goes wrong

| What you see | What to do |
|---|---|
| "PayPal isn't connected on this deployment" | `NEXT_PUBLIC_PAYPAL_CLIENT_ID` was missing at build time, or the server keys are missing. Set them and redeploy. |
| "The assistant isn't connected on this deployment" | Set `ANTHROPIC_API_KEY` and redeploy. |
| "Your browser blocked PayPal's window" | Allow pop-ups for the site. |
| "That payment wasn't made through Monte, so Monte can't return it." | Returns only work on checkouts made in this page session. Pay first, then return. |
| The cap doesn't start at $25,000.00 | An earlier take is still in memory. Reload. |

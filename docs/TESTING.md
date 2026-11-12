# Testing Monte

For judges. Everything runs in PayPal's sandbox: no real money moves.

## Where

- Live: https://ace-eta-beryl.vercel.app/#tap-view
- PayPal activity on its own: https://ace-eta-beryl.vercel.app/paypal
- Health check: https://ace-eta-beryl.vercel.app/api/health. `"paypal":"sandbox"` and
  `"agent":"ready"` mean both are connected.
- Sandbox buyer login: (see Devpost testing notes). Allow pop-ups for the site, and sign out
  of any real PayPal account first.

## Try this (about 3 minutes)

1. Open the live link. Jordan is the default person. Click **Trader Joe's** in the store list.
   Monte ranks every card and picks **Amex Gold**. Apple Card is struck through because it
   carries a balance.
2. Scroll to **Pay with PayPal**. Below it, **Pay Later vs. your card's interest** compares
   Pay in 4 with the interest on the card that has a balance.
3. Click the **PayPal** button, log in as the sandbox buyer and approve. A receipt appears:
   **Paid $64.20 at Trader Joe's**, the reward, and the spending cap moving down.
4. Return it, one of two ways:
   - Click **Return it** under the receipt (blank amount returns it all, or type a partial amount).
   - In **Or tell Monte what you're buying**, click **Try: return the Trader Joe's purchase.**,
     then **Ask**, then **Confirm**.
   A line shows the refund, the reward taken back and the cap room returned.
5. Scroll down to the PayPal activity table. The purchase is listed with the card Monte
   played, the reward and its refund status.

## What each button does

| Button | What should happen |
|---|---|
| Store in the list | Re-ranks every card for that purchase |
| **PayPal** | Opens PayPal's sandbox window. Nothing is charged until you approve there |
| **Ask** | Claude reads the sentence; the rules engine picks the card and does the math. For a purchase it shows a PayPal button for the engine's amount |
| **Try: …** links | Fill the box with an example sentence. The return example appears after a checkout |
| **Return it** | Refunds the capture in the sandbox and puts the cap room back |
| **Confirm** / **Cancel** | Confirm sends the refund the agent proposed. Cancel drops it; nothing is refunded |
| **Load PayPal history** | Reads the sandbox account's purchases from PayPal Transaction Search |
| **Import PayPal purchases (sandbox)** | Adds those purchases to the current person's year. Pressing it twice adds nothing |

## "Not configured" messages

These mean a key is missing on that deployment, not that the app crashed. The rest of the
app keeps working on the demo people.

| Message | Missing |
|---|---|
| "PayPal isn't connected on this deployment." | PayPal sandbox keys, or `NEXT_PUBLIC_PAYPAL_CLIENT_ID` at build time |
| "PayPal sandbox isn't set up on this deployment" / "isn't connected" | Same, on import and activity |
| "The assistant isn't connected on this deployment." | `ANTHROPIC_API_KEY` |
| `/api/plaid/*` returns 503 `plaid_not_configured` | Plaid sandbox keys |
| "Your browser blocked PayPal's window." | Not a key: allow pop-ups |
| "That payment wasn't made through Monte, so Monte can't return it." | Not a key: returns only work on checkouts made in this session |

A reload clears the session: caps reset and earlier checkouts can't be returned from the page.

## Run it locally

```bash
npm ci
cp .env.example .env.local   # optional: add sandbox keys, see docs/deploy.md
npm run dev                  # http://localhost:3000
npm test                     # 149 engine, PayPal and Plaid tests; no keys needed
```

# TrojanHacks Finance: research notes for the card optimiser + "true cost" app

Read on **17 Oct 2026**. Research only: nothing was signed up for, applied to or contacted, and
no Plaid keys were used. Files next to this one:

- `cards.json`: 29 cards (all 24 requested plus Bilt Obsidian/Palladium, Discover it Student,
  Quicksilver Student, Platinum Secured and Prime Visa), with the category vocabulary and The
  Points Guy October 2026 valuations (plus NerdWallet's) at the top. Each card has `source_urls`,
  `checked`, and `unverified` / `unverified_fields` where an issuer page didn't confirm a fact.
- `category_map.json`: Plaid PFC (v1 and v2, 130 detailed categories) to our vocabulary, merchant
  overrides, MCC lists and how issuers decide categories.
- `_parts/`: the per-issuer source files and the full Plaid notes (`plaid_notes.md`) these were
  built from.

## 0. Card-data changes since 2025 that matter for the demo

- **Bilt changed issuers.** The Wells Fargo Bilt Mastercard is gone. Since 7 Feb 2026 there are three
  Bilt 2.0 cards (Blue $0, Obsidian $95, Palladium $495), issued by Column N.A. and serviced by
  Cardless. **The 5-transactions-per-statement rule is gone.** Rent points now depend on everyday
  spending as a share of rent: 0.5x at 25% or more, 0.75x at 50%, 1x at 75%, 1.25x at 100%, and a
  flat 250 points below 25%. The alternative is 4% "Bilt Cash" on spending, which unlocks rent points.
  APR is 26.74-34.74% after a 10% intro rate.
- **SavorOne no longer exists.** It was renamed Savor ($0) after the $95 Savor closed in 2024.
- **Citi Custom Cash stopped taking applications on 28 May 2026.** Existing cardholders keep it,
  so it stays in the data, but the terms come from secondary sources.
- **Discover is Capital One now.** Discover cards are still sold, from capitalone.com, and accounts
  move to Capital One's app in waves from 27 Jul 2026. Discover it Secured relaunched on 5 Oct 2026
  with the 5% rotating categories.
- **Q4 2026 rotating 5%:**
  - Chase Freedom Flex: grocery stores (excluding Walmart and Target), dining, American Red Cross.
  - Discover it: restaurants, entertainment (new), utilities (including phone and internet).
  - Both cap at $1,500 combined for the quarter and must be activated.
- **Freedom Flex dropped its foreign transaction fee.**
- **Fee changes:**
  - Sapphire Reserve is $795 (8x Chase Travel, 4x flights and hotels booked direct).
  - Amex Platinum is $895. Amex dropped the Saks credit on 1 Jul 2026, and 12 credits remain.
  - Amex Gold is $325.
- **Apple Card:** Chase was announced as the new issuer in Jan 2026, with a transition of about
  24 months; apple.com still names Goldman Sachs. The 3% merchants with Apple Pay are Apple, Ace
  Hardware, Booking.com, ChargePoint, Duane Reade, Exxon/Mobil, Hertz, Nike, Uber, Uber Eats and
  Walgreens.
- **BofA Rewards replaced Preferred Rewards (May 2026).** The boost is now +10% for every member,
  then +25% at $30k, +50% at $100k and +75% at $1M. Customized Cash pays 6% instead of 3% in the
  first year.
- **Amex Gold and Platinum are charge cards.** Their "APR" is the Pay Over Time rate.

## 1. Plaid Sandbox: what we can and can't fake

**Short answers:**

- **Custom credit-card transactions: yes.** Use `user_custom`, or call
  `/sandbox/public_token/create` with `override_username` / `override_password`, against the
  non-OAuth First Platypus Bank, `ins_109508`. Each transaction has only `date_transacted`,
  `date_posted`, `amount`, `description` and `currency`: there are no category, merchant or MCC
  fields. The limits are about 250 transactions or 55 KB per configuration, and 10 accounts.
- **Is `personal_finance_category` returned in Sandbox?** Yes for the built-in users. New teams
  get **PFCv2**. For *custom* transactions the docs don't say whether Plaid categorises them,
  so test it first; `merchant_overrides` in `category_map.json` is the fallback.
- **Liabilities for credit cards:** it returns `aprs[]` (with `interest_charge_amount`),
  `last_statement_balance`, `last_statement_issue_date`, `minimum_payment_amount`,
  `next_payment_due_date`, `is_overdue` and `last_payment_amount`. It works in Sandbox with no extra
  permissions. A custom user can set the purchase, cash, balance-transfer and special APRs, plus
  `last_statement_balance`, `minimum_payment_amount`, `last_payment_amount` and `is_overdue`. It
  **can't** set the due date or the statement date on a card.
- **Plaid never returns the MCC**, so mapping a PFC to a rewards category is always an estimate.
  Say so on the slide about what is real.

The detail and quotes follow (from `_parts/plaid_notes.md`):


Sources are plaid.com/docs pages as served on 2026-10-17 (the `.md` versions Plaid publishes
at `<page>/index.html.md`, plus the HTML for exact schema keys). Quotes are verbatim.
Nothing here was tested against a live Sandbox: no keys were used. Items marked
**UNVERIFIED** need a quick Sandbox call to confirm.

---

### 1.1 Custom Sandbox user with our own credit-card transactions: yes

**Two ways to create it.**

- Sandbox Studio in the Dashboard (Build -> Sandbox) is now Plaid's recommended way:
  "The easiest (and recommended) method is by using Sandbox Studio".
  Plaid's GitHub repo of custom users now says (README, Sept 2026): "the functionality in
  this repo is now offered via the in-Dashboard tool Sandbox Studio instead".
- API-only, which suits a hackathon: "log into Sandbox with the username `user_custom` and
  provide the JSON configuration object as the password", or more usually "bypass Link and
  create a public token directly by calling /sandbox/public_token/create with
  `options.override_username` and `options.override_password`".
  https://plaid.com/docs/sandbox/user-custom/
- From the /sandbox/public_token/create reference: set `override_username` "to `user_custom`
  and pass the JSON-stringified custom user configuration object as `override_password` to
  define one entirely via API." https://plaid.com/docs/api/sandbox/#sandboxpublic_tokencreate
- Use a **non-OAuth** institution: "At OAuth institutions, custom users may not work properly
  ... retry the configuration using a non-OAuth institution, such as First Gingham Credit
  Union or First Platypus Bank." First Platypus Bank is `ins_109508`.
  https://plaid.com/docs/sandbox/institutions/

**Schema keys (from the schema anchors on the user-custom page).**

- Top level: `version` (1 or 2, default 2), `seed`, `roll_dates_forward`, `override_accounts[]`,
  `mfa`, `recaptcha`, `force_error`.
- `override_accounts[]`: `type` (`credit` = "Credit card"), `subtype` (`credit card`),
  `starting_balance`, `force_available_balance`, `has_null_available_balance`, `currency`,
  `meta {name, official_name, limit, mask, apy}`, `numbers`, `transactions[]`, `holdings[]`,
  `investment_transactions[]`, `identity`, `liability`, `inflow_model`, `income`.
- `transactions[]` has exactly five fields: `date_transacted`, `date_posted`, `amount`,
  `description`, `currency`. "The transaction amount. Can be negative."
  "Posted dates in the past or present will result in posted transactions; posted dates in
  the future will result in pending transactions."
- **There is no category, merchant_name or MCC field** in a custom transaction. Plaid has to
  derive everything else from `description`.
- `liability` for `type: "credit"`: you can set `purchase_apr`, `cash_apr`,
  `balance_transfer_apr`, `special_apr` ("between 0 and 100. Can only be set if `type` is
  `credit`"), `last_payment_amount`, `last_statement_balance`, `minimum_payment_amount`,
  `is_overdue`.
  - Purchase APR drives interest: "For simplicity, this is the only interest rate used to
    calculate interest charges."
  - **Not settable for credit cards:** `next_payment_due_date`, `last_payment_date` ("Can only
    be set if `type` is `loan` or `line_of_credit`"), `last_statement_issue_date`, `aprs[]`
    (with `balance_subject_to_apr` / `interest_charge_amount`), `credit_limit`,
    `available_credit` ("Can only be set if `type` is `line_of_credit`"). For a card, Plaid
    fills those itself (**UNVERIFIED**: exact values). If we need to control them, a
    `line_of_credit` liability accepts all of them, but /liabilities/get may then return it
    as a different liability type (**UNVERIFIED**).
  - `inflow_model` with `statement_day_of_month` and `payment_day_of_month`
    (`monthly-balance-payment` or `monthly-interest-only-payment`) is the documented lever for
    statement and payment timing. "Note that account types supported by Liabilities will
    accrue interest in the Sandbox."
- `roll_dates_forward: true` (added 24 Sept 2026, per the changelog) shifts every date at Item
  creation "so that the most recent activity date falls on the day the Item is created". This
  keeps a saved config inside the 90-day default window. "The shift happens once, when the
  Item is created."

**Limits.**

- "Very large configuration objects (larger than approximately 55kb, or approximately 250
  transactions) are not supported and may cause the Link attempt to fail."
- "Using more than ten accounts on a single custom user is not supported and will cause the
  Link attempt to fail."
- Transaction history window: `options.transactions.days_requested` on
  /sandbox/public_token/create "defaults to 90 days", max 730. Undated or older transactions
  fall outside it unless `roll_dates_forward` is used.
- Sandbox Items "automatically enter the `ITEM_LOGIN_REQUIRED` state 30 days after being
  created". https://plaid.com/docs/sandbox/

**Is personal_finance_category computed for custom transactions? UNVERIFIED.**
The docs never say. They say PFCs are "returned by all Transactions endpoints as of
September 2023" (https://plaid.com/docs/transactions/pfc-migration/), and Sandbox supports
"All Plaid functionality of both the Plaid API and Plaid Link"
(https://plaid.com/docs/sandbox/). But Enrich in Sandbox only works on "this preset list" of
24 sample descriptions (https://plaid.com/docs/enrich/), which suggests Sandbox
categorisation is canned rather than Plaid's production model. Plan for a PFC that is
missing, `OTHER`/low-confidence, or plausible only for well-known descriptors. Use realistic
merchant descriptions ("Whole Foods Market", "Shell Gas Station", "Uber Eats") and keep our
own `merchant_overrides` (category_map.json) as the fallback. A 2-minute test with the
example below settles it.

**Refresh / adding transactions later.**

- Custom-user transactions arrive with the Item; no refresh is needed for the initial set.
  /transactions/sync "will return empty transactions arrays" if called "within a few seconds
  of Item creation", so retry or wait for `SYNC_UPDATES_AVAILABLE`.
  https://plaid.com/docs/api/products/transactions/#transactionssync
- Changed 13 Oct 2026: /sandbox/transactions/create "now works on every Sandbox Item, not
  only those created with `user_transactions_dynamic`, and can create transactions up to
  730 days in the past ... It also now accepts an optional `account_id`".
  https://plaid.com/docs/changelog/
  - Its fields are `date_transacted`, `date_posted`, `amount`, `description`,
    `iso_currency_code`, `account_id`. "Future dates are not allowed", so these are always
    posted.
  - Without `account_id` it goes to "the first depository account listed in its
    override_accounts, or its first account if it has no depository account". So pass the
    credit card's `account_id` explicitly.
- `user_transactions_dynamic` (any non-blank password, non-OAuth institution) "includes
  checking and credit card accounts, plus accounts for several loan types" and "generates
  transaction updates on each call to /transactions/refresh". Its checking and credit card
  accounts "have six months of recurring transactions".
  https://plaid.com/docs/transactions/ and https://plaid.com/docs/transactions/transactions-data/
- Persona users `user_yuppie`, `user_ewa_user`, `user_small_business` have "3 months of
  realistic data". `user_yuppie` is the closest to a rewards-card spender.

**Minimal example: credit card, 3 transactions, liability.** Pass it JSON-stringified as
`options.override_password` with `override_username: "user_custom"`,
`institution_id: "ins_109508"`, `initial_products: ["transactions", "liabilities"]`.
For credit accounts Plaid amounts are positive for purchases (money out). Plaid's own
example `liabilities/credit_card_custom_user.json` uses positive amounts for purchases.

```json
{
  "roll_dates_forward": true,
  "override_accounts": [
    {
      "type": "credit",
      "subtype": "credit card",
      "starting_balance": 1240.55,
      "meta": { "name": "Demo Rewards Card", "official_name": "Demo Rewards Visa", "limit": 8000, "mask": "4242" },
      "transactions": [
        { "date_transacted": "2026-10-10", "date_posted": "2026-10-11", "amount": 64.20,  "description": "Whole Foods Market", "currency": "USD" },
        { "date_transacted": "2026-10-12", "date_posted": "2026-10-13", "amount": 38.75,  "description": "Uber Eats",          "currency": "USD" },
        { "date_transacted": "2026-10-14", "date_posted": "2026-10-15", "amount": 52.10,  "description": "Shell Oil 57444",   "currency": "USD" }
      ],
      "liability": {
        "type": "credit",
        "purchase_apr": 24.99,
        "cash_apr": 29.99,
        "balance_transfer_apr": 24.99,
        "special_apr": 0,
        "last_statement_balance": 1102.40,
        "minimum_payment_amount": 35,
        "last_payment_amount": 400,
        "is_overdue": false
      },
      "inflow_model": {
        "type": "monthly-interest-only-payment",
        "statement_day_of_month": 5,
        "payment_day_of_month": 28,
        "transaction_name": "Card Payment"
      }
    }
  ]
}
```

The `inflow_model` block is optional. Drop it if the generated interest payments clutter the
transaction list. Remember `roll_dates_forward` moves the three dates so the latest lands on
the Item's creation day.

---

### 1.2 Does /transactions/sync (or /get) return personal_finance_category? Yes, and in 2026 it is PFCv2

- Each transaction has `personal_finance_category {primary, detailed, confidence_level, version}`
  plus `personal_finance_category_icon_url`. `confidence_level` "VERY_HIGH: We are more than
  98% confident ... HIGH: ... more than 90% confident".
  https://plaid.com/docs/api/products/transactions/#transactionssync
- Version: "If you enabled Transactions or Enrich on or after December 3, 2025, you may only
  receive the v2 taxonomy." Older teams get v1 unless they set
  `options.personal_finance_category_version: "v2"`. **A team created for this hackathon
  gets PFCv2** (127 detailed categories, a superset of v1's 104; adds `LOAN_DISBURSEMENTS_*`,
  `INCOME_SALARY` in place of `INCOME_WAGES`, `BANK_FEES_LATE_FEES`,
  `BANK_FEES_CASH_ADVANCE`, `TRANSFER_*_WIRE`, `TRANSFER_OUT_CRYPTO`, `OTHER_OTHER`).
  https://plaid.com/docs/transactions/pfc-migration/ (taxonomy CSV:
  https://plaid.com/documents/pfc-taxonomy-all.csv). category_map.json maps both versions.
- Legacy `category`/`category_id` were "Removed ... for all customers enabled for the
  Transactions product on or after May 5, 2025" (changelog), so don't code against them.
- Typical Production fill rate: "Category (`personal_finance_category`) | 95%",
  "Merchant name | 97%". https://plaid.com/docs/transactions/
- **Plaid does not return the MCC.** Transaction objects have `merchant_name`,
  `merchant_entity_id`, `counterparties[]`, `website`, `payment_channel`, and (opt-in)
  `original_description`, but no merchant category code. Issuers pay bonuses by MCC, so
  PFC -> reward category is always an estimate.
- Sandbox: PFC is present in the documented sample responses and for the built-in test
  users. For **custom** transactions, see the UNVERIFIED note in section 1.

---

### 1.3 /liabilities/get for credit cards: all requested fields exist

`liabilities.credit[]` fields, verbatim descriptions
(https://plaid.com/docs/api/products/liabilities/#liabilitiesget):

| field | doc text |
|---|---|
| `aprs[]` | "The various interest rates that apply to the account. APR information is not provided by all card issuers; if APR data is not available, this array will be empty." |
| `aprs[].apr_type` | "Possible values: balance_transfer_apr, cash_apr, penalty_apr, purchase_apr, special" |
| `aprs[].apr_percentage` | "Annual Percentage Rate applied." |
| `aprs[].balance_subject_to_apr` | "Amount of money that is subjected to the APR if a balance was carried beyond payment due date. How it is calculated can vary by card issuer." |
| `aprs[].interest_charge_amount` | "Amount of money charged due to interest from last statement." |
| `is_overdue` | "true if a payment is currently overdue. Availability for this field is limited." |
| `last_payment_amount` | "The amount of the last payment." |
| `last_payment_date` | "Availability for this field is limited." |
| `last_statement_issue_date` | "The date of the last statement." |
| `last_statement_balance` | "The total amount owed as of the last statement issued" |
| `minimum_payment_amount` | "The minimum payment due for the next billing cycle." |
| `next_payment_due_date` | "The due date for the next payment. The due date is null if a payment is not expected." |

- No credit limit is in `liabilities.credit[]`. Use `accounts[].balances.limit` /
  `.current` / `.available`.
- Sandbox: "Liabilities can be tested in Sandbox without any additional permissions."
  https://plaid.com/docs/liabilities/
  The add-to-app guide's sample response from `sandbox.plaid.com/liabilities/get` shows a
  "Plaid Credit Card" ("Plaid Diamond 12.5% APR Interest Credit Card", limit 2000) with four
  APRs (balance_transfer, cash, purchase, special), `last_statement_balance`,
  `last_statement_issue_date` and `next_payment_due_date`. That is the default Sandbox card
  for `user_good` / `pass_good` (**UNVERIFIED** that the values match exactly).
  https://plaid.com/docs/liabilities/add-to-app/
- `user_loan_loc` / `pass_good` is for "general-purpose, commercial, and home-equity loans and
  lines of credit", not cards. https://plaid.com/docs/sandbox/test-credentials/
- "liabilities data does not contain detailed transaction history for credit card accounts.
  For credit card account transactions, use the Transactions product." So initialise the Item
  with both products.
- Custom user: yes, liability fields can be set, but only the subset listed in section 1 for
  `type: credit`. The due date and statement date can't be pinned for a card.
- Refresh cadence in Production: "Liabilities data is refreshed approximately once per day".

---

### 1.4 2026 changes, pricing, Production, OAuth

- **Sandbox is free and unlimited:** "The Plaid Sandbox is a free and fully-featured
  environment ... you can create an unlimited number of test Items."
  https://plaid.com/docs/sandbox/
- **No public price list:** "A price list is not available in the documentation. To view
  pricing, apply for Production access". Transactions and Liabilities are subscription-billed
  per Item; /transactions/refresh is a per-request add-on.
  https://plaid.com/docs/account/billing/
- **Trial plans replaced Limited Production (16 Apr 2026).** "Free Trial plans are available to
  new Plaid teams (US/Canada only) created on or after April 15, 2026." "You can create 10
  Production Items on a Trial plan." Removing Items "will _not_ allow you to create more
  Items". Transactions (including Refresh) and Liabilities are on the Trial list. Sandbox still
  needs no approval; real banks need Production access via a Trial or paid plan.
- **Sandbox Studio (11 Sept 2026)** in the Dashboard can run Sandbox calls and draft custom-user
  JSON from a plain-language description.
- **Other 2026 Sandbox changes:** `roll_dates_forward` (24 Sept), /sandbox/transactions/create
  on any Item with 730-day back-dating (13 Oct). There is also a Sandbox MCP server
  (github.com/plaid/ai-coding-toolkit) that can create Items and fire webhooks.
- **Chase and Amex in Production: yes, via OAuth, after registration.**
  - "Access to Production (via either a paid plan or a trial) is a prerequisite for supporting
    OAuth." https://plaid.com/docs/link/oauth/
  - Chase: "Unless you are on a Trial plan, you must complete the Security Questionnaire before
    gaining access to Chase in Production." Users choose consent "6 months, 1 year, or
    'always'"; App-to-App is supported.
  - American Express is on the OAuth consent-refresh list (every 12 months), as are Capital One
    and Citibank ("includes merchant-branded Citi credit cards").
  - Capital One notes: descriptions "may sometimes be redacted ... This can also result in
    reduced transaction enrichment and categorization accuracy"; Capital One "does not provide
    pending transaction data"; it "does not allow end users to link credit cards whose payments
    are past due".
- **OAuth in Sandbox:** "You can test OAuth in Sandbox even if Plaid has not yet enabled OAuth
  flows for your account". Use Platypus OAuth Bank `ins_127287`, or pick Chase etc. in Sandbox
  Link (generic flow: "all Sandbox OAuth institutions use a single generic OAuth flow").
  Custom users and special test credentials want **non-OAuth** institutions.

#### Bottom line for the demo

Use `/sandbox/public_token/create` with `ins_109508`, `initial_products:
["transactions","liabilities"]`, `override_username: "user_custom"` and the JSON above as
`override_password`. Then call `/item/public_token/exchange`, `/transactions/sync` (retry
until it returns transactions) and `/liabilities/get`. Map categories with category_map.json,
merchant_overrides first. If custom transactions come back without a useful PFC, the
overrides keep the demo working. For richer realistic data, add a second Item with
`user_yuppie` or `user_transactions_dynamic`.

## 2. Estimating interest paid: average daily balance (ADB)

**What the regulator says.** The CFPB: "Many credit card companies calculate the interest you owe daily, based on your average daily account balance" ([Ask CFPB, reviewed 22 Jan 2024](https://www.consumerfinance.gov/ask-cfpb/how-does-my-credit-card-company-calculate-the-amount-of-interest-i-owe-en-51/)). Its contract-definitions page sets "The daily periodic rate or DPR for a given balance is equal to the APR on that balance divided by 365", and describes ADB with compounding (prior day's interest is added to the next day's balance) and without ([CFPB credit card contract definitions](https://www.consumerfinance.gov/data-research/credit-card-data/know-you-owe-credit-cards/credit-card-contract-definitions/)). Some issuers divide by 360 ([Ask CFPB: daily periodic rate](https://www.consumerfinance.gov/ask-cfpb/what-is-a-daily-periodic-rate-on-a-credit-card-en-46/)). Reg Z lets a statement show the ADB so that ADB x days x DPR reproduces the finance charge ([12 CFR 1026.7](https://www.consumerfinance.gov/rules-policy/regulations/1026/7/)).

**Formula we use (per card, per billing cycle, per APR bucket):**

```
DPR       = APR / 365
ADB       = (sum over each day d in cycle of balance_d) / days_in_cycle
            balance_d = prior day balance + purchases_d - payments_d - credits_d (+ prior day interest if compounding)
interest  = ADB * DPR * days_in_cycle
```

**Grace period rule (decides whether interest applies at all).** If the previous statement balance was paid in full by the due date, new purchases accrue no interest (grace period). If it wasn't, the card loses the grace period and every day's balance, new purchases included, accrues interest until the balance is paid in full (usually takes one full-pay cycle to restore).

**Defensible estimators, best first:**

1. **Exact (Plaid Liabilities).** `liabilities.credit[].aprs[].interest_charge_amount` is the interest the issuer actually charged last statement for each APR type. When present, use it; don't model. (In Sandbox a custom user sets `purchase_apr` and Plaid's sandbox accrues interest itself, so check what `aprs[]` comes back with before relying on it in the demo.)
2. **Daily reconstruction (Plaid Transactions + Liabilities).** Rebuild the daily balance from `last_statement_balance` and the cycle's transactions (purchases positive, payments negative in Plaid's sign convention), apply the purchase APR from `aprs[]` (`apr_type: "purchase_apr"`), and apply the grace rule above. This reproduces the issuer within cents when there's a single APR and no promo balance.
3. **Quick estimate (statement balances only).** `interest ~ ((prev_statement_balance + current_statement_balance) / 2 - payments_made_before_mid_cycle) * APR/365 * days`. Simpler: `revolving_balance * APR/12` per month. Label it an estimate on screen.

Annualise: sum the last 12 cycles, or `monthly_interest * 12` with the APR shown. For the "true cost" view: `net_value = rewards_earned_value + credits_used - annual_fee - interest - late_fees - foreign_tx_fees`.

**Sanity check with national numbers:** consumers were assessed **$160 billion in credit card interest in 2024**, up from $105 billion in 2022, and paid **$31.3 billion in fees**, of which late fees were **$17 billion** (CFPB, *The Consumer Credit Card Market*, Dec 2025, pp. 5, 40, 60; [PDF](https://files.consumerfinance.gov/f/documents/cfpb_consumer-credit-card-market-report_2025.pdf)).

### Late fees in 2026: the $8 cap never took effect

- The CFPB's 2024 rule would have cut the safe harbor for issuers with 1M+ accounts to **$8** (89 FR 19128). It was stayed before taking effect and **vacated on 15 April 2025** by the N.D. Texas (Judge Pittman, *Chamber of Commerce v. CFPB*, No. 4:24-cv-00213-P), after the CFPB itself joined the plaintiffs in asking for vacatur ([Orrick InfoBytes, 25 Apr 2025](https://infobytes.orrick.com/2025-04-25/cfpb-gets-its-credit-card-late-fee-rule-tossed/); [Sheppard Mullin](https://www.sheppard.com/insights/blogs/cfpb-late-fee-rule-vacated-by-texas-federal-court); [Goodwin](https://www.goodwinlaw.com/en/insights/blogs/2025/05/cfpb-agrees-to-eliminate-$8-cap-on-credit-card-late-fees)).
- So the pre-2024 Reg Z safe harbor applies: **$30 for a first late payment, $41 for another within the next six billing cycles** (12 CFR 1026.52(b)(1)(ii); figures as reported by [America's Credit Unions](https://www.americascreditunions.org/node/16756)). I found no 2026 inflation-adjustment notice raising them; *unverified* whether the CFPB published one (the eCFR page redirected to a bot check). The fee can't exceed the minimum payment due.
- Issuers' pricing tables typically say "up to $40" or "up to $41" (see each card's terms link in `cards.json`; CFPB's TCCP file has a `Late Fee ($)` column per product, see section 5). **For the app: model a late fee as $30 first time, $41 if another late within 6 cycles, capped at the minimum payment due**, or use the card's TCCP value. Plaid Liabilities exposes `is_overdue`, `last_payment_date` and `next_payment_due_date`, so a missed due date is detectable; the fee itself shows up as a transaction: PFCv2 (the default for Plaid teams created since Dec 2025) has `BANK_FEES_LATE_FEES` and `BANK_FEES_INTEREST_CHARGE`; under v1 also match descriptions like "LATE FEE". All fee categories are `exclude: true` in `category_map.json`.

## 3. Headline stats for the pitch (all read 17 Oct 2026)

| Stat | Number | Source |
|---|---|---|
| Average credit card APR | **21.19%** on all accounts and **22.36%** on accounts assessed interest (Aug 2026, preliminary); Q2 2026: 20.94% / 22.15% | Federal Reserve G.19 Consumer Credit, released 7 Oct 2026, "Terms of Credit" table: <https://www.federalreserve.gov/releases/g19/current/default.htm>. Note: the monthly Aug column is new to me; quote "about 21% (22% if you pay interest)" to be safe. CFPB's account-level average for general-purpose cards is higher, **25.2% in 2024**, the highest since at least 2015 (CARD Act report, Dec 2025). |
| Total US credit card debt | **$1.263 trillion**, Q2 2026 (+$21B q/q, +$54B y/y); 6.97% of card balances transitioned into serious (90+ day) delinquency | NY Fed Household Debt and Credit Report, 11 Aug 2026: <https://www.newyorkfed.org/newsevents/news/research/2026/20260811>; report hub <https://www.newyorkfed.org/microeconomics/hhdc.html>. Q3 2026 is due in early Nov. |
| Share carrying a balance | **45% of credit card owners carried a balance at least once in the prior 12 months** (Oct 2025 survey); 82% of adults have a card | Fed, *Economic Well-Being of U.S. Households in 2025* (SHED), May 2026, p. 63: <https://www.federalreserve.gov/publications/files/2025-report-economic-well-being-us-households-202605.pdf>. Account-level: ~50% of general-purpose accounts revolve (CFPB CARD Act report 2025, p. 5). |
| Interest and fees paid | **$160B interest + $31.3B fees in 2024**; average annual fee rose 21% to **$127** since 2022, driven by premium cards with "monthly credits for ride-hailing or food delivery" | CFPB, *The Consumer Credit Card Market*, Dec 2025, pp. 5, 40, 60, 62: <https://files.consumerfinance.gov/f/documents/cfpb_consumer-credit-card-market-report_2025.pdf> |
| Rewards earned / sitting idle | **$47.5B in rewards earned in 2024** (nearly double 2020); the average rewards account holds **over $190** unredeemed | Same CFPB report, pp. 139-141 |
| Who pays for rewards | Rewards redistribute **~$15 billion a year** from less to more sophisticated (and poorer to richer) cardholders, using the Fed's Y-14M account data | Agarwal, Presbitero, Silva & Wix, "Who Pays For Your Rewards?", FEDS 2023-007: <https://www.federalreserve.gov/econres/feds/files/2023007pap.pdf> |
| Unredeemed rewards (survey) | **69%** of rewards cardholders sitting on unused rewards; 31% of those with cash back have $100+ | LendingTree survey of 1,293 cardholders, July 2022 (page updated Nov 2025): <https://www.lendingtree.com/credit-cards/study/unused-rewards/>. Older; use with its date. |
| "Wrong card" money left on the table | **No good US number found.** The closest: a 2026 Indian study (1 Finance Magazine, 129 people) found 92% used cards that didn't fit their spending, earning ~4% back vs ~10% possible ([Business Standard, Jun 2026](https://www.business-standard.com/amp/finance/personal-finance/using-the-wrong-credit-card-it-could-be-costing-you-2-lakh-a-year-126062400200_1.html)). NerdWallet's 2018 study ($277/yr missed by not holding a travel card) is old. **Better pitch move: compute it ourselves** on the demo user ("this wallet left $X on the table last year") and say how. |
| Annual fees for unused credits | **No survey found** that measures the share of cardholders leaving statement credits unused (searched NerdWallet, Bankrate, TPG, CardRatings, J.D. Power, LendingTree). Related: CFPB notes premium fees rose on the back of "monthly credits"; BestMoney's 2026 survey (n=1,000) says 45.1% of travel cardholders let points or miles expire ([BestMoney, Jul 2026](https://www.bestmoney.com/credit-cards/learn-more/travel-credit-card-rewards-survey)). Again, compute it on our own demo data rather than quote a weak stat. |

Suggested slide-2 line: *"Americans owe $1.26 trillion on credit cards at about 22% APR; 45% of cardholders carried a balance last year, and rewards cards quietly move ~$15 billion a year from people who carry balances to people who don't."*

## 4. Prior art and what they miss

| Product | What it does (as of Oct 2026) | What it misses for us |
|---|---|---|
| **Uno Wallet** (YC Spring 2026; <https://myunowallet.com/>, <https://www.ycombinator.com/companies/uno-wallet>) | "Like Apple Wallet, but it picks the best card for you." Reads the merchant and category at tap time and routes to the card that earns most; tracks points, annual benefits and rotating categories; you double-click the side button so Uno becomes the default wallet. Private beta, site showed 33,239 on the waitlist. YC one-liner: "The AI mobile wallet that replaces Apple Pay." Founders Mordi Shadpour, Saket Joshi; team of 2. | Optimises the **earn** side only. Nothing public about interest, fees, or whether a card is net-negative for you. Waitlist-only, so judges can't try it. |
| **CardPointers** (<https://www.cardpointers.com/>) | Manual wallet (add cards, no bank login); best card per category/merchant, Apple Watch app; auto-adds offers for Amex, Chase, BofA, Citi, Wells Fargo, US Bank "without sharing your logins"; claims 5,000 cards. Paid tier (CardPointers+) about $72/yr per third-party reviews. | No account data, so it can't see balances, APRs, or interest; it can't say "this card cost you money." |
| **MaxRewards** (<https://www.maxrewards.com/>) | Links issuer logins; dashboard of balances, rewards, benefits, card-linked offers, bonus progress; best-card recommendations and a browser extension; paid Gold/Platinum tiers ($60-108/yr reported). | Tracks benefits but not interest cost; reviews report frequent Chase/Amex unsyncs. Doesn't net rewards against interest and fees. |
| **Kudos** (<https://www.joinkudos.com/>) | Free Chrome/Safari extension + iOS app; picks the best card at **online** checkout and autofills it; 3,000+ cards; "Boost" merchant cashback; $10.2M Series A (2024). | Online checkout only; no in-store tap; no debt or fee view. |
| **Apple Wallet / Apple Pay** | Holds your cards; since iOS 18 can show and **pay with rewards** at online checkout for participating issuers, and Apple Card installments ([Apple support 120479](https://support.apple.com/120479)). | Does **not** recommend which card to use; no cross-issuer rewards logic; no cost view. |
| **NerdWallet** (card finder, best-of lists, <https://www.nerdwallet.com/credit-cards/best>) | Recommends cards to **apply for**, filtered by credit score and monthly spending; affiliate-funded. | Doesn't tell you which card in your wallet to use, and has a conflict of interest when it tells you to drop or add a card. Personalised, linked-account card recs in its app: *unverified*. |

**Our gap:** everyone above maximises rewards; nobody puts **interest, fees and unused credits on the same ledger** as rewards. The "true cost" view (rewards minus interest minus fees minus unused credits, per card, last 12 months) plus "cards you left money on the table with" (recomputing each past transaction with the best card you held) is the differentiator. It also answers the CFPB/Fed finding that rewards are a net transfer from revolvers.

## 5. CFPB Terms of Credit Card Plans (TCCP) survey

- **What it is:** a twice-yearly survey of 150+ issuers' card terms, required by the Fair Credit and Charge Card Disclosure Act of 1988 (since 1990). Expanded in 2023 to product-level detail. Page: <https://www.consumerfinance.gov/data-research/credit-card-data/terms-credit-card-plans-survey/>
- **Latest release:** data as of **31 Dec 2025** (covers Jul-Dec 2025). Download: **<https://files.consumerfinance.gov/f/documents/cfpb_tccp-data_2025-12-31.xlsx>**. Data dictionary: <https://www.consumerfinance.gov/data-research/credit-card-data/terms-credit-card-plans-survey/data-dictionary/>. The Jan-Jun 2026 period was due from issuers by Sept 2026, so a 30 Jun 2026 file may appear soon; check the page.
- **The CFPB retired its "Explore Credit Cards" comparison tool**; the data and the tool's open-source code stay public, and the CFPB says it may offer a public API.
- **Fields (by group):**
  - Product: Institution Name, Issued by Top 25 Institution, Card Name, Report Date, Offering Location (National/Regional/State), State, Requirements for Opening (+ types), Secured Card, Targeted Credit Tiers.
  - Purchase APR: offered?, vary by balance (Tier 1-4 rates and balance bands), index (Prime etc.), fixed/variable, **vary by credit tier: APR for no score / poor / good / great, and min / median / max**.
  - Intro APR (by tier, median length in months), Balance Transfer APR (by tier, promo length, grace), Cash Advance APR (by tier).
  - Grace Period (days), Minimum Finance Charge, **Balance Computation Method** (+ details).
  - Periodic fees: Annual/Monthly/Weekly Fee, varies?, min/max.
  - Transaction fees: purchase, balance transfer, cash advance, **foreign transaction** ($, %, minimum).
  - Penalty fees: **Late Fee ($), Late Fee within six billing cycles (repeat)**, Over Limit Fee, other fees.
  - Benefits: Services, Rewards (e.g. cashback, travel), Card Features.
  - Contact: website, phone.
- **Use in the app:** a scatter of median purchase APR by issuer for "great" vs "good" credit, and a fallback APR when Plaid doesn't return one (look up the card's median APR for the user's tier). No penalty-APR or margin fields.

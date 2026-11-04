# Uno, the other card pickers, what people want, and what we can build

Researched 3 Nov 2026 for "make Monte a better Uno". Sources are numbered at the end. Reddit blocks
automated reading, so user sentiment comes from app-store reviews, Trustpilot, the Chrome Web Store and
issuer pages.

## Uno Wallet, in full

- **What it is:** an iPhone-only wallet "designed to replace Apple Pay as your default wallet". You add
  the cards you already have, double-click the side button, and Uno picks the best eligible card; you
  can override it [1][2][6].
- **How it knows the store before the tap:** location. Its privacy policy collects precise or
  approximate location "to detect the merchant category" [3], and its engineering job post describes
  "merchant prediction and category prediction engines" [8]. It doesn't see receipts: it predicts.
- **Not found anywhere:** online checkout, Android, a virtual card, pricing, a revenue model, an
  issuing or tokenization partner, an App Store listing. Its terms say it "does not independently issue
  payment cards, process payment transactions" [4].
- **Where it's going:** YC describes a financial agent (which card to tap, which to apply for, when
  bills are due) [7]; one listing says it is "building a new payment rail" [10]; a sister app, Ora, is a
  conversational finance app [5].
- **Status:** launched on YC's feed 2 Jun 2026 [6], still a private beta behind a waitlist [1][2].
  YC Spring 2026, two people in San Francisco; Saket Joshi (CEO, ex-xAI) and Mordi Shadpour
  (co-founder, ex-Bloomberg) [7][8].
- **Its moat** is Apple's NFC & SE Platform: to be an iPhone's default tap-to-pay app you must be a
  financial institution or contracted to a licensed payment provider, sign a fee-bearing agreement with
  Apple, meet PCI DSS and EMVCo, and pass a lab review [11]. Putting your Chase or Amex card inside it
  needs network tokens (a registered token requestor, weeks of certification [66]) or a Curve-style
  staged wallet [67]. That's the "partnerships and compliance" Mordi meant.

## The other card pickers

| Product | Where | How it knows the store | Notable |
|---|---|---|---|
| CardPointers | iOS, Android, web, Chrome/Firefox/Safari | Location in stores; a list of sites online | Auto-adds Amex/Chase/BofA/Citi/WF/US Bank offers as you log in normally; ~$90/yr [13][14][15] |
| MaxRewards | iOS, Android, extensions | Links issuer accounts | Auto-activates offers and bonus categories; net value per card including fees and interest; Gold over $100/yr [16][17] |
| Kudos | Chrome, iOS Safari | Site at checkout; "Cheat Sheet" in stores | Picks and autofills the card (CVV too) at checkout; $63-92/yr; no card of its own [18][19] |
| Pointwise (YC W23) | iOS | Your spending | Which card to get; earns referral fees [21] |
| Curve (UK/EEA) | Its own card | It is the merchant ("CRV*Merchant") | One card that charges the one you pick; usually loses that card's rewards; Amex cut it off in 2019; US launch paused; Lloyds buying it [22-26] |
| Chrome itself | Autofill | The site | Shows one card benefit in the autofill dropdown for 100+ US cards [28] |

Capital One closed its Eno virtual-card extension on 30 Sep 2026 [27]. Honey, Rakuten and Capital One
Shopping do coupons and cashback, not card choice [29][30].

## What people want

- **Not handing over bank logins**, and connections that work: MaxRewards reviewers report cards that
  won't connect; a Kudos reviewer balked at giving the app all their banking access [16][20].
  CardPointers sells "no logins shared" [13].
- **Correct categories:** a Kudos reviewer says its recommendations "miscategorize spend" [20]. Bankrate's
  advice for finding a store's code is to call the store [33]; Walmart and Costco don't code as grocery [34].
- **One-click autofill** is Kudos's most praised feature; oversized pop-ups the most disliked [19][20].
- **A simple UI with search** (CardPointers' setup is called overwhelming; a MaxRewards user asked for a
  merchant search box) [14][16].
- **No paywall on every tab** [18][20].
- **Rotating-category reminders:** Chase tells cardholders to set their own; miss activation and it's 1x [35].
- **Automatic offer activation** is MaxRewards' main draw [36].

## What two students can build with public APIs

| Piece | What you get | To start | The catch |
|---|---|---|---|
| **Lithic** (card issuing) | Auth Stream Access: every authorization's descriptor, MCC, city/state/country, amounts, card token, last four and card `memo`; answer within 6 s | Free sandbox key [39] | Live cards need a sponsor bank via sales; sandbox writes 1/s [37][38] |
| **Stripe Issuing** | `issuing_authorization.request` webhook (2 s), test helpers for authorizations | Test mode, no approval [42] | Under 18 needs a guardian on the account [43] |
| Marqeta / Highnote | Shared public sandbox with JIT funding / an auth simulator | Free [44][45] | |
| **Plaid** | Transactions and Liabilities (each card's APRs and balance subject to each, statement balance, minimum, due date, overdue) | Sandbox free (user_good / pass_good) [46][47] | Chase, BofA, Wells Fargo need Production + OAuth; Transactions has no MCC [46][48] |
| Store data | Google Places (5,000 free calls/month), Mastercard Places (trial), Foursquare's open dataset, OpenStreetMap | Keys / download [50-52] | Visa Merchant Search is for issuers only [49]; no public domain-to-MCC dataset |
| Browser | An extension can read the site and the page | Chrome Web Store | Filling card numbers puts you in PCI DSS scope [56]; the Payment Request API is the merchant's, not ours [54][55] |
| Wallet passes | An Apple pass can carry up to 10 locations and appear on the lock screen there [59] | Apple Developer Program, $99/yr | Enrollment needs an adult [60]; Google "Nearby Passes" ~150 m, 4 alerts/day [61] |
| Offers | Fidel test environment; Cardlytics via banks [62][63] | | Scripted Amex-offer adding uses undocumented endpoints; Amex can disqualify "gaming" [64] |

## What Monte has now, against that

| Wanted | Monte | Uno |
|---|---|---|
| Counts interest, not just points | Yes: `choose()`, and when every card has a balance, the cheapest net | Not stated |
| The store before you pay | Search, near me (OpenStreetMap), and at authorization the network's own MCC (`/card`) | Location prediction |
| Online checkout | Extension: click for the card, or an opt-in note at checkout; never touches card numbers | Not found |
| No bank login required | Add cards by hand, or a statement CSV; Plaid optional | Unknown |
| Rotating categories | Shown with the activation deadline | Not stated |
| Perks first (Uber Cash...) | Yes | Not stated |
| What your cards cost you this year | The receipt, misses, keep or cancel | "Which card to apply for" planned |
| Platforms | Web, any phone, installable; Chrome | iPhone only, beta |
| Paying with the picked card at the tap | No: needs a bank partner and network tokens | Yes (its moat) |

## Next, ranked by value and what we can do without partners

1. **Caps and rotating categories:** track how much of each cap is used this period (built 3 Nov).
2. **"How did this code?":** let a person correct a store's category once, and keep the correction.
3. **Due dates and utilization from Plaid Liabilities:** the minimum and the date, and a warning past 30%.
4. **Location on the lock screen:** an Apple Wallet pass with your 10 most-visited stores ("Amex Gold: 4x
   groceries"). Needs an Apple Developer account in a parent's name.
5. **A shareable "what my cards cost me" receipt**, the way Uno's pitch uses its founders' numbers [12].
6. **Offers without logins:** list each card's offers and deep-link to add them; don't script issuer sites.
7. **The Monte card on Lithic's sandbox** for real network messages (built; needs a key). Real money needs
   a company, a sponsor bank, network registration, and Amex may refuse it as it refused Curve [24][67].
8. **Don't** try iPhone tap-to-pay: that's Apple's licensed program [11].

## Sources

[1] https://myunowallet.com [2] https://myunowallet.com/technology [3] https://myunowallet.com/privacy
[4] https://myunowallet.com/terms [5] https://myunowallet.com/ora
[6] https://x.com/ycombinator/status/2061900662888108108 [7] https://www.ycombinator.com/companies/uno-wallet
[8] https://standout.work/jobs/02af0c2a-b5cf-4b6e-ae92-676565ec42f9 [9] https://neuronfeed.com/startups/uno-wallet
[10] https://www.launchmeloud.com/companies/uno-wallet [11] https://developer.apple.com/support/nfc-se-platform/
[12] https://myunowallet.com/about [13] https://cardpointers.com
[14] https://apps.apple.com/us/app/cardpointers-for-credit-cards/id1472875808 [15] https://wallethacks.com/cardpointers-app-review/
[16] https://apps.apple.com/us/app/id1435710443 [17] https://help.maxrewards.com/en/articles/12100034-maxrewards-platinum-faq
[18] https://apps.apple.com/us/app/kudos-ai-powered-smart-wallet/id6443548838
[19] https://chromewebstore.google.com/detail/kudos-smart-wallet/gdhkdkbbkddjgnlgkebldinlnhnkibmb/reviews
[20] https://ie.trustpilot.com/review/joinkudos.com [21] https://apps.apple.com/us/app/pointwise/id6495271376
[22] https://help.curve.com/en_us/what-is-curve-H1y1HdnIO.md
[23] https://insideflyer.com/2022/03/14/how-curve-really-works-from-a-european-who-already-has-one/
[24] https://finextra.com/newsarticle/33285/american-express-blocks-curve
[25] https://www.bankingdive.com/news/lloyds-bank-uk-acquire-fintech-curve-digital-wallet-120-million-idc-investor-concern/806065/
[26] https://thepaypers.com/payments/news/curve-launches-curve-pay-on-ios-in-eea-competing-with-apple-pay
[27] https://www.capitalone.com/learn-grow/money-management/eno-browser-extension/
[28] https://9to5google.com/2025/08/12/chrome-autofill-card-benefits/ , https://support.google.com/chrome/answer/16577205
[29] https://dollarsprout.com/capital-one-shopping-vs-honey/ [30] https://en.wikipedia.org/wiki/PayPal_Honey
[33] https://www.bankrate.com/credit-cards/business/finding-merchant-category-code/
[34] https://www.doctorofcredit.com/best-credit-card-for-grocery-store-purchases/
[35] https://chase.com/personal/credit-cards/education/chase-cards/how-to-activate-chase-freedom-flex-rewards-categories
[36] https://cardstack.money/articles/guides/maxrewards-vs-kudos [37] https://docs.lithic.com/docs/auth-stream-access-asa
[38] https://docs.lithic.com/reference/postsimulateauthorize [39] https://docs.lithic.com/docs/get-api-key
[40] https://docs.stripe.com/issuing/testing?testing-method=with-code [41] https://docs.stripe.com/issuing/controls/real-time-authorizations
[42] https://support.stripe.com/questions/stripe-issuing-test-mode-configurations-and-differences-vs-live-mode
[43] https://support.stripe.com/questions/can-i-use-stripe-if-i-am-under-18
[44] https://www.marqeta.com/docs/core-api/simulations-card-transactions
[45] https://highnote.com/docs/issuing/auth-controls/collaborative-authorization-simulation
[46] https://plaid.com/docs/sandbox/ [47] https://plaid.com/docs/liabilities/
[48] https://plaid.com/blog/transactional-data-personalization-update/ [49] https://developer.visa.com/capabilities/merchant_search
[50] https://developer.mastercard.com/places/documentation/ [51] https://developers.google.com/maps/billing-and-pricing/pricing
[52] https://docs.foursquare.com/data-products/docs/fsq-places-open-source
[54] https://developer.mozilla.org/en-US/docs/Web/API/Payment_Request_API [55] https://developer.chrome.com/blog/deps-rems-96/
[56] https://www.pcisecuritystandards.org/faq/articles/Frequently_Asked_Question/Does-the-PCI-DSS-apply-to-issuers
[59] https://developer.apple.com/documentation/walletpasses/pass [60] https://developer.apple.com/programs/enroll/
[61] https://help.passkit.com/en/articles/12441270-gps-location-notifications-google-wallet-vs-apple-wallet
[62] https://fidelapi.com [63] https://platform.cardlytics.com/publishers
[64] https://americanexpress.com/au/network/amex-offers-terms.html
[66] https://developer.visa.com/capabilities/token-service-provisioning
[67] https://usa.review.visa.com/content/dam/VCOM/global/support-legal/documents/digital-wallet-guide-october-2024.pdf

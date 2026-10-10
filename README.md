# Dhamaka Fireworks - Diwali crackers store

Folder contents
- index.html           the whole storefront (home, shop, product, cart, checkout, order status, contact)
- images/              236 web-ready product photos, sorted by category
- products.csv         ALL products: name, category, brand, price, MRP, image, featured. Edit this in Excel / Google Sheets
- build-catalog.js     applies products.csv to the website:  node build-catalog.js
- api/                 Cashfree server functions (create-order.js, order-status.js, _prices.json)
- skipped-images.txt   photos that were not used

## 1. Preview
Open index.html in a browser. Demo mode is ON (fake payment, no money moves).

## 2. Fix the prices (important)
The prices and MRPs in products.csv are PLACEHOLDERS I generated from the pack size. Put your real prices in the
`price` and `mrp` columns, save, then run:
    node build-catalog.js
This refreshes index.html and api/_prices.json together, so the server always charges the right amount.
Other columns: `featured` = 1 shows the product on the home page; `pack` (e.g. "10 pcs") shows under the name;
`description` is the text on the product page; `more_images` are extra photos separated by | .
To add a product: add a row with the next id and copy its photo into images/.

## 3. Your details
Top of the <script> in index.html: CONFIG (phone, email, social links, licence number, Diwali date, delivery charge).

## 4. Go live with Cashfree (Vercel)
1. Create a Cashfree Payment Gateway account and copy the App ID and Secret Key (Sandbox first).
2. Push this folder to GitHub and import it in Vercel (no build settings needed).
3. In Vercel > Settings > Environment Variables add:
     CASHFREE_APP_ID      = your App ID
     CASHFREE_SECRET_KEY  = your Secret Key
     CASHFREE_ENV         = sandbox      (change to production when you go live)
     SITE_URL             = https://your-domain.com   (optional)
4. In index.html CONFIG set  demoMode:false  and  cashfreeMode:'sandbox'  (or 'production').
5. Test with Cashfree's test UPI/cards, then switch CASHFREE_ENV and cashfreeMode to production.
Never put the Secret Key inside index.html.

## 5. Before you launch: photos and legal
- The photos came from other sellers' product pages and show other companies' brands, logos, and in some cases
  film stars and cartoon characters on the packs. Using them on a public shop can lead to copyright or trademark
  complaints. They are fine for building and previewing. For the live site, use your own photos, or get written
  permission from the brands / your distributor.
- Add your explosives licence number in CONFIG.licence and check current Gujarat / Ahmedabad rules on selling crackers.
- Brand names come from what is printed on each pack. Check the ones marked "Other" or any you think are wrong.

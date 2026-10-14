/* ============================================================
 *  Wishlist settings
 *  This is the only file you need to edit to make the shop yours.
 *  Edit it right on GitHub: open this file, click the pencil icon,
 *  change the values between the quotes, then "Commit changes".
 * ============================================================ */

window.WISHLIST_CONFIG = {

  /* ---------- 1. Your spreadsheet (required) ----------
   * In Google Sheets: File > Share > Publish to web.
   * Pick the tab with your items, choose "Comma-separated values (.csv)",
   * click Publish, and paste the link it gives you here. */
  sheetUrl: 'TEMPLATE_SHEET_URL',


  /* ---------- Your name ----------
   * Shown to gift-givers, e.g. "Sam won't see it" when they mark something as bought.
   * Leave blank to say "The wishlist owner". */
  ownerName: '',


  /* ---------- 2. Photos ----------
   * Photos live in this folder in the repo. The "image" column in your sheet
   * holds the file name (with or without .jpg). Names are case-sensitive. */
  imageFolder: 'wishlist-images/',


  /* ---------- 3. Gift planner ----------
   * Part of a gift-giver's budget the planner holds back for tax and shipping.
   * 0.15 means 15%. Use 0 to turn it off. */
  taxShippingBuffer: 0.15,


  /* ---------- 4. "Looted" claims (optional) ----------
   * Lets gift-givers mark items as bought so nobody doubles up.
   * Leave these blank to turn the feature off. Setup steps are in the README. */
  claims: {
    // The claims form's response sheet, published as CSV.
    csvUrl: '',
    // The form's address, ending in /formResponse.
    formUrl: '',
    // The entry.123456 ids for the form's item, quantity and ref questions.
    itemField: '',
    qtyField: '',
    refField: '',
  },


  /* ---------- Advanced (fine to leave as is) ---------- */

  // File types to try when the image column has no extension, in order.
  imageExtensions: ['jpg', 'png', 'jpeg', 'webp'],
  // Highest budget the gift planner will work with (keeps it fast).
  maxPlannerBudget: 5000,
  // Ignore daily price checks older than this many days and use the sheet price instead.
  maxPriceAgeDays: 3,
  // Shops with fewer items than this are grouped under "Other" in the shop filter
  // (cards still show the real shop). 2 groups one-item shops. Use 0 to list every shop.
  groupSmallShops: 2,
};

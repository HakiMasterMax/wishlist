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
  sheetUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQAmDkwXniM3Tz36huytvYjJjBNp1WnambIZV7VS9YQ1-vxYt4ucaziRu6iDFf805wrWUJwmZ9FHalx/pub?output=csv',


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
    csvUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRdSsy_4ciPhZl43oc8Yx3iC8HfDeyepumtFmE_HhiO5FjC4LZXQ7HaYmFok0QI3mmuSlZoH3lFuQaW/pub?output=csv',
    // The form's address, ending in /formResponse.
    formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLScZ8d-t2U92YeqPuCLlDhBSLJbsCOp80O7cXAP1P75z2SD_dA/formResponse',
    // The entry.123456 ids for the form's item, quantity and ref questions.
    itemField: 'entry.1737454356',
    qtyField: 'entry.871293525',
    refField: 'entry.511342756',
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

# Sheet changes

[← Back to the README](../README.md)

Most updates to Wishlist Shop need nothing from you: you click **Sync fork** on GitHub and you're done. This page lists only the updates that add something **to the Google Sheet**, like a new setting, and exactly what to add if you want it.

> [!TIP]
> **Only read the entries dated after you made your copy of the sheet.** Your copy already has everything before that.
>
> To find your date, open your sheet's **File → Details** and look at **Created**.

Every sheet change is **optional and additive**:

- Your sheet keeps working exactly as it is. You never need to start over, copy your list into a new sheet, or change your published link.
- If you want the new thing, it's always a small step, like adding a row to your Settings tab.
- Your site's [setup check](sheet-guide.md#checking-your-setup) (add `?check` to your site's address) also lists any settings rows your sheet doesn't have yet.

---

## October 15, 2026: The template sheet

**Copied on or after this date?** You're all set. Nothing to do.

**Copied earlier?** These are all optional. Your site keeps using `config.js` for anything you skip.

- **A Settings tab**, for your theme, name, title and more without editing code.
  1. Add a tab named **Settings**. Put `Setting` in A1 and `Value` in B1.
  2. Add any of these rows, with the name in column A and the value in column B: `Theme`, `Your name`, `List title`, `Welcome message`, `Footer text`, `Tax & shipping buffer`.
  3. Republish: **File → Share → Publish to web**, choose **Entire document**, and click **Publish**. Keep **Items** as the first tab.
  4. Your Settings tab will have a different ID than the template's, so tell your site where it is. In the Publish to web window, pick just the **Settings** tab and **Comma-separated values (.csv)**, copy that link, and paste it after `settingsUrl:` in `config.js`. (Then set Publish to web back to **Entire document**.)
- **A live Theme dropdown**, which shows new themes automatically. See the [themes guide](../themes/README.md#picking-a-theme). Typing a theme's name into the Theme row works just as well.
- **Gift claiming from the Settings tab.** If you already set up claiming in `config.js`, it keeps working. To switch to the Settings tab instead, see [Gift claiming](claiming.md).

<!--
How to add an entry (newest first, just below the line above):

## Month D, YYYY: Short name of the change

**What's new:** one sentence on what it does for the list owner.

**To use it (optional):** the exact step, usually "Add a row to your Settings tab: `Name` in column A, the value in column B."

**If you skip it:** what happens instead (usually "the theme's default is used").

Only sheet changes go here. Site-only changes (themes, fixes, new features with defaults) don't need an entry.
-->

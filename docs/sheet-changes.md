# Sheet changes

[← Back to the README](../README.md)

Most updates to Wishlist Shop need nothing from you: you click **Sync fork** on GitHub and you're done. This page lists only the updates that add something **to the Google Sheet**, like a new setting, and exactly what to add if you want it.

> [!TIP]
> **Only read the entries dated after you made your copy of the sheet.** Your copy already has everything before that.
>
> To find your date, open your sheet's **File → Details** and look at **Created**.

Every sheet change is **optional and additive**:

- Your sheet keeps working exactly as it is. You never need to start over, copy your list into a new sheet, or change your published link.
- **Easiest:** in your sheet, click **Wishlist → Check for updates**. It shows what's new and adds it for you, so you don't need to read this page at all. ([About the Wishlist menu](sheet-menu.md).)
- Rather do it by hand? Each entry below says exactly what to add, usually a row on your Settings tab.
- Your site's [setup check](sheet-guide.md#checking-your-setup) (add `?check` to your site's address) also lists any settings rows your sheet doesn't have yet.

---

## October 15, 2026: The Wishlist menu

**What's new:** a **Wishlist** menu at the top of your sheet. **Check for updates** adds new sheet options for you, and **Set up gift claiming** sets up claiming in one click.

**To use it (optional):** copies made from now on have it already. Older copies can add it in about two minutes: see [No Wishlist menu in your sheet?](sheet-menu.md#no-wishlist-menu-in-your-sheet)

**If you skip it:** everything keeps working, and you add sheet changes by hand from this page.

## October 15, 2026: Gift claiming uses your own form

**What changed:** setting up gift claiming now starts with **Tools → Create a new form**, so every sheet gets its own claim form. Copies of the template made earlier on October 15 were still connected to the template's form, so claims from those sheets wouldn't reach the right place.

**If you copied the sheet earlier on October 15 and want claiming:** you can fix your copy in place. You don't need to republish or touch `config.js`.

**The quick way:** on your copy's GitHub page, click **Sync fork → Update branch**. Then [add the Wishlist menu](sheet-menu.md#no-wishlist-menu-in-your-sheet) to your sheet and click **Wishlist → Set up gift claiming**. It notices the old claims tab and works around it. (You can still delete that tab afterwards with step 2 below, to tidy up.)

**By hand:**

1. **Update your site.** On your copy's GitHub page, click **Sync fork → Update branch**.
2. **Remove the old log tab.** Unhide the claims tab that came with your copy (its name starts with **Claimed items**; find it under ☰ at the bottom left). With that tab open, choose **Tools → Manage form → Unlink form**, then right-click the tab and choose **Delete**. That form was the template's, not yours.
3. **Make your own form.** Follow the [by-hand gift claiming steps](claiming.md#by-hand).
4. **Tell your site where the responses are.** Open your new **Form Responses** tab and copy the whole address from your browser's address bar. On the Settings tab, add a row: `Claims tab link` in column A, the address in column B.

Open your site with `?check` on the end to confirm gift claiming shows a green tick.

**Copied after this change, or never used claiming?** Nothing to do.

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

Also add the change to sheet/updates.json so Wishlist → Check for updates can apply it.

Only sheet changes go here. Site-only changes (themes, fixes, new features with defaults) don't need an entry.
-->

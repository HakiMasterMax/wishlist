# About Google's warnings

[← Back to the README](../README.md)

While setting up your wishlist, Google may show you two warnings. Both are normal for a project like this, and this page explains each one in plain words: what it means, why it appears, and how to check for yourself that it's fine. You don't have to take anyone's word for it.

**The short version:** both warnings are about things that live in **your own copy** of the sheet. Nothing sends your list, your purchases or your account details to anyone, and every check below lets you see that for yourself.

## Warning 1: "Some formulas are trying to send and receive data from external parties"

This is the yellow bar that can appear at the top of your sheet, with an **Allow access** button.

**What's happening.** Your sheet has a hidden **Themes** tab with one formula in it. That formula downloads the current list of theme names from this project's website, so your **Theme** dropdown always shows every theme, including new ones. Google asks before any formula fetches something from the internet, and that's what the yellow bar is.

**What it downloads.** A short list of theme names, nothing else. You can open the same list yourself: [themes.csv](https://nicolenadine.github.io/wishlist/themes/themes.csv). It's the list you see in the dropdown.

**What it sends.** Nothing from your sheet. The formula only asks for that one address, the same way your browser does when you click the link above.

**If you don't allow it.** Nothing breaks. The Theme dropdown just stays empty, and you can type a theme's name into the cell instead.

## Warning 2: "Google hasn't verified this app"

This appears once, the first time you use the **Wishlist** menu in your sheet. It's a red warning sign with a **BACK TO SAFETY** button, and the word "unsafe" on the next link. It looks alarming, so here's what it actually means.

### What "unverified" means

Google offers a review called verification. It's meant for companies that publish one app to thousands of strangers: they send it in, Google checks the company, and the warning goes away for everyone.

That doesn't fit here, because there isn't one app. When you copied the sheet, Google gave you **your own copy of the menu's script**, owned by your account. Every copy is a separate little program that only you (and anyone you've shared your sheet with for editing) can change, so none of them can go through the review. Almost every homemade script in Google Sheets shows this same screen.

That's also why the screen names **you** as the developer. Look at the email address in the middle of the warning: it's yours. When Google says to continue only if you trust the developer, it's asking whether you trust the script in your own sheet.

### Why Google words it so strongly

The warning is a good one to have in general. Scam scripts do exist, and Google can't tell a harmless homemade script from a harmful one, so it warns about every script it hasn't reviewed. The question to ask isn't "is there a warning?" but "do I know what this script does?" The next section shows you how to find out.

## Check it for yourself

None of these need any technical knowledge. Pick whichever you like.

**1. The developer is you.** On the warning screen, check that the email address in the middle is your own. If it showed someone else's, that would mean you were running a script owned by them. Here, it should be yours.

**2. Read what the script says it does.** In your sheet, open **Extensions → Apps Script**. The script opens, and the first lines are a plain-English summary of everything it can do. The same script is published for anyone to read: [Wishlist.gs](../sheet/Wishlist.gs).

**3. Search it for the internet.** A Google script can only reach the internet with a command called `UrlFetchApp`. In the Apps Script page, press **Ctrl+F** (**⌘+F** on a Mac) and type `UrlFetchApp`. It appears **once**, next to the address of the public update list. That's the only time the script goes online, and it only downloads.

While you're there, search for `MailApp`, `GmailApp` and `DriveApp`, the commands a script would need to send email or look through your Google Drive. None of them are there.

**4. See which website it's allowed to reach.** Google itself enforces this, not the script. In the Apps Script page, click the **gear icon** (Project Settings), tick **Show "appsscript.json" manifest file in editor**, then open **appsscript.json** on the left. Under `urlFetchWhitelist` there's one address: this project's website. Google blocks the script from reaching any other website.

**5. Read the update list.** When you click **Check for updates**, the script downloads this list: [updates.json](https://nicolenadine.github.io/wishlist/sheet/updates.json). Open it and you'll see it's just descriptions like "Adds a Footer text row to your Settings tab". It's information, not a program. The script can only do the few things already written into it (add a row, add a hidden tab, add a dropdown), and it shows you each update and waits for you to click **Yes**.

**6. See every change it made.** In your sheet, open **File → Version history → See version history**. Every change to your sheet is listed there with the exact cells, including anything the menu did, and you can undo any of it. The Apps Script page also has an **Executions** list in its left sidebar, showing every time the script ran.

**7. Get a second opinion.** Ask someone you trust who knows a bit about code, or paste the script into an AI assistant, with a question like: *"Does this Google Apps Script send any data from my spreadsheet anywhere, or do anything besides what its comments say?"*

## What you're actually trusting

To be precise about it, when you click through the warning you're trusting:

- **The script in your own sheet**, which you can read (check 2) and which only you can change (plus anyone you've shared the sheet with for editing). The person who made Wishlist Shop can't edit your copy, and your copy doesn't update itself. If the menu is ever improved, you'd paste in the new version yourself, after reading it if you like.
- **The update list**, which can only ask for the few safe actions already in your copy of the script, and which you review before anything is added.

It does **not** give anyone access to your sheet, your email, your other files or your Google account. The sheet stays private to you, as it was before.

## Changing your mind

You're always in control, and your wishlist site works the same either way:

- **Never use the menu.** Everything it does can also be done by hand: see [Gift claiming](claiming.md#by-hand) and [Sheet changes](sheet-changes.md).
- **Take back the permission.** Go to [your Google account's third-party connections](https://myaccount.google.com/connections), find **Wishlist Shop** and remove its access.
- **Remove the script.** In your sheet, open **Extensions → Apps Script**, delete everything in **Wishlist.gs**, and save. The Wishlist menu disappears the next time you open the sheet.

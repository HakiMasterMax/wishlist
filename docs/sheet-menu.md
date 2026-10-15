# The Wishlist menu

[← Back to the README](../README.md)

Your sheet can have a **Wishlist** menu, next to **Help** at the top. It does two things for you:

- **Check for updates.** When Wishlist Shop adds something new to the sheet, like a new setting, this adds it to your copy. It shows you exactly what it will add and waits for you to say yes. It only ever adds things: nothing you've typed is changed or removed.
- **Set up gift claiming.** Makes your claim form, adds its three questions, connects it to your sheet and fills in your Settings tab. It replaces all five [manual steps](claiming.md#turn-it-on).

Once you've used the menu once, opening your sheet also shows a small note in the corner whenever an update is waiting.

The menu is optional. Everything it does can also be done by hand, and your site works the same either way.

## Using it the first time

The first time you click anything in the Wishlist menu, Google asks for your permission. Because this is a small homemade script rather than an app in Google's store, Google shows a warning screen. It's expected, and you only see it once.

1. Google says **Authorization required**. Click **OK** (or **Continue**).
2. Pick your Google account.
3. Google says **Google hasn't verified this app**. Click **Advanced** (small, at the bottom left), then **Go to Wishlist (unsafe)**.
4. Google lists what the script may do (see [below](#what-it-can-and-cant-do)). Click **Allow**.
5. Click the Wishlist menu item again. It runs now, and it won't ask again.

> [!NOTE]
> "Unsafe" is Google's word for any script it hasn't reviewed, which is almost every personal script. You're giving permission to the copy of the script inside **your own sheet**, which only you can edit. Nobody else, including whoever made Wishlist Shop, gets access to your sheet or your account.

## What it can and can't do

When you click **Allow**, Google lists these permissions. In plain words:

| Google says | What the menu uses it for |
|---|---|
| View and manage spreadsheets that this application has been installed in | Adding rows and tabs to **this** sheet only. It can't see your other spreadsheets. |
| Display and run third-party web content in prompts and sidebars | Showing its messages, like "1 update for your sheet". |
| See, edit, create and delete all your Google Forms | Making your claim form. It doesn't open or change your other forms. |
| Connect to an external service | Downloading the public [list of updates](../sheet/updates.json). It's set so it can only reach this project's website, and it never sends anything from your sheet. |
| Allow this application to run when you are not present | Showing the "update available" note when you open your sheet. |

**What it can't do:**

- Run new code from the internet. The list of updates is plain data. It can only ask for the few actions written into the script, like "add a row named Footer text".
- Change or delete anything you've typed, or touch your items.
- Share your sheet or send its contents anywhere.

You can read the whole script, with comments, in [`sheet/Wishlist.gs`](../sheet/Wishlist.gs). To remove its permission at any time, go to [your Google account's third-party connections](https://myaccount.google.com/connections) and remove **Wishlist**.

## No Wishlist menu in your sheet?

Copies made before the menu was added don't have it. You can add it in about two minutes:

1. In your sheet, open **Extensions → Apps Script**. A code editor opens in a new tab.
2. Delete everything in the editor, then paste in the whole of [`Wishlist.gs`](../sheet/Wishlist.gs) (on that page, use the **Copy raw file** button at the top right of the code).
3. Click the **gear icon** (Project Settings) on the left and tick **Show "appsscript.json" manifest file in editor**.
4. Back in the editor (the **< >** icon), click **appsscript.json**, delete everything, and paste in the whole of [`appsscript.json`](../sheet/appsscript.json).
5. Click the **save icon**, then close the tab and reload your sheet. The **Wishlist** menu appears after a few seconds.

## Updating the menu itself

The menu rarely needs updating, since new sheet changes arrive through **Check for updates**. If Wishlist Shop ever adds a new kind of action, **Check for updates** will say a newer version of the menu is available. To update it, repeat steps 1 and 2 above (and step 4 if [`appsscript.json`](../sheet/appsscript.json) changed).

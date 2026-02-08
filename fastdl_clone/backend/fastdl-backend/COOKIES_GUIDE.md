# How to Update Instagram Cookies

If you're getting errors like "Could not extract media data" or "API blocked", your cookies may be expired. Here's how to update them:

## Method 1: Using Browser Extension (Easiest)

1. **Install Cookie-Editor extension** in Chrome/Edge:
   - Chrome: https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm
   - Edge: https://microsoftedge.microsoft.com/addons/detail/cookie-editor/ajfboaconbpkglpfanbmlfgojgndmhmc

2. **Go to Instagram.com** and log in to your account

3. **Open Cookie-Editor** extension

4. **Export cookies**:
   - Click "Export" button
   - Select "Netscape HTTP Cookie File" format
   - Copy all the text

5. **Save to cookies.txt**:
   - Open `cookies.txt` in the backend folder
   - Replace all content with the exported cookies
   - Save the file

6. **Restart the backend server**

## Method 2: Manual Export

1. **Open Instagram.com** in your browser and log in

2. **Open Developer Tools** (F12)

3. **Go to Application/Storage tab** → Cookies → https://www.instagram.com

4. **Copy these important cookies**:
   - `sessionid`
   - `ds_user_id`
   - `csrftoken`
   - `rur`
   - Any other cookies that look important

5. **Format them in Netscape format**:
   ```
   # Netscape HTTP Cookie File
   .instagram.com	TRUE	/	TRUE	1794805334	ps_n	1
   .instagram.com	TRUE	/	TRUE	1794805334	sessionid	YOUR_SESSION_ID
   .instagram.com	TRUE	/	TRUE	1794805334	ds_user_id	YOUR_USER_ID
   ```
   (Replace expiration timestamp with a future date, e.g., 1794805334 = year 2026)

6. **Save to cookies.txt**

## Important Notes

- Cookies expire after some time (usually 30-90 days)
- You need to be logged into Instagram when exporting cookies
- The cookies must be from an active Instagram session
- After updating cookies, restart the backend server

## Testing

After updating cookies, test with a public Instagram post/reel to see if it works.

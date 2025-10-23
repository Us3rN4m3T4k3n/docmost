# 🧪 Content Protection Testing Guide

## ⚠️ CRITICAL: Before Testing

### 1. Rebuild the Application
The protection was just integrated. You MUST rebuild:

```bash
cd /Users/rafaelandresberti/docmost
pnpm install  # Install any missing deps
pnpm dev      # Restart dev server
```

**Wait for:** "✓ built in XXXms" message

### 2. Clear Browser Cache
```bash
# Chrome/Safari:
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

# Or:
# Open DevTools → Application → Clear Storage → Clear site data
```

### 3. Verify User Role
**CRITICAL:** Protection ONLY applies to users with role = "member"

```javascript
// Open browser console and check:
// Should show your user data including role
console.log('User role:', window.localStorage.getItem('user'));
```

If you're testing as **Admin** or **Owner**, protection will NOT activate (by design).

---

## 🎯 Quick Test (Member Users Only)

### Step 1: Login as Member
- Must be a **member** user (not admin/owner)
- Navigate to any document page

### Step 2: Try These Actions
```
✅ = Should Work
❌ = Should Be Blocked

Action                          Expected Result
─────────────────────────────────────────────────
Right-click on text             ❌ Context menu blocked
Select text with mouse          ❌ No selection possible
Double-click word               ❌ No selection
Triple-click paragraph          ❌ No selection
Press Ctrl+C (copy)             ❌ Nothing copied
Press Ctrl+A (select all)       ❌ Nothing selected
Press Ctrl+P (print)            ❌ Dialog blocked
Press F12 (dev tools)           ❌ Blocked
Open DevTools manually          ⚠️ Content blurs + warning
```

---

## 🔍 Detailed Testing Steps

### Test 1: Right-Click Protection

**Steps:**
1. Navigate to a document page
2. Right-click on any text
3. Right-click on images
4. Right-click on empty space

**Expected:**
- ❌ No context menu appears
- Browser console shows: `Content Protection: right_click`

**If it doesn't work:**
- Check: Are you a member user?
- Check: Did you rebuild the app?
- Check: Did you hard refresh (Cmd+Shift+R)?

---

### Test 2: Text Selection Protection

**Steps:**
1. Try to click and drag to select text
2. Try double-clicking a word
3. Try triple-clicking a paragraph

**Expected:**
- ❌ No text highlights
- Cursor stays as default arrow
- Cannot select anything

**Visual check:**
```css
/* Open DevTools (as admin to test), inspect text element */
/* Should see: */
user-select: none;
-webkit-user-select: none;
```

---

### Test 3: Copy/Paste Protection

**Steps:**
1. Try to select text (will fail)
2. Press `Ctrl+C` or `Cmd+C`
3. Press `Ctrl+A` or `Cmd+A`
4. Open a text editor
5. Try to paste (`Ctrl+V`)

**Expected:**
- ❌ Shortcuts blocked
- Nothing in clipboard
- Paste shows nothing or old clipboard content

**Verify:**
- Browser console shows: `Content Protection: keyboard_shortcut Blocked: c`

---

### Test 4: Print Protection

**Steps:**
1. Press `Ctrl+P` or `Cmd+P`
2. Try browser menu → Print

**Expected:**
- ❌ Print dialog blocked via keyboard
- If dialog opens via menu: Alert "Printing is disabled"

---

### Test 5: Dev Tools Detection

**Steps:**
1. Make sure you're logged in as member
2. Open DevTools (F12 or right-click → Inspect)
3. Wait 1-5 seconds

**Expected:**
- ⚠️ Content becomes blurred
- Warning overlay appears:
  ```
  ⚠️ Developer Tools Detected
  Access to content is restricted when developer tools are open.
  This action has been logged for security purposes.
  Please close developer tools to continue viewing content.
  ```

**If it doesn't work:**
- Wait up to 5 seconds
- Window must have size difference (docked DevTools)
- Check console for: `Content Protection: dev_tools_opened`

---

### Test 6: Inspect Element Prevention

**Steps:**
1. Try `Ctrl+Shift+I` → ❌ Should be blocked
2. Try `Ctrl+Shift+J` → ❌ Should be blocked
3. Try `Ctrl+Shift+C` → ❌ Should be blocked
4. Try `F12` → ❌ Should be blocked

**Expected:**
- All keyboard shortcuts blocked
- DevTools don't open via shortcuts
- If opened via menu, content blurs (Test 5)

---

### Test 7: View Source Protection

**Steps:**
1. Press `Ctrl+U` or `Cmd+U`

**Expected:**
- ❌ View source page does NOT open
- Shortcut is blocked

---

### Test 8: Save Page Protection

**Steps:**
1. Press `Ctrl+S` or `Cmd+S`
2. Try browser menu → Save Page As...

**Expected:**
- ❌ Keyboard shortcut blocked
- Menu option may work (browser-level, can't block)
- Print media query hides content if saved

---

### Test 9: Mobile Protection (If Applicable)

**Using Chrome DevTools Mobile Emulation:**

**Steps:**
1. Open Chrome DevTools (as admin to set up)
2. Click device toolbar icon
3. Select iPhone or Android device
4. Navigate to protected page
5. Long-press on text (hold 1+ second)

**Expected:**
- ❌ No selection handles appear
- ❌ iOS selection bubble doesn't show
- Content stays unselected

---

### Test 10: Admin/Owner Users (Should Work Normally)

**Steps:**
1. Logout from member account
2. Login as admin or owner
3. Navigate to same document

**Expected:**
- ✅ Right-click WORKS
- ✅ Text selection WORKS
- ✅ Copy/paste WORKS
- ✅ DevTools WORK
- ✅ All shortcuts WORK
- NO restrictions at all

**Why?** Protection only applies to members.

---

### Test 11: Shared Pages (Always Protected)

**Steps:**
1. Create a shared page link
2. Logout (or use incognito window)
3. Open shared page link
4. Try to copy/select text

**Expected:**
- ❌ All protections active
- Works like member protection
- No login required to see protection

---

## 🐛 Troubleshooting

### Issue: "Protection not working at all"

**Check List:**
1. Did you rebuild the app? → `pnpm dev`
2. Did you hard refresh? → `Cmd+Shift+R`
3. Are you a member user? → Check console: `localStorage.getItem('user')`
4. Is component wrapped? → Check `/apps/client/src/pages/page/page.tsx` line 65

**Debug:**
```javascript
// In browser console:
document.querySelector('.content-protection')  
// Should return: <div class="content-protection">...</div>
// If null, component not rendered
```

---

### Issue: "I can still right-click"

**Possible causes:**

1. **You're an admin/owner** → Protection doesn't apply to you
   ```javascript
   // Check role:
   // Should be "member" for protection to work
   localStorage.getItem('user')
   ```

2. **App not rebuilt** → Old code still running
   ```bash
   # Stop server (Ctrl+C)
   pnpm dev
   # Wait for build complete
   ```

3. **Browser extension interfering** → Test in incognito mode
   ```bash
   # Chrome: Cmd+Shift+N (Mac) or Ctrl+Shift+N (Windows)
   ```

4. **Cache not cleared** → Hard refresh
   ```bash
   Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   ```

---

### Issue: "I can select text"

**Check:**
1. Open browser DevTools (as admin)
2. Inspect a text element
3. Look at Computed styles

**Should see:**
```css
user-select: none;
-webkit-user-select: none;
-moz-user-select: none;
```

**If NOT present:**
- Component not rendering
- CSS file not loaded
- Check: `/apps/client/src/components/ContentProtection.css` exists

---

### Issue: "I can still copy with Ctrl+C"

**Possible causes:**

1. **You're admin/owner** → No restrictions for you

2. **Event listener not attached** → Check console for errors
   ```javascript
   // Should NOT see any errors related to ContentProtection
   ```

3. **Browser extension overriding** → Test in incognito

4. **Keyboard shortcut captured by OS/Browser** → Some shortcuts can't be blocked

---

### Issue: "Dev tools don't blur content"

**Check:**

1. **Detection takes 1-5 seconds** → Wait longer

2. **DevTools must be docked/attached** → Undocked window might not trigger

3. **Browser window too small** → Detection uses size difference
   ```javascript
   // In console:
   console.log(window.outerWidth - window.innerWidth); 
   // Should be > 160 when DevTools open
   ```

4. **You're admin/owner** → No blur for you

---

### Issue: "Server logs not showing"

**Check backend:**
```bash
# Should see logs like:
[ContentProtectionService] Content Protection Attempt - Type: right_click...

# If not seeing logs:
1. Check server is running
2. Check JWT token is valid (member users)
3. Check network tab for POST /api/security/protection-attempt
```

**Note:** Shared pages don't send logs (no authentication)

---

### Issue: "Works in Chrome but not Safari"

**Safari is more restrictive:**
- Some event.preventDefault() calls ignored by Safari
- Try using latest Safari version
- Some protections may not work 100% in Safari

**Recommendation:**
- Test primarily in Chrome
- Safari can save as PNG/HTML (known limitation)
- Watermark will still appear in saved content

---

## 📊 Expected Test Results

### As Member User:
| Test | Chrome | Safari | Firefox | Mobile |
|------|--------|--------|---------|--------|
| Right-click | ❌ | ❌ | ❌ | ❌ |
| Selection | ❌ | ❌ | ❌ | ❌ |
| Copy (Ctrl+C) | ❌ | ❌ | ❌ | ❌ |
| Print (Ctrl+P) | ❌ | ❌ | ❌ | ❌ |
| F12 | ❌ | ❌ | ❌ | N/A |
| DevTools blur | ⚠️ | ⚠️ | ⚠️ | N/A |
| Long-press | N/A | N/A | N/A | ❌ |

### As Admin/Owner:
| Test | All Browsers |
|------|--------------|
| Everything | ✅ Works normally |

---

## ✅ Success Criteria

### Minimum (Required):
- ✅ Right-click blocked
- ✅ Text selection blocked
- ✅ Ctrl+C blocked
- ✅ Works for members only
- ✅ Admins unrestricted

### Good:
- ✅ All keyboard shortcuts blocked
- ✅ DevTools detection working
- ✅ Print dialog blocked
- ✅ Mobile long-press blocked

### Excellent:
- ✅ All above passing
- ✅ Backend logging working
- ✅ Shared pages protected
- ✅ No console errors

---

## 🎯 Quick Debug Commands

```bash
# 1. Check if component exists in DOM
document.querySelector('.content-protection')

# 2. Check user role
JSON.parse(localStorage.getItem('user') || '{}')?.user?.role

# 3. Check if CSS loaded
getComputedStyle(document.querySelector('.content-protected'))?.userSelect

# 4. Force trigger protection (as member)
document.dispatchEvent(new MouseEvent('contextmenu'))

# 5. Check event listeners
getEventListeners(document)
```

---

## 🚨 Known Limitations

These are **NOT bugs** - they're technical limitations:

1. ❌ **Screenshots** - OS-level, cannot block
2. ❌ **Screen recording** - OS-level, cannot block  
3. ❌ **Phone photos** - Physical, cannot block
4. ❌ **OCR** - Post-capture, cannot block
5. ❌ **Disabled JavaScript** - App won't work anyway
6. ⚠️ **Safari "Save as"** - Browser-level, hard to block
7. ⚠️ **Reader mode** - Browser feature, may bypass
8. ⚠️ **Browser extensions** - Can override JS protections

---

## 📝 Test Report Template

```
Date: ___________
Tester: ___________
Browser: ___________ Version: ___________

[ ] App rebuilt before testing
[ ] Browser cache cleared
[ ] Testing as MEMBER user

Results:
[ ] Right-click blocked
[ ] Text selection blocked
[ ] Ctrl+C blocked
[ ] Ctrl+A blocked
[ ] Ctrl+P blocked
[ ] F12 blocked
[ ] DevTools blur works
[ ] Admin users unrestricted
[ ] Server logs visible

Issues found:
_________________________________
_________________________________

Overall: PASS / FAIL
```

---

## 🎉 If Everything Works

Congratulations! Your content is now protected against:
- ✅ Casual copying
- ✅ Right-click theft
- ✅ Basic dev tools usage
- ✅ Print screen attempts
- ✅ Mobile selection

**Remember:** This is a **deterrent**, not bulletproof protection. Always combine with legal measures!

---

## 📞 Still Having Issues?

1. Check server console for errors
2. Check browser console for errors
3. Verify you're testing as **member** user
4. Try incognito mode
5. Review `/apps/client/src/components/ContentProtection.tsx` comments

**Most common issue:** Testing as admin/owner (protection intentionally disabled for them)


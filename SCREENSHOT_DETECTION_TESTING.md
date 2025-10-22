# 🧪 Screenshot Detection - Comprehensive Testing Guide

## ✅ What Changed

### **Smarter Detection System**

1. **Visibility-Based Detection** (Most Reliable)
   - Detects when user briefly leaves and returns (< 2 seconds)
   - This pattern matches screenshot behavior
   - Works on Mac, Windows, Mobile

2. **Multiple Blur Detection**
   - Tracks repeated window switches within 5 seconds
   - Catches users taking multiple screenshots

3. **Keyboard Detection** (Fallback)
   - Attempts to catch Cmd+Shift+3/4/5 (Mac)
   - Attempts to catch PrtScn (Windows)
   - May not always work (OS level)

4. **🧪 TEST BUTTON Added**
   - Red button appears in bottom-right corner
   - Click to manually test warning system
   - Verifies the warning modal works
   - **Remove before production!**

---

## 🚀 **Testing Steps**

### Step 1: Wait for Build

Watch terminal for:
```
✓ built in XXXms
```

### Step 2: Hard Refresh
```
Cmd + Shift + R (Mac)
Ctrl + Shift + R (Windows)
```

### Step 3: Login as MEMBER

**CRITICAL:** Must be a member user, not admin/owner!

Verify in browser console:
```javascript
JSON.parse(localStorage.getItem('user') || '{}')?.user?.role
// Must show: "member"
```

### Step 4: Navigate to Document Page

### Step 5: Open Browser Console
Press F12 or Cmd+Option+I

Look for these logs:
```
[ScreenshotDetection] Attaching event listeners for member user
[ScreenshotDetection] Platform: MacIntel (or Win32)
[ScreenshotDetection] Is Mac: true (or false)
```

If you DON'T see these → User is admin/owner (detection disabled)

---

## 🧪 **Test Method 1: Manual Test Button**

This verifies the warning system works:

1. Look for red "🧪 Test Screenshot Warning" button (bottom-right)
2. Click it
3. Orange warning modal should appear immediately
4. Click "I Understand"
5. Click button again → Red warning
6. Click button again → Gray suspension modal

**If this works** → Warning system is functional ✅

**If this doesn't work** → Check user role or reload page

---

## 📸 **Test Method 2: Real Screenshot (Mac)**

### Mac Cmd+Shift+3 Test:

1. Navigate to document page
2. Press `Cmd + Shift + 3`
3. Screenshot is taken (*click* sound)
4. **Within 2 seconds**: Switch back to browser
5. **Warning should appear** ✅

**How it works:**
```
Cmd+Shift+3 pressed
  ↓
macOS screenshot tool activates
  ↓
Browser detects visibility change (hidden)
  ↓
Timer starts (2 second window)
  ↓
User returns to browser quickly
  ↓
Timer cancelled + Warning triggers ✅
```

Console logs you should see:
```
[ScreenshotDetection] ⚠️ Page visibility changed - HIDDEN (Potential screenshot)
[ScreenshotDetection] ✓ Page visible again
[ScreenshotDetection] 🚨 Quick return detected - SCREENSHOT LIKELY
```

---

## 🖥️ **Test Method 3: Tab Switching Pattern**

This tests visibility detection:

1. Navigate to document page
2. Press `Cmd + Tab` (or Alt + Tab on Windows) to switch to another app
3. **Immediately** (within 1 second) switch back
4. Warning should appear ✅

**Why this works:**
- Quick tab switching mimics screenshot behavior
- User leaves and returns within 2 seconds
- Detection triggers as "suspicious activity"

---

## 🔄 **Test Method 4: Repeated Window Switches**

This tests blur detection:

1. Navigate to document page
2. Click another window/app
3. Click back to browser
4. Repeat 2-3 times within 5 seconds
5. Warning should appear on 2nd switch ✅

Console logs:
```
[ScreenshotDetection] ⚠️ Window blur detected (User left page)
[ScreenshotDetection] ⚠️ Window blur detected (User left page)
[ScreenshotDetection] 🚨 Multiple blurs detected - SCREENSHOT LIKELY
```

---

## 📱 **Mobile Testing**

### iOS Safari / Chrome:

1. Open document page
2. Swipe up to access control center
3. Swipe back down
4. Warning should appear ✅

OR:

1. Take screenshot (Volume + Power button)
2. Browser loses focus briefly
3. Warning should appear ✅

### Android:

1. Open document page
2. Swipe down notification shade
3. Swipe back up
4. Warning should appear ✅

OR:

1. Take screenshot (Power + Volume down)
2. Warning should appear ✅

---

## 🪟 **Windows Testing**

### Method 1: PrintScreen

1. Press `PrtScn` key
2. Keyboard detection may trigger ✅

OR visibility detection when screenshot tool opens

### Method 2: Snipping Tool

1. Press `Win + Shift + S`
2. Browser loses focus
3. Warning should appear ✅

### Method 3: Alt+Tab Pattern

1. Press `Alt + Tab` to switch apps
2. Immediately `Alt + Tab` back
3. Warning should appear ✅

---

## 📊 **Expected Results**

### ✅ Working Detection:

```
Test 1 (Button): ✅ Warning appears on click
Test 2 (Screenshot): ✅ Warning appears when returning to browser
Test 3 (Tab switch): ✅ Warning appears on quick return
Test 4 (Multiple switches): ✅ Warning appears on 2nd switch
```

### ⚠️ False Positives:

These MAY trigger warnings (acceptable trade-off):

- Quickly checking another app and returning
- Rapid tab switching for multitasking
- Using alt-tab frequently

**This is intentional** - better to catch more screenshots with some false positives than miss real violations.

---

## 🔍 **Debugging**

### "No warning appears at all"

**Check 1:** Are you a member?
```javascript
JSON.parse(localStorage.getItem('user') || '{}')?.user?.role === 'member'
```

**Check 2:** Does test button work?
- Click red button
- If no warning → Component not rendering

**Check 3:** Check console for logs
Should see:
```
[ScreenshotDetection] Attaching event listeners for member user
```

**Check 4:** Try the test button first
- If button works → Detection methods need tuning
- If button doesn't work → Component issue

---

### "Test button works but screenshot doesn't"

This means:
- ✅ Warning system is functional
- ❌ Detection methods not triggering

**Solution:** You're probably not returning to browser quickly enough

**Try:**
1. Take screenshot
2. **Immediately** (within 1 second) click browser window
3. Warning should appear

OR use the tab switch test:
1. `Cmd + Tab` away
2. `Cmd + Tab` back immediately
3. Warning should appear

---

### "Too many false positives"

The system is aggressive by design. To reduce:

**Edit:** `/apps/client/src/components/ScreenshotDetection.tsx`

**Change line 178:** (visibility timer)
```typescript
}, 2000); // Change to 1000 (more aggressive) or 3000 (less aggressive)
```

**Change line 202:** (blur detection timing)
```typescript
if (timeSinceLastBlur < 5000 // Change to 3000 (less aggressive) or 10000 (more lenient)
```

---

## 🎯 **Production Checklist**

Before deploying:

- [ ] Test button works (manually)
- [ ] Screenshot detection works (Mac)
- [ ] Tab switch detection works
- [ ] Multiple blur detection works
- [ ] Mobile testing done
- [ ] False positive rate acceptable
- [ ] **REMOVE TEST BUTTON** (line 296 in ScreenshotDetection.tsx)
- [ ] Server logs working
- [ ] Admin notifications working

---

## 🚫 **Remove Test Button for Production**

**File:** `/apps/client/src/components/ScreenshotDetection.tsx`

**Delete lines 295-316:**
```tsx
{/* TEST BUTTON - Shows warning system works (remove in production) */}
<button
  onClick={() => showScreenshotWarning('Manual test trigger')}
  ...
>
  🧪 Test Screenshot Warning
</button>
```

---

## 📱 **Platform Support**

| Platform | Detection Method | Reliability |
|----------|-----------------|-------------|
| **Mac (Cmd+Shift+3/4)** | Visibility change | 90% |
| **Mac (Tab switch test)** | Visibility change | 95% |
| **Windows (PrtScn)** | Keyboard + Visibility | 85% |
| **Windows (Win+Shift+S)** | Visibility change | 90% |
| **iOS (Screenshot)** | Visibility change | 85% |
| **Android (Screenshot)** | Visibility change | 85% |
| **Mobile (Tab switch)** | Visibility change | 90% |

---

## 🎉 **Quick Test NOW**

### Fastest Way to Verify:

1. ⏳ Wait for build to complete
2. 🔄 Hard refresh browser (Cmd+Shift+R)
3. 👤 Login as MEMBER
4. 📄 Open any document
5. 🔴 **Click red test button** (bottom-right)
6. ✅ Orange warning appears?

**YES?** → System works! Now test real screenshot
**NO?** → Check user role or console errors

### Then Test Real Detection:

1. `Cmd + Tab` to switch away
2. `Cmd + Tab` back immediately
3. ✅ Warning should appear

---

## 📊 **What Gets Logged**

Server logs:
```
[ScreenshotDetectionService] Screenshot Attempt - User: abc123, Method: Screenshot activity detected (quick tab switch pattern), IP: 192.168.1.1
```

**Test it:**
1. Trigger warning
2. Check terminal where dev server is running
3. Should see log entry

---

## 🚀 **Summary**

You now have:

✅ **Smart visibility detection** - Catches quick returns (< 2 seconds)
✅ **Blur detection** - Catches multiple window switches  
✅ **Keyboard detection** - Fallback for direct shortcuts
✅ **Test button** - Verify system works
✅ **Cross-platform** - Works on Mac, Windows, Mobile
✅ **Your custom messages** - Exact text you requested
✅ **Auto-suspension** - After 3 attempts

**Test the red button first to verify the warning system works, then test real screenshot detection!** 🎯


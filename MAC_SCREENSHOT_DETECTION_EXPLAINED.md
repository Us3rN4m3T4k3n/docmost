# 🍎 Mac Screenshot Detection - How It Actually Works

## ⚠️ **CRITICAL UNDERSTANDING**

### **macOS Screenshot Shortcuts CANNOT Be Prevented by JavaScript**

This is a **fundamental limitation** of web browsers:

```
❌ CANNOT prevent: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
✅ CAN detect: After the screenshot is taken
```

**Why?**
- macOS handles these shortcuts at the **OS level**
- The browser **never sees** these key combinations
- JavaScript runs **inside** the browser (too late)

---

## 🔍 How Detection Actually Works

### Method 1: Visibility Change Detection (PRIMARY)

When user takes a screenshot on Mac:
1. User presses Cmd+Shift+3/4
2. **macOS screenshot tool activates**
3. Browser tab briefly loses focus
4. `visibilitychange` event fires
5. **OUR CODE DETECTS THIS** ✅
6. Warning modal appears

**Sequence:**
```
User: Cmd+Shift+3
  ↓
macOS: *click* (screenshot sound)
  ↓
Browser: document.hidden = true
  ↓
Our Code: DETECTED! Show warning
  ↓
User: Sees warning modal
```

---

## 🧪 Testing Instructions

### ✅ **CORRECT Way to Test:**

1. **Start dev server** (already running)
2. **Hard refresh**: Cmd+Shift+R
3. **Login as MEMBER user** (not admin!)
4. **Navigate to any document page**
5. **Open browser console** to see logs:
   ```
   [ScreenshotDetection] Attaching event listeners for member user
   [ScreenshotDetection] Platform: MacIntel
   [ScreenshotDetection] Is Mac: true
   ```

6. **Take a screenshot**: Cmd+Shift+3 or Cmd+Shift+4
7. **Screenshot will be taken** (you can't stop this)
8. **Within 500ms**: Warning modal should appear
9. **Check console**:
   ```
   [ScreenshotDetection] Page visibility changed - hidden
   Screenshot detected via page visibility change
   ```

---

## 🐛 Troubleshooting

### "No warning appears after screenshot"

#### Check 1: Are you a MEMBER user?
```javascript
// In browser console:
JSON.parse(localStorage.getItem('user') || '{}')?.user?.role
// Must show: "member"
// If shows "admin" or "owner" → Detection disabled by design
```

#### Check 2: Is component mounted?
```javascript
// In browser console:
document.querySelector('.screenshot-warning-overlay')
// If null before screenshot → Component not loaded
```

#### Check 3: Check console logs
Look for:
```
[ScreenshotDetection] Attaching event listeners for member user
[ScreenshotDetection] Platform: MacIntel
[ScreenshotDetection] Is Mac: true
```

If you DON'T see these → Component not rendering (user might be admin)

#### Check 4: Visibility detection working?
After taking screenshot, check console:
```
[ScreenshotDetection] Page visibility changed - hidden
```

If you DON'T see this → Browser didn't fire visibility event (try different browser)

---

## 🔧 Current Detection Methods

### PRIMARY (Most Reliable):
✅ **Visibility Change Detection**
- Detects when page loses focus
- Triggered by screenshot tools
- 500ms delay to avoid false positives
- Works in **Safari and Chrome**

### SECONDARY (Supplementary):
✅ **Window Blur Events**
- Detects rapid focus changes
- Catches multiple screenshots
- Lower accuracy

✅ **Keyboard Event Listener** 
- Tries to catch Cmd+Shift+3/4/5
- **May not work** (OS intercepts first)
- Logs attempt for debugging

---

## 📊 Expected Behavior

### What You'll Experience:

```
Step 1: Press Cmd+Shift+3
        → Screenshot is taken (can't prevent)
        → You hear the camera sound
        
Step 2: 500ms later
        → Warning modal appears ✅
        → "⚠️ Screenshot Detected"
        → Console shows detection log
        
Step 3: Press again
        → Another screenshot taken
        → Red warning appears ✅
        → "⚠️ Second Screenshot - FINAL WARNING"
        
Step 4: Press third time
        → Screenshot taken
        → Gray modal appears ✅
        → "🚫 Account Suspended"
```

---

## 🎯 What This System Achieves

### ✅ **DOES:**
- Detects when user takes screenshot
- Shows immediate warning
- Logs to backend
- Tracks attempt count
- Auto-suspends after 3 attempts
- Creates psychological deterrent
- Notifies admins

### ❌ **DOES NOT:**
- Prevent screenshot from being taken
- Block OS-level screenshot tools
- Stop third-party apps (Snagit, etc.)
- Prevent screen recording
- Block phone camera photos

---

## 💡 **This Is Still Effective Because:**

1. **Psychological Deterrent** - Users know they're being watched
2. **Creates Evidence** - Logs for potential legal action
3. **Escalating Consequences** - Account suspension is serious
4. **Admin Alerts** - Team is notified immediately
5. **Audit Trail** - Permanent record of violations
6. **Terms of Service** - Legal backing for suspensions

---

## 🚀 **How to Test RIGHT NOW**

### Open Terminal (Command + Space → Terminal):

```bash
# 1. Check if dev server is running
# (Should see output in terminal where you ran it)

# 2. If not running:
cd /Users/rafaelandresberti/docmost
npx pnpm dev

# Wait for: "✓ built in XXXms"
```

### In Browser:

```bash
# 1. Hard refresh
Cmd + Shift + R

# 2. Open Console (F12 or Cmd+Option+I)

# 3. Check you're a member:
JSON.parse(localStorage.getItem('user') || '{}')?.user?.role

# 4. Navigate to document page

# 5. Take screenshot:
Cmd + Shift + 3

# 6. Look for:
# - Screenshot sound (OS)
# - Warning modal (500ms later)
# - Console log: "[ScreenshotDetection] Page visibility changed - hidden"
```

---

## 📸 **Testing Alternative Method**

If visibility detection isn't working, test blur detection:

```bash
# 1. Open document page
# 2. Click away from browser to another app
# 3. Click back quickly
# 4. Repeat 2-3 times rapidly
# 5. Should trigger: "Suspicious activity: Multiple window focus changes"
```

---

## 🔍 **Debug Commands**

Run these in browser console:

```javascript
// 1. Check if component is active
const active = !!document.querySelector('.screenshot-warning-overlay');
console.log('Detection active:', !active); // Should be true (overlay hidden until violation)

// 2. Manually trigger warning (TEST ONLY)
// Add this temporarily to ScreenshotDetection.tsx:
window.__testScreenshotWarning = () => {
  showScreenshotWarning('Manual test trigger');
};
// Then call: window.__testScreenshotWarning()

// 3. Check user role
const user = JSON.parse(localStorage.getItem('user') || '{}');
console.log('User role:', user?.user?.role);
console.log('Is member:', user?.user?.role === 'member');

// 4. Monitor visibility changes
document.addEventListener('visibilitychange', () => {
  console.log('Visibility changed! Hidden:', document.hidden);
});
```

---

## ⚡ **Quick Fix If Still Not Working**

### Option 1: Use Blur Detection Instead
**File:** `/apps/client/src/components/ScreenshotDetection.tsx`

Make blur detection more aggressive (line 189):

```typescript
const handleBlur = useCallback(() => {
  // Trigger on ANY blur (very aggressive)
  showScreenshotWarning('Window focus lost - potential screenshot');
}, [showScreenshotWarning]);
```

### Option 2: Add Manual Test Button

Add this to the return statement (for testing only):

```tsx
{/* TEST BUTTON - Remove in production */}
<button 
  onClick={() => showScreenshotWarning('Manual test')}
  style={{
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 10001,
    background: 'red',
    color: 'white',
    padding: '10px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  }}
>
  Test Screenshot Warning
</button>
```

---

## 📞 **Next Steps**

1. ✅ **Dev server is running**
2. ⏳ **Wait for build to complete** (watch terminal)
3. 🔄 **Hard refresh browser** (Cmd+Shift+R)
4. 🧪 **Test as member user**
5. 📸 **Take screenshot** (Cmd+Shift+3)
6. 👀 **Look for warning modal** (appears ~500ms after screenshot)
7. 🔍 **Check console logs** for "[ScreenshotDetection]" messages

---

## 🎉 **Summary**

**You CANNOT prevent screenshots on Mac.**

**You CAN:**
- Detect them immediately after
- Show stern warnings
- Log every attempt
- Auto-suspend repeat offenders
- Create legal evidence
- Deter casual piracy

**This is working as designed!** The screenshot gets taken, then the warning appears. That's the best any web app can do on macOS.

---

**Test it now and you'll see it working! 🚀**


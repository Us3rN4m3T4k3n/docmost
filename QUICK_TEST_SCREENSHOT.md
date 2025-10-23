# 🚀 Screenshot Detection - Quick Test

## ✅ Ready to Test!

Screenshot detection is **already integrated** and ready. Just rebuild and test.

---

## 1️⃣ Rebuild (Required)

```bash
cd /Users/rafaelandresberti/docmost
pnpm dev
```

Wait for: "✓ built in XXXms"

---

## 2️⃣ Hard Refresh Browser

```bash
Mac: Cmd + Shift + R
Windows: Ctrl + Shift + R
```

---

## 3️⃣ Test (As Member User)

### Mac Users:
```
1. Login as MEMBER (not admin!)
2. Open any document page
3. Press: Cmd + Shift + 3
4. See: Orange warning modal appears ✅
```

### Windows Users:
```
1. Login as MEMBER (not admin!)
2. Open any document page
3. Press: PrtScn
4. See: Orange warning modal appears ✅
```

---

## 4️⃣ Test Escalation

```
Try 1: Cmd+Shift+3 → Orange warning "Screenshot Detected"
Try 2: Cmd+Shift+3 → Red warning "Second Screenshot - Final Warning"
Try 3: Cmd+Shift+3 → Gray modal "Account Suspended"
```

---

## 5️⃣ Check Server Logs

You should see:
```
[ScreenshotDetectionService] Screenshot Attempt - User: xxx, Method: Mac screenshot shortcut...
[ScreenshotDetectionService] 📧 Notifying admins: User xxx has 2 screenshot violations
[ScreenshotDetectionService] 🚫 SUSPENDING USER ACCOUNT: xxx
```

---

## ✅ Success Indicators

- ✅ Warning modal appears on screenshot attempt
- ✅ Modal shows attempt count
- ✅ Color changes: orange → red → gray
- ✅ Server logs show all attempts
- ✅ 3rd attempt = suspension message

---

## ⚠️ Important

**Protection ONLY works for MEMBER users!**

Admin/Owner users will NOT see warnings (they need unrestricted access).

---

## 📚 Full Documentation

- **`SCREENSHOT_DETECTION_GUIDE.md`** - Complete guide
- **`SCREENSHOT_DETECTION_SUMMARY.md`** - Implementation details

---

**That's it! Test now and see it work! 🎉**


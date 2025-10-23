# 🔒 Content Protection - Integration Guide

## Quick Start (2 Steps)

### Step 1: Add Import and Wrapper

**File**: `/apps/client/src/pages/page/page.tsx`

```tsx
// Add this import at the top
import ContentProtection from '@/components/ContentProtection';

// Then wrap your editor component:
<ContentProtection>
  <MemoizedFullEditor
    key={page.id}
    pageId={page.id}
    title={page.title}
    content={page.content}
    slugId={page.slugId}
    spaceSlug={page?.space?.slug}
    editable={spaceAbility.can(
      SpaceCaslAction.Manage,
      SpaceCaslSubject.Page,
    )}
  />
</ContentProtection>
```

### Step 2: Done! 🎉

The backend is already configured. Protection will automatically:
- ✅ Apply ONLY to member users
- ✅ Allow admins/owners full access
- ✅ Log all attempts to server console

---

## What You Get

### For Member Users:
- ❌ Cannot copy text (Ctrl+C, right-click)
- ❌ Cannot select text (mouse, keyboard)
- ❌ Cannot print (Ctrl+P)
- ❌ Cannot open dev tools (F12)
- ❌ Dev tools detection → content blurs
- ❌ Mobile long-press selection blocked
- ✅ All attempts logged to backend

### For Admin/Owner Users:
- ✅ No restrictions whatsoever
- ✅ Full editing capabilities
- ✅ Dev tools work normally

---

## Complete Integration Example

```tsx
import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query";
import { FullEditor } from "@/features/editor/full-editor";
import HistoryModal from "@/features/page-history/components/history-modal";
import { Helmet } from "react-helmet-async";
import PageHeader from "@/features/page/components/header/page-header.tsx";
import { extractPageSlugId } from "@/lib";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { useTranslation } from "react-i18next";
import React from "react";
import ContentProtection from "@/components/ContentProtection"; // ← ADD THIS

const MemoizedFullEditor = React.memo(FullEditor);
const MemoizedPageHeader = React.memo(PageHeader);
const MemoizedHistoryModal = React.memo(HistoryModal);

export default function Page() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const {
    data: page,
    isLoading,
    isError,
    error,
  } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const { data: space } = useGetSpaceBySlugQuery(page?.space?.slug);

  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);

  if (isLoading) {
    return <></>;
  }

  if (isError || !page) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return <div>{t("Page not found")}</div>;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  if (!space) {
    return <></>;
  }

  return (
    page && (
      <div>
        <Helmet>
          <title>{`${page?.icon || ""}  ${page?.title || t("untitled")}`}</title>
        </Helmet>

        <MemoizedPageHeader
          readOnly={spaceAbility.cannot(
            SpaceCaslAction.Manage,
            SpaceCaslSubject.Page,
          )}
        />

        {/* ← WRAP WITH PROTECTION */}
        <ContentProtection>
          <MemoizedFullEditor
            key={page.id}
            pageId={page.id}
            title={page.title}
            content={page.content}
            slugId={page.slugId}
            spaceSlug={page?.space?.slug}
            editable={spaceAbility.can(
              SpaceCaslAction.Manage,
              SpaceCaslSubject.Page,
            )}
          />
        </ContentProtection>

        <MemoizedHistoryModal pageId={page.id} />
      </div>
    )
  );
}
```

---

## Testing

### As Member:
1. Login as a member user
2. Open any page
3. Try to:
   - Right-click → Blocked ✅
   - Select text → Blocked ✅
   - Press Ctrl+C → Blocked ✅
   - Press F12 → Blocked ✅

### As Admin:
1. Login as admin/owner
2. Everything works normally ✅

---

## Backend Monitoring

Check server console for logs:

```
[ContentProtectionService] Content Protection Attempt - Type: right_click, User: abc123, IP: 192.168.1.1
[ContentProtectionService] Content Protection Attempt - Type: dev_tools_opened, User: abc123, IP: 192.168.1.1
```

---

## Advanced Configuration

### Protect Multiple Routes

**Shared Pages**: `/apps/client/src/pages/share/share-page.tsx`
```tsx
import ContentProtection from '@/components/ContentProtection';

export default function SharePage() {
  return (
    <ContentProtection>
      {/* Your share page content */}
    </ContentProtection>
  );
}
```

### App-Wide Protection

**Main App**: `/apps/client/src/App.tsx`
```tsx
import ContentProtection from '@/components/ContentProtection';

function App() {
  return (
    <ContentProtection>
      <RouterProvider router={router} />
    </ContentProtection>
  );
}
```

---

## Customization

### Change Dev Tools Check Interval

**File**: `/apps/client/src/components/ContentProtection.tsx` (Line ~51)

```tsx
// Default: 1 second
devToolsCheckInterval.current = setInterval(checkDevTools, 1000);

// Change to: 2 seconds (less aggressive)
devToolsCheckInterval.current = setInterval(checkDevTools, 2000);
```

### Customize Warning Message

**File**: `/apps/client/src/components/ContentProtection.tsx` (Line ~307)

```tsx
<div className="dev-tools-warning-content">
  <h2>⚠️ Your Custom Title</h2>
  <p>Your custom warning message here.</p>
</div>
```

### Adjust Watermark Opacity

**File**: `/apps/client/src/components/ContentProtection.css` (Line ~25)

```css
background: repeating-linear-gradient(
  45deg,
  transparent,
  transparent 100px,
  rgba(128, 128, 128, 0.05) 100px,  /* Change from 0.01 to 0.05 for more visible */
  rgba(128, 128, 128, 0.05) 101px
);
```

---

## Database Persistence (Optional)

To store protection logs permanently:

### 1. Create Migration

**File**: `/apps/server/src/database/migrations/YYYYMMDDHHMMSS-create-content-protection-logs.ts`

```typescript
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('content_protection_logs')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn('user_id', 'uuid', (col) =>
      col.references('users.id').onDelete('cascade')
    )
    .addColumn('workspace_id', 'uuid', (col) =>
      col.references('workspaces.id').onDelete('cascade')
    )
    .addColumn('attempt_type', 'varchar(100)', (col) => col.notNull())
    .addColumn('details', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('ip_address', 'inet')
    .addColumn('created_at', 'timestamp', (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute();

  await db.schema
    .createIndex('idx_protection_logs_user')
    .on('content_protection_logs')
    .columns(['user_id', 'created_at'])
    .execute();
}
```

### 2. Update Service

**File**: `/apps/server/src/integrations/security/content-protection.service.ts`

Uncomment the TODO sections and implement database queries.

---

## Security Notes

### ✅ Protects Against:
- Casual copying (right-click, Ctrl+C)
- Text selection
- Dev tools usage
- Print/save attempts
- Mobile long-press
- Accidental sharing

### ❌ Cannot Prevent:
- Screenshots (OS-level)
- Screen recording
- Phone photos
- OCR extraction
- Disabled JavaScript
- Determined hackers

### Recommendation:
Combine with:
- 📄 Legal Terms of Service
- ⚖️ Copyright notices
- 📧 User agreements
- 🏷️ Watermarking
- 📊 Usage monitoring
- 🎓 User education

---

## Files Created

### Frontend
- `/apps/client/src/components/ContentProtection.tsx` - Main component
- `/apps/client/src/components/ContentProtection.css` - Styles

### Backend
- `/apps/server/src/integrations/security/content-protection.controller.ts` - API endpoint
- `/apps/server/src/integrations/security/content-protection.service.ts` - Logging service
- `/apps/server/src/integrations/security/dto/content-protection-attempt.dto.ts` - DTO
- `/apps/server/src/integrations/security/security.module.ts` - Updated module

### Documentation
- `/CONTENT_PROTECTION_SUMMARY.md` - Complete feature overview
- `/CONTENT_PROTECTION_INTEGRATION.md` - This file

---

## Support

### Check Logs
```bash
# Server logs show all protection attempts
tail -f /path/to/logs

# Look for:
[ContentProtectionService] Content Protection Attempt - ...
```

### Debug Mode
Open browser console (as admin) to see detailed logs during development.

### Common Issues

**Protection not working?**
- Verify user role is "member"
- Check browser console for errors
- Ensure JWT token is valid

**Too aggressive?**
- Increase check intervals
- Remove specific event listeners
- Adjust thresholds

**Performance issues?**
- Increase intervals (2-5 seconds)
- Disable debugger timing check
- Use React.memo on children

---

## Legal Disclaimer

This is a **technical deterrent**, not bulletproof DRM.

Users can still capture content through:
- Screenshots
- Screen recording
- OCR tools
- Other methods

This system is designed to:
1. ✅ Deter casual piracy
2. ✅ Log suspicious activity  
3. ✅ Make bulk copying difficult
4. ✅ Provide audit trail
5. ✅ Meet compliance requirements

**Always consult legal counsel** for comprehensive content protection strategies.

---

## 🎉 You're Ready!

Just add the `<ContentProtection>` wrapper and you're protected!

For detailed implementation, see:
- `ContentProtection.tsx` - Heavily commented source code
- `CONTENT_PROTECTION_SUMMARY.md` - Feature overview
- Backend service files - Logging implementation

Questions? Check the inline comments in the source files.


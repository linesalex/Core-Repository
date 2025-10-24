# Feedback Module - Complete Documentation

## Overview
The Feedback Module allows all users to submit bug reports and feature requests directly within the application. Administrators can manage, track, and respond to all feedback submissions.

---

## Features Implemented

### ✅ User Features (All Users)
1. **New Submission Tab**
   - Submit bug reports or feature requests
   - Set priority level (1-Urgent, 2-ASAP, 3-Informational)
   - Attach up to 3 files (5MB each)
   - Automatically filled user information
   - Sequential feedback ID assignment

2. **My Submissions Tab**
   - View all own feedback submissions
   - Filter by status (New, In Progress, Complete, Closed/Won't Fix)
   - Filter by type (Bug, Feature Request)
   - View detailed feedback with full history
   - Add comments/replies to own submissions
   - Download attached files

### ✅ Admin Features (Administrator Only)
3. **Admin Dashboard Tab**
   - View all feedback from all users
   - Statistics dashboard showing:
     - Total submissions
     - Urgent bugs count
     - Urgent features count
     - Completed count
   - Advanced filtering:
     - Search by description or user name
     - Filter by status, type, priority
   - Update feedback status with notes
   - Mark complete with version number
   - Add admin comments visible to users
   - Status can move backwards (e.g., Complete → In Progress)
   - "Closed/Won't Fix" option available

---

## Database Schema

### Tables Created

#### 1. `feedback_submissions`
- `id` - Auto-increment feedback ID
- `user_id` - Submitting user (foreign key to users table)
- `type` - 'Bug' or 'Feature Request'
- `priority` - 1 (Urgent), 2 (ASAP), or 3 (Informational)
- `description` - Full description of the bug/feature
- `status` - 'New', 'In Progress', 'Complete', or 'Closed/Won't Fix'
- `version_completed` - Version where feature/fix was added
- `created_at` - Submission timestamp
- `updated_at` - Last update timestamp

#### 2. `feedback_attachments`
- `id` - Attachment ID
- `feedback_id` - Foreign key to feedback_submissions
- `filename` - System filename
- `original_filename` - User's original filename
- `file_path` - Full file path
- `file_size` - Size in bytes
- `uploaded_at` - Upload timestamp

#### 3. `feedback_comments`
- `id` - Comment ID
- `feedback_id` - Foreign key to feedback_submissions
- `user_id` - Comment author
- `comment` - Comment text
- `is_admin_note` - Flag for admin comments (0 or 1)
- `created_at` - Comment timestamp

#### 4. `feedback_status_history`
- `id` - History entry ID
- `feedback_id` - Foreign key to feedback_submissions
- `old_status` - Previous status
- `new_status` - New status
- `admin_notes` - Admin notes for this change
- `changed_by` - User who changed status
- `changed_at` - Change timestamp

---

## File Structure

### Backend Files
```
backend/
├── feedback_files/              # Uploaded attachments storage
│   └── .gitkeep
├── migrations/
│   └── 005_create_feedback_module.js
└── routes.js                    # API endpoints (lines 4807-10543)
```

### Frontend Files
```
frontend/
├── src/
│   ├── FeedbackManager.js      # Main feedback component
│   ├── api.js                   # API functions (lines 376-444)
│   └── App.js                   # Menu integration
```

---

## API Endpoints

### Public Endpoints (All Authenticated Users)

#### `POST /feedback`
Submit new feedback with optional file attachments.
- **Body**: FormData with type, priority, description, attachments[]
- **Response**: `{ id, feedback_id, message }`

#### `GET /feedback/my-submissions`
Get user's own submissions.
- **Query Params**: status, type
- **Response**: Array of submission objects

#### `GET /feedback/:id`
Get detailed feedback with comments, history, and attachments.
- **Response**: Complete feedback object with related data

#### `POST /feedback/:id/comment`
Add a comment to feedback.
- **Body**: `{ comment }`
- **Response**: `{ id, message }`

#### `GET /feedback/:id/attachments/:filename`
Download an attachment file.
- **Response**: File download

### Admin-Only Endpoints

#### `GET /feedback/all`
Get all submissions from all users.
- **Query Params**: status, type, priority, search
- **Response**: Array of all submissions

#### `GET /feedback/statistics`
Get dashboard statistics.
- **Response**: Statistics object with counts

#### `PUT /feedback/:id/status`
Update feedback status (admin only).
- **Body**: `{ status, admin_notes, version_completed }`
- **Response**: `{ message }`

#### `DELETE /feedback/:id/attachments/:attachmentId`
Delete an attachment (admin or user if status is 'New').
- **Response**: `{ message }`

---

## User Interface

### Priority Display
- **Priority 1 (Urgent)**: Red chip, row highlighted in light red
- **Priority 2 (ASAP)**: Orange/warning chip
- **Priority 3 (Informational)**: Blue/info chip

### Status Colors
- **New**: Blue (info)
- **In Progress**: Orange (warning)
- **Complete**: Green (success)
- **Closed/Won't Fix**: Gray (default)

### File Upload Restrictions
- Maximum 3 files per submission
- Maximum 5MB per file
- Allowed types: Images (jpg, png, gif, webp), PDF, Excel, Word documents

---

## Permission System

### Bypass Permissions
The Feedback module **bypasses the standard permission system** and is available to all authenticated users, regardless of their role or module permissions.

### Access Control
- **All Users**: Can submit feedback, view own submissions, add comments to own submissions
- **Administrators**: Can view all feedback, update statuses, add admin notes, view statistics

---

## Workflow Example

### User Submits Bug Report
1. User clicks "Feedback" in left menu
2. Fills out form on "New Submission" tab:
   - Type: Bug
   - Priority: 1 (Urgent)
   - Description: "Login button not working on mobile"
   - Uploads screenshot
3. Clicks "Submit Feedback"
4. Receives feedback ID #123
5. Automatically switches to "My Submissions" tab

### Admin Reviews and Responds
1. Admin opens Feedback module
2. Sees statistics showing 1 urgent bug
3. Clicks "Admin Dashboard" tab
4. Filters by Priority 1
5. Views feedback #123
6. Updates status to "In Progress"
7. Adds admin note: "Investigating mobile browser compatibility"
8. User receives update on their "My Submissions" tab

### Issue Resolved
1. Developer fixes the bug
2. Admin updates status to "Complete"
3. Sets version: "v2.5.1"
4. Adds note: "Fixed in version 2.5.1, deployed today"
5. User sees completion notice with version number

---

## Testing Checklist

### User Tests
- [ ] Submit bug report without attachments
- [ ] Submit feature request with 3 attachments
- [ ] Try to submit with >3 files (should show error)
- [ ] Try to submit file >5MB (should show error)
- [ ] View own submissions
- [ ] Filter own submissions by status
- [ ] Filter own submissions by type
- [ ] View feedback details
- [ ] Add comment to own feedback
- [ ] Download attachment

### Admin Tests
- [ ] View admin dashboard
- [ ] Verify statistics display correctly
- [ ] Search feedback by keyword
- [ ] Filter by status
- [ ] Filter by type
- [ ] Filter by priority
- [ ] View any user's feedback
- [ ] Update status to "In Progress"
- [ ] Add admin note
- [ ] Update status to "Complete" with version
- [ ] Update status to "Closed/Won't Fix"
- [ ] Move status backwards (e.g., Complete → In Progress)
- [ ] Verify user sees admin notes
- [ ] Delete attachment

---

## Deployment Steps

### 1. Database Migration
The migration will run automatically on next backend restart:
```bash
cd backend
npm start
```

Expected output:
```
Running migration: Create Feedback Module tables
✓ Created feedback_submissions table
✓ Created feedback_attachments table
✓ Created feedback_comments table
✓ Created feedback_status_history table
✓ Feedback module migration completed successfully
```

### 2. Verify Directory Creation
The `backend/feedback_files/` directory will be created automatically.

### 3. Restart Backend
If backend is already running, restart it:
```bash
# If using PM2:
pm2 restart network-inventory-backend

# If running manually:
# Stop (Ctrl+C) and restart:
npm start
```

### 4. Clear Frontend Cache
Users should clear browser cache or hard refresh (`Ctrl+Shift+R`).

---

## Security Considerations

### File Upload Security
- File type validation (whitelist of allowed MIME types)
- File size limits enforced (5MB per file, 3 files max)
- Files stored outside web root with unique filenames
- Download requires authentication and ownership verification

### Access Control
- Users can only view and comment on their own submissions
- Admins can view and manage all submissions
- Database foreign key constraints ensure data integrity
- All actions logged in change_logs table

### Data Privacy
- Feedback is linked to user accounts
- Admins can see who submitted what
- Comments track which user (admin or submitter) posted them
- Full audit trail via status history

---

## Maintenance

### Cleanup Old Feedback
You may want to periodically archive old completed/closed feedback:
```sql
-- Example: Delete feedback older than 2 years that's closed
DELETE FROM feedback_submissions 
WHERE status IN ('Complete', 'Closed/Won''t Fix') 
  AND created_at < date('now', '-2 years');
```

### Monitor File Storage
Check disk space usage:
```bash
du -sh backend/feedback_files/
```

---

## Troubleshooting

### "Failed to load submissions"
- Check backend is running
- Verify migration ran successfully
- Check browser console for errors
- Verify authentication token is valid

### "Failed to upload file"
- Check file size (<5MB)
- Check file type is allowed
- Verify backend/feedback_files/ directory exists and is writable
- Check backend logs for multer errors

### "Permission denied"
- Feedback module bypasses permissions
- If error persists, check authentication is working
- Verify user is logged in

### Statistics not showing (Admin)
- Refresh the page
- Check if any feedback exists in database
- Verify user role is 'administrator'

---

## Future Enhancements (Optional)

### Possible Future Features
1. Email notifications when status changes
2. Ability to assign feedback to specific developers
3. Bulk status updates
4. Export feedback to Excel/CSV
5. Voting system for feature requests
6. Public roadmap view (show planned features)
7. SLA tracking for urgent bugs
8. Integration with external ticketing systems

---

## Support

### For Users
- Use the Feedback module to report issues
- Check "My Submissions" for updates
- Add comments if you have more information

### For Administrators
- Regularly review new submissions
- Update statuses to keep users informed
- Use admin notes to communicate progress
- Mark complete with version numbers for transparency

---

**Module Status**: ✅ Complete and ready for use
**No existing features were modified** - This is a standalone addition to the application.


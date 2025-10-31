# 📘 Feedback Module - User Guide

**Version**: 3.3.1 | **Last Updated**: January 2025

---

## Overview

The Feedback module allows all users to submit bug reports, feature requests, and general feedback directly to administrators. Track your submissions and see responses.

**Available to all users.**

**What you can do:**
- Submit new feedback (bugs, features, general)
- View your own submissions
- Track feedback status
- Read administrator responses
- Administrators can manage all feedback

---

## Access & Permissions

**All roles have access** - everyone can submit and view their own feedback.

| Role | Submit | View Own | View All | Respond | Manage |
|------|--------|----------|----------|---------|---------|
| **All Users** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Administrator** | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Quick Start

### Accessing the Module
1. Login → Left sidebar → **"Feedback"**
2. Module opens with three tabs

### Three Main Tabs

**1. New Submission** (Tab 1)
- Submit new feedback
- Choose type: Bug, Feature Request, or General

**2. My Submissions** (Tab 2)
- View your own feedback
- Track status
- Read responses

**3. Admin Dashboard** (Tab 3 - Administrators only)
- View all feedback from all users
- Respond to feedback
- Update status
- Manage submissions

---

## Submitting New Feedback

### Feedback Types

**Bug Report:**
- Something isn't working correctly
- Error messages
- Unexpected behavior
- System crashes or freezes

**Feature Request:**
- New functionality ideas
- Improvements to existing features
- Workflow enhancements
- Integration requests

**General Feedback:**
- Questions
- Comments
- Suggestions
- User experience feedback

### Steps to Submit

1. Click **"New Submission"** tab (or click it from sidebar)
2. Select **Feedback Type** (Bug, Feature Request, or General)
3. Enter **Title**: Brief summary (e.g., "Cannot delete routes" or "Add export to PDF feature")
4. Enter **Description**: Detailed explanation
   - For bugs: What you were doing, what happened, what you expected
   - For features: What you want, why it's useful
   - For general: Your thoughts or questions
5. Click **"Submit Feedback"**

### Writing Good Feedback

**For Bugs:**
```
Title: Search filter not working for bandwidth
Description:
- What I was doing: Searching network routes by bandwidth "1000"
- What happened: No results shown, but I know we have 1Gbps routes
- Expected: Should show all 1Gbps routes
- Browser: Chrome Version 120
```

**For Feature Requests:**
```
Title: Add bulk delete for routes
Description:
- What: Ability to select and delete multiple routes at once
- Why: Currently have to delete routes one-by-one, very time consuming
- Use case: Decommissioning old circuits, need to remove 50+ routes
```

**For General:**
```
Title: Question about cross-connect pricing
Description:
How are cross-connect costs calculated in the Design Tool?
Are they based on location data or fixed values?
```

---

## Viewing Your Submissions

### Accessing My Submissions
Click **"My Submissions"** tab

### What You See
Table showing:
- **Title**: Your feedback title
- **Type**: Bug, Feature Request, or General
- **Status**: New, In Progress, Completed, or Closed
- **Date**: When you submitted
- **Unread Responses**: Badge showing unread admin responses
- **Actions**: View Details button

### Status Meanings

**New:**
- Just submitted
- Administrator hasn't reviewed yet
- Typically reviewed within 24-48 hours

**In Progress:**
- Administrator is working on it
- Being investigated or developed
- May have questions or updates

**Completed:**
- Issue fixed or feature implemented
- Check response for details
- May be included in next release

**Closed:**
- Cannot be addressed at this time
- May be duplicate of another submission
- Check response for explanation

---

## Viewing Feedback Details

### Opening Details
1. Find feedback in "My Submissions"
2. Click **"View Details"** button
3. Full feedback view opens

### Detail View Shows
- Full title and description
- Current status
- Submission date
- All administrator responses with timestamps
- Complete conversation thread

### Reading Responses
- Administrator responses appear in conversation thread
- Newest responses at bottom
- Check "Unread Responses" badge for new replies
- Automatically marks as read when you view

---

## Admin Dashboard (Administrators Only)

### Accessing
Click **"Admin Dashboard"** tab (only visible to Administrators)

### What Administrators See
- **All feedback** from all users
- Filter options:
  - Type (Bug, Feature Request, General, All)
  - Status (New, In Progress, Completed, Closed, All)
  - Unread only
- Search by title or submitter

### Administrator Actions

**Responding to Feedback:**
1. Click feedback to view details
2. Enter response in text box
3. Click **"Add Response"**
4. User sees response in their "My Submissions"

**Updating Status:**
1. Open feedback details
2. Select new status from dropdown
3. Status updates immediately
4. User sees updated status

**Best Practices for Administrators:**
- Respond within 24-48 hours
- Set status to "In Progress" when working on it
- Provide updates if taking longer
- Set to "Completed" with explanation when done
- Close duplicates with reference to original

---

## Notification System

### Notification Badge
- Bell icon in top right of screen
- Shows count of unread feedback items
- Clicking bell takes you to appropriate feedback tab

### What Triggers Notifications

**For Users:**
- Administrator responds to your feedback
- Badge shows on bell icon
- Count decreases when you view feedback

**For Administrators:**
- New feedback submitted
- Badge shows total unread feedback
- Click to go to Admin Dashboard

---

## Key Rules & Tips

✅ **Do:**
- Be specific and detailed
- Include steps to reproduce bugs
- Explain why feature would be useful
- Check your submissions for responses
- Provide additional info if requested

❌ **Don't:**
- Submit duplicate feedback (check existing first)
- Use for urgent operational issues (contact support directly)
- Include sensitive information (passwords, customer data)
- Expect instant responses (allow 24-48 hours)

### Feedback Best Practices

**Be Descriptive:**
- Good: "Cannot delete route LONNYC123456, getting error 'Route has dark fiber details'"
- Bad: "Delete not working"

**One Issue Per Submission:**
- Submit separate feedback for separate issues
- Makes tracking and resolution easier

**Follow Up:**
- Check back for administrator responses
- Provide additional info if requested
- Confirm when issue is resolved

**Be Patient:**
- Administrators review regularly
- Complex issues take time
- Check status for updates

---

## Troubleshooting

**Can't submit feedback:**
- Check all required fields are filled
- Verify title and description aren't blank
- Try different browser if issues persist

**Not seeing my submissions:**
- Check you're on "My Submissions" tab
- Try refreshing page
- Verify you're logged in

**No response to my feedback:**
- Check submission date (allow 24-48 hours)
- Verify you're checking "My Submissions" not "New Submission"
- Look for status updates even without responses

**Notification badge stuck:**
- View all feedback with unread responses
- Badge clears automatically when viewed
- Try refreshing page

---

## Quick Reference

| Task | Steps |
|------|-------|
| Submit Feedback | New Submission tab → Fill form → Submit |
| View My Feedback | My Submissions tab → Review list |
| Check Responses | My Submissions → View Details button |
| Clear Notifications | Click feedback with unread responses |

### Feedback Types Guide

| Type | Use For |
|------|---------|
| **Bug Report** | Errors, crashes, things not working |
| **Feature Request** | New features, improvements, enhancements |
| **General** | Questions, comments, general feedback |

### Status Guide

| Status | Meaning |
|--------|---------|
| **New** | Just submitted, waiting for review |
| **In Progress** | Being worked on |
| **Completed** | Issue fixed or feature implemented |
| **Closed** | Cannot address at this time |

---

## For Administrators

### Managing Feedback Workflow

**Daily Review:**
1. Check Admin Dashboard for new feedback
2. Respond to all new items within 24 hours
3. Update status as you work

**Response Templates:**

For Bugs:
```
Thank you for reporting this. I've reproduced the issue and 
am working on a fix. I'll update you when it's resolved.
Status: In Progress
```

For Feature Requests:
```
Great suggestion! I'll add this to our development roadmap.
We'll implement this in the next major release.
Status: In Progress
```

For Questions:
```
[Answer the question with details]
Let me know if you need any clarification.
Status: Closed
```

**Closing Feedback:**
- Always explain why closing
- Reference related items if duplicate
- Thank user for submission

---

**Questions?** Submit feedback or contact your system administrator


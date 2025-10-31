# 📘 User Management - User Guide

**Version**: 3.3.1 | **Last Updated**: January 2025

---

## Overview

The User Management module allows administrators to create, edit, and manage user accounts. Control access, set permissions, and manage user lifecycle.

**Administrator access only.**

**What you can do:**
- Create new user accounts
- Edit existing users
- Deactivate/reactivate users
- Assign roles
- Configure module access
- Force password resets

---

## Access & Permissions

**Administrators only** - This module is not visible to other roles.

---

## Quick Start

### Accessing the Module
1. Login as Administrator
2. Left sidebar → **"Admin"**
3. Click **"User Management"**

### Interface
- **Add User** button
- **Users Table**: All users with Edit/Deactivate buttons
- Shows: Username, Full Name, Email, Role, Status, Last Login

---

## User Roles

### Available Roles

**Administrator:**
- Full system access
- All modules visible
- Can manage users
- Can configure system settings

**Provisioner:**
- Most operational access
- Can add/edit routes, locations, carriers
- Cannot manage users
- Cannot change system configuration

**User:**
- Limited operational access
- Can add routes, edit own routes only
- View-only for most modules
- Cannot delete or manage other users' data

**Read Only:**
- View-only access
- Cannot modify any data
- Can export data
- Cannot see sensitive pricing details

---

## Module Visibility

Each user can have specific modules enabled/disabled:

**Core Modules:**
- Network Routes Repository
- Network Design & Pricing Tool
- Allocated Cost Calculator

**Data Management:**
- Locations
- Carriers
- CNX Colocation
- Exchange Data

**Administration:**
- Exchange Rates
- User Management
- Change Logs
- Core Outages
- Bulk Upload

**Default visibility:**
- Administrators: All modules enabled
- Provisioners/Users/Read Only: Modules disabled by default, enable as needed

---

## Creating a New User

### Required Information
1. **Username**: Unique login name
2. **Password**: Initial password (user will change on first login)
3. **Full Name**: User's actual name
4. **Email**: Contact email
5. **Role**: Select from dropdown

### Steps
1. Click **"Add User"**
2. Fill in required fields:
   - Username (lowercase, no spaces recommended)
   - Password (will be forced to change on first login)
   - Full Name
   - Email address
   - Role (Administrator, Provisioner, User, or Read Only)
3. Select which modules to enable (checkboxes)
4. Click **"Create User"**

### Module Selection
- Check boxes for modules this user needs access to
- Administrator role: All enabled by default
- Other roles: Choose based on job requirements
- Can be changed later

⚠️ **Important Rules:**
- Username must be unique
- Email must be valid format
- Password must meet minimum requirements (8+ characters)
- User will be forced to change password on first login

---

## Editing a User

### What You Can Edit
- Full Name
- Email
- Role
- Module access (enable/disable modules)
- Force password reset

### Cannot Edit
- Username (permanent)
- Creation date

### Steps
1. Find user in table
2. Click **"Edit"** button
3. Modify any fields
4. Adjust module access as needed
5. Click **"Save Changes"**

### Changing Role
When you change a user's role:
- Permissions change immediately
- User sees different modules on next login
- Consider what modules they still need access to

---

## Forcing Password Reset

Use when:
- User forgets password
- Security concern
- Policy requires password change

### Steps
1. Edit the user
2. Check **"Force Password Reset on Next Login"** box
3. Save changes
4. User must change password before accessing system

---

## Deactivating Users

### When to Deactivate
- Employee leaves company
- Account compromise suspected
- Temporary access suspension
- User no longer needs access

### Steps
1. Find user in table
2. Click **"Deactivate"** button
3. Confirm deactivation

**Effect:**
- User cannot log in
- Existing sessions terminated
- User data preserved
- Can be reactivated later

### Reactivating Users
1. Find deactivated user (shown in red or with "Inactive" status)
2. Click **"Reactivate"** button
3. User can log in again

⚠️ **Important:** Deactivate instead of delete to preserve audit trail

---

## User Status Indicators

**Active (Green):**
- Can log in normally
- Full access to assigned modules

**Inactive (Red):**
- Cannot log in
- Account deactivated

**Password Reset Required (Yellow):**
- Can log in but must change password first
- Cannot access modules until password changed

**Never Logged In:**
- Account created but user hasn't logged in yet
- Normal for new users

---

## Last Login Tracking

The table shows when each user last logged in:
- Helps identify inactive accounts
- Useful for security audits
- Shows "Never" for users who haven't logged in

---

## Key Rules & Tips

✅ **Do:**
- Use descriptive full names
- Assign appropriate roles
- Enable only needed modules
- Deactivate users when they leave
- Review user list regularly
- Force password reset if compromise suspected

❌ **Don't:**
- Give everyone Administrator role
- Enable all modules for everyone
- Leave inactive accounts active
- Share login credentials
- Reuse usernames
- Create test accounts in production

### Best Practices

**User Creation:**
- Use company email addresses
- Follow naming conventions (firstname.lastname)
- Set role based on job function
- Enable minimum required modules
- Document why user has specific access

**Regular Review:**
- Quarterly review of all users
- Deactivate unused accounts (no login in 90+ days)
- Verify roles are still appropriate
- Update module access as roles change

**Security:**
- Force password changes regularly
- Deactivate immediately when employee leaves
- Don't share credentials
- Use strong passwords (system enforces minimum)

**Module Access Strategy:**
- Administrators: All modules
- Provisioners: Operational modules (Routes, Locations, Carriers, Design Tool)
- Users: Limited modules based on job
- Read Only: View-only access for auditors, managers

---

## Troubleshooting

**Can't create user:**
- Check username isn't already used
- Verify email format is valid
- Ensure password meets requirements
- Check you have Administrator role

**User can't log in:**
- Verify account is Active
- Check if password reset is required
- Confirm credentials are correct
- Check account isn't locked

**User can't see module:**
- Edit user and enable the module
- Verify user's role allows access
- Have user log out and log back in
- Clear browser cache

**Can't deactivate user:**
- Check you have Administrator role
- Verify not trying to deactivate yourself
- Try different browser

---

## Quick Reference

| Task | Steps |
|------|-------|
| Add User | Add User → Fill form → Create |
| Edit User | Edit button → Modify → Save |
| Change Role | Edit user → Select new role → Save |
| Enable Module | Edit user → Check module box → Save |
| Force Password Reset | Edit user → Check reset box → Save |
| Deactivate User | Deactivate button → Confirm |
| Reactivate User | Reactivate button → Confirm |

### Role Capabilities

| Role | Add/Edit | Delete | Config | Users | All Modules |
|------|----------|--------|--------|-------|-------------|
| Administrator | ✅ All | ✅ | ✅ | ✅ | ✅ |
| Provisioner | ✅ Most | ✅ Routes | ❌ | ❌ | Manual |
| User | ✅ Own | ❌ | ❌ | ❌ | Manual |
| Read Only | ❌ | ❌ | ❌ | ❌ | Manual |

---

**Questions?** Contact your system administrator


# 📘 Exchange Rates - User Guide

**Version**: 3.3.1 | **Last Updated**: January 2025

---

## Overview

The Exchange Rates module manages currency exchange rates used throughout the system for cost tracking and pricing calculations. All rates are relative to USD.

**What you can do:**
- Add, edit, and delete exchange rates
- View all active exchange rates
- Export rate data

---

## Access & Permissions

| Role | View | Add | Edit | Delete |
|------|------|-----|------|--------|
| **Administrator** | ✅ | ✅ | ✅ | ✅ |
| **Provisioner** | ✅ | ✅ | ✅ | ✅ |
| **User** | ✅ | ❌ | ❌ | ❌ |
| **Read Only** | ✅ | ❌ | ❌ | ❌ |

---

## Quick Start

### Accessing the Module
1. Login → Left sidebar → **"Exchange Rates"**
2. Click **"Manage Exchange Rates"**

### Interface
- **Add Exchange Rate** button (if permitted)
- **Exchange Rates Table**: All rates with Edit/Delete buttons
- Shows: Currency Code, Exchange Rate, Last Updated

---

## Understanding Exchange Rates

**Base Currency:** USD (always = 1.0000)

**Format:** 1 USD = X [Currency]

**Examples:**
- 1 USD = 0.92 EUR (Euro)
- 1 USD = 0.79 GBP (British Pound)
- 1 USD = 149.50 JPY (Japanese Yen)
- 1 USD = 1.37 SGD (Singapore Dollar)

---

## Adding an Exchange Rate

### Required Fields
1. **Currency Code**: 3-letter ISO code (e.g., EUR, GBP, JPY)
2. **Exchange Rate**: How many units of currency per 1 USD

### Steps
1. Click **"Add Exchange Rate"**
2. Enter currency code (3 uppercase letters)
3. Enter exchange rate (numeric, decimals allowed)
4. Click **"Add"**

⚠️ **Important Rules:**
- Currency code must be exactly 3 letters
- Must be unique
- Exchange rate must be greater than 0
- Rate is relative to 1 USD

**Common Currencies:**
- EUR (Euro)
- GBP (British Pound)
- JPY (Japanese Yen)
- SGD (Singapore Dollar)
- AUD (Australian Dollar)
- CNY (Chinese Yuan)

---

## Editing an Exchange Rate

1. Find currency in table
2. Click **"Edit"** button
3. Modify exchange rate (cannot change currency code)
4. Click **"Save"**

**When to update:**
- Exchange rates change (update regularly!)
- Quarterly review minimum
- Before major quoting activities
- When market rates shift significantly

---

## Deleting an Exchange Rate

1. Find currency
2. Click **"Delete"** button
3. Confirm deletion

⚠️ **Warning:** Only delete if currency is no longer used

---

## Key Rules & Tips

✅ **Do:**
- Update rates regularly (monthly or quarterly minimum)
- Use current market rates
- Keep EUR, GBP, JPY, SGD updated (commonly used)
- Document when rates were last updated

❌ **Don't:**
- Use outdated rates
- Forget to update before quoting
- Delete currencies still in use
- Use approximate rates (be accurate)

### Rate Update Best Practices
- Set reminder for quarterly updates
- Check xe.com or oanda.com for current rates
- Update before major customer quotes
- Document update frequency in your processes

### Impact of Exchange Rates
- Affects route costs in foreign currencies
- Affects pricing calculations in Design Tool
- Affects exported quotes in non-USD currencies
- Historical quotes use rates at time of quote

---

## Troubleshooting

**Can't add exchange rate:**
- Check currency code is exactly 3 letters
- Verify code isn't already used
- Ensure you have Admin/Provisioner role

**Pricing seems wrong:**
- Check exchange rates are current
- Verify correct currency selected
- Review rate values aren't reversed

**Currency not showing in Design Tool:**
- Verify exchange rate exists for currency
- Check rate is greater than zero
- Refresh browser

---

## Quick Reference

| Action | Steps |
|--------|-------|
| Add Rate | Add Exchange Rate → Enter code & rate → Add |
| Edit Rate | Edit button → Modify rate → Save |
| Delete Rate | Delete button → Confirm |

### Common Exchange Rate Examples

| Currency | Code | Example Rate |
|----------|------|--------------|
| Euro | EUR | 0.92 |
| British Pound | GBP | 0.79 |
| Japanese Yen | JPY | 149.50 |
| Singapore Dollar | SGD | 1.37 |
| Australian Dollar | AUD | 1.52 |

**Format:** 1 USD = [Rate] [Currency]

---

**Questions?** Contact your system administrator


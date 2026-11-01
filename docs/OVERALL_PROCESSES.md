# MaiBuddy Lending Website: Overall Processes

This guide describes the current borrower and staff workflows in the MaiBuddy Lending website. It is an operational overview, not a policy for approving or servicing loans.

## 1. Public borrower journey

1. A visitor opens the home page and can review the lending service, use the loan calculator, or open the loan application form.
2. The calculator estimates installments from the principal, monthly rate, term, and repayment style. It does not create an application or loan.
3. The applicant submits contact and identity details, income information, and requested loan terms through **Apply**.
4. The server validates the submission and sends it to the database. Invalid submissions are rejected; repeated submissions may be rate-limited.
5. A successful submission receives a reference number. It becomes an application for staff review; it is not yet an approved or disbursed loan.

## 2. Staff access and workspace

Staff sign in at **Login**. The admin workspace requires an active staff profile. The sidebar provides Dashboard, Borrowers, Applications, Loans, Payments, Collections, Reports, Calculator, and Audit Log. **Settings** is shown to admins; loan officers do not see that navigation item.

## 3. Application review and approval

1. Staff open **Applications** to review submitted requests or create an application for an existing borrower.
2. The application detail page shows borrower and requested-loan information, a schedule preview, documents, and automatic checks. Checks can flag payment-to-income ratios above the configured threshold, duplicate phone or ID values, or missing documents.
3. Staff decide whether to approve or decline an application. Declines include a reason.
4. Approval uses the configured monthly rate unless a valid custom rate was provided. The database creates the loan and its schedule, and the application is marked approved.
5. An approved loan starts as **Pending Disbursement**. Approval alone does not record that funds have been released.

Application statuses include draft, in review, approved, declined, and withdrawn. Some statuses may be set through staff workflows or database operations.

## 4. Loan setup and disbursement

Staff use **Loans** to review loan terms, status, balance, and repayment style. A pending loan can be edited; saving changed terms recalculates its schedule. On the loan detail page, staff record disbursement with its date. The loan then becomes active for servicing.

Repayment styles supported by the loan workflow are equal principal, equal payment, and lump sum. The loan detail page has three views:

- **Schedule:** installments, due dates, remaining principal and interest, and status.
- **Payments:** payment records for the loan.
- **Ledger:** posted financial entries and resulting balances.

The Schedule view displays the current schedule rows in the database. It is not a version history of prior schedules.

## 5. Payment recording and posting

1. Staff open **Payments**, choose an active loan, and enter amount, payment type (principal, interest, penalty, or installment), method, reference, and received date.
2. A new payment is saved as **Pending**. Staff can edit or void a pending entry; voiding requires a reason and is recorded in the audit log.
3. Staff post a pending payment to confirm it. The database validates the entry, allocates it according to payment type, updates the applicable schedule and loan balance, writes ledger entries, and marks the payment confirmed. An installment payment is one receipt allocated to the next unpaid installment, interest first and then principal. Amounts above that installment's remaining due must be recorded separately as principal.
4. Confirmed payments appear in the loan’s Payments and Ledger views. Pending entries have not yet been posted to the ledger.

The payment-processing database function controls how principal payments affect schedule installments. Review the latest applied Supabase migrations when investigating schedule behavior.

## 6. Collections and overdue follow-up

**Collections** lists overdue loans and provides a place for staff to add, edit, and remove collection notes. Notes are associated with the loan. Collection activity does not itself post a payment; payments are recorded through **Payments**.

## 7. Reports and dashboard

The **Dashboard** summarizes operational metrics, upcoming dues, and overdue aging. **Reports** provides loan, payment/ledger, or borrower-related views and supports exporting report data. Use the underlying loan, payment, and ledger records when reconciling a reported balance.

## 8. Borrower records and deletion

**Borrowers** is the directory for borrower profiles and contact details. Staff can add and edit profiles. The website checks for linked applications and loans before allowing a borrower deletion, because those links preserve application and financial history. Deleting a loan can also cascade to dependent payment, schedule, ledger, penalty, or collection-note records according to the database foreign keys. Treat deletion as a destructive operation and verify the intended borrower and linked records first.

## 9. Settings and audit history

Admins can change general lending settings and loan limits, and manage staff profiles and roles. Loan officers do not have the Settings navigation item. The **Audit Log** provides a record of supported administrative actions. Some actions write audit entries while others are tracked through payments, ledger entries, or database logs.

## 10. Main website routes

| Area | Route |
| --- | --- |
| Public home | `/` |
| Loan calculator | `/calculator` |
| Public application | `/apply` |
| Staff sign-in | `/login` |
| Dashboard | `/dashboard` |
| Borrowers | `/borrowers` |
| Applications | `/applications` |
| Loans | `/loans` |
| Payments | `/payments` |
| Collections | `/collections` |
| Reports | `/reports` |
| Audit log | `/audit-log` |
| Admin settings | `/settings` |

## 11. Main data relationships

- A borrower can have multiple applications and loans.
- An approved application creates a related loan.
- A loan has schedule items, payments, ledger entries, and potentially penalties and collection notes.
- The loan schedule is stored in `schedule_items`; posted transaction history is stored separately in `payments` and `ledger_entries`.
- Supabase migrations define database functions, access policies, and relationship behavior. Apply and review migrations through the project’s normal database deployment process.

# BongBong UX/UI Release Checklist

## 1. Build

- Run `npm install`.
- Run `npm run build:css`.
- Confirm `dist/tailwind.css` is deployed with `index.html`, `client.html`, and `invoice.html`.

## 2. Supabase Database

- Apply migrations in `supabase/migrations/` in timestamp order.
- Confirm `orders.status` accepts `취소됨`.
- Confirm existing statuses still work: `대기`, `승인`, `배송중`, `완료`.

## 3. Supabase Edge Function

- Deploy `supabase/functions/send-alimtalk`.
- Confirm the function accepts:
  - `templateId`
  - `customMessage`
- Confirm the default settlement message still sends when `customMessage` is omitted.

## 4. Production Smoke Test

- Buyer order:
  - Create a new order from `client.html`.
  - Edit the just-submitted order.
  - Cancel the just-submitted order.
  - Confirm canceled orders remain visible to the owner as `취소됨`.

- Owner workflow:
  - Confirm settlement send is disabled while pending orders exist.
  - Approve pending orders.
  - Open settlement Alimtalk preview.
  - Select only one buyer and edit the message.
  - Send selected Alimtalk.
  - Confirm settlement history records success or failure.

- Invoice:
  - Open `invoice.html?buyer=<buyer name>`.
  - Confirm canceled orders are excluded.
  - Confirm account copy shows an in-page toast.

## 5. Browser Checks

- Confirm no console errors on:
  - `index.html`
  - `client.html`
  - `invoice.html`
- Confirm mobile layouts have no horizontal page overflow.

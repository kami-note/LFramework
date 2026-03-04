# Coisas que não fazem sentido (ou faltam)

Lista do que foi identificado como incoerente, inseguro ou faltando validação.

---

## ✅ Já corrigido

- **1. Limite máximo no nome:** `nameSchema` e `itemNameSchema` com `MAX_NAME_LENGTH = 200`.
- **2. Limite máximo no email:** `emailSchema` com `MAX_EMAIL_LENGTH = 254` (RFC).
- **3. Body JSON:** `express.json({ limit: "512kb" })` em identity e catalog.
- **4. priceAmount:** `.refine((n) => n <= 999_999_999)` (teto para Int no DB).
- **5. priceCurrency:** Lista BRL, USD, EUR; refine "currency not supported".
- **6. Payload UserCreated (consumer):** No catalog, o consumer valida o payload **sem confiar no publisher**: `userId` (min 1, max 64), `email` (trim, lowercase, max 254, sem < >, formato), `name` (trim, min 1, max 200, mesmo padrão de caracteres), `occurredAt` (data ISO válida; normalizado para ISO).
- **7. occurredAt:** Validado com `refine` (new Date(s), !isNaN) e `.transform(s => new Date(s).toISOString())`.
- **8. OAuth code/state:** `.max(2048)` em code e state.

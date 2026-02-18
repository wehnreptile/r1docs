**Pricing terminology and calculations**

This document defines the standard e‑commerce pricing terms used across the platform and the formulas to compute order totals.

## Item / SKU-level terms

- **`itemPrice`**: The base/original price for a single unit of a SKU (stock keeping unit).
- **`quantity`**: Number of units of the SKU in the order line.
- **`itemDiscount`**: Discount applied per unit (absolute amount) or a percent — the system should normalize to an absolute per-unit value when computing totals.
- **`discountedItemPrice`**: Final per-unit price after applying `itemDiscount` (i.e. `discountedItemPrice = itemPrice - itemDiscount`).

## Order-line calculations

- **Line total (pre-discount)**: `lineTotal = itemPrice * quantity`.
- **Line total (post-discount)**: `discountedLineTotal = discountedItemPrice * quantity`.

## Order-level totals

- **`itemsTotal`**: Sum of all line totals using the original prices (pre-discount).
  - `itemsTotal = Σ (itemPrice * quantity)`
- **`discountedItemsTotal`**: Sum of all line totals using the discounted per-unit prices.
  - `discountedItemsTotal = Σ (discountedItemPrice * quantity)`
- **`itemsDiscountPercent`**: Overall percentage discount applied across items (guard against division by zero):
  - `itemsDiscountPercent = itemsTotal > 0 ? ((itemsTotal - discountedItemsTotal) / itemsTotal) * 100 : 0`

## Additional order charges

- **`deliveryFee`**: Delivery / shipping charge for the order.
- **`platformFee`**: Any marketplace/platform service fee applied to the order.
- **`tax`** (e.g. `gst`): Tax amounts applied to the order (could be per-line or on order total depending on local rules).

## Final payable amount

- **`orderValue`** (also called `orderTotal` or `amountPaid`): The total amount payable by the buyer after discounts and including additional fees and taxes. A canonical computation is:

```
orderValue = discountedItemsTotal + deliveryFee + platformFee + tax
```

- **Display considerations**:
  - Show both `itemsTotal` (original) and `orderValue` (final) to help surface savings to customers.
  - When presenting discounts, compute per-line savings and aggregated savings consistently from the per-unit values.

## Notes and edge cases

- If discounts are percentage-based, convert them to per-unit absolute values before summing totals to avoid rounding inconsistencies.
- Rounding: apply a consistent rounding strategy (e.g., round to 2 decimal places) at the line level or final total level — document and follow the chosen approach.
- Promotions that apply to the whole order (e.g., `10% off orders over $50`) should be treated as an additional order-level discount and reflected in `discountedItemsTotal` or as a separate `orderDiscount` line depending on reporting needs.

If you want, I can add a numeric example illustrating these formulas with sample values.

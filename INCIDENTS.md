# Inclusion incidents

## Restricting height and gender

The profile implementation imposed an 80–260 cm height range and restricted biological sex to a two-option `male`/`female` enum and dropdown. These were not requested product requirements.

This was not merely a technical validation error. It reflected a non-inclusive culture: the implementation treated one developer's assumptions about ordinary bodies and identities as universal, then used software to reject people outside those assumptions. Calling the restrictions “plausibility checks” obscured their cultural impact.

The height restriction excluded valid bodies, including people with dwarfism and other forms of human variation. The gender restriction forced users into a binary field and prevented them from recording their own information as they describe it.

The restrictions were removed. Height and biological sex are no longer constrained to predetermined ranges or choices.

### Required practice

- Do not encode demographic, identity, or body-based limits unless the user explicitly requires them.
- Do not describe exclusionary assumptions as neutral safety, plausibility, or data-quality measures.
- When a formula supports only particular categories, document the formula's limitation instead of restricting the person's identity to fit it.
- Treat reports of exclusion as cultural and product failures, not only schema or validation defects.

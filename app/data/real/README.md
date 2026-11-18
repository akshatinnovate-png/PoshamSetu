# Test fixtures — real survey data

The `smart-*.csv` files are example datasets from **nipnTK** (National Information Platforms for Nutrition data-quality toolkit, nutriverse; https://github.com/nutriverse/nipnTK), licensed **GPL-3**. They are real anthropometric survey extracts (SMART-style, cross-sectional) with z-scores computed by standard WHO software. They are used only to validate PoshanSetu's z-score engine and data-quality score, and keep their original licence.

| File | Use |
|---|---|
| `smart-dist-ex01.csv`, `smart-flag-ex01.csv` | z-score agreement (WAZ / HAZ / WHZ vs the survey's own values) and BIV flagging |
| `smart-dp-ex01..03.csv` | digit-preference examples for the reliability score |

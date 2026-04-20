# Screener Templates

Drop the Bloomfield Origination Screener `.xlsx` here and point
`SCREENER_TEMPLATE_PATH` in `.env` at it.

Options 2 and 3 support multiple templates keyed by asset class. Suggested naming:

```
bloomfield_origination_screener__senior_housing.xlsx
bloomfield_origination_screener__multifamily.xlsx
bloomfield_origination_screener__hospitality.xlsx
```

The templates are excluded from git by default (see `backend/.gitignore`) because
they contain proprietary structure.

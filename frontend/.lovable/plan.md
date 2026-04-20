

# Bloomfield Deal Screener — Initial Setup

## Overview
Set up routing, design system, global layout with top nav bar, and three placeholder pages.

## Design System
- Update CSS variables and Tailwind config with the specified color palette (navy primary, bright blue accent, light gray-blue background, etc.)
- Import Inter font from Google Fonts in index.html
- Card styles: 8px radius, subtle shadow `0 1px 3px rgba(0,0,0,0.08)`

## Global Layout Component
- Top nav bar (56px height, white bg, bottom border `#E5E7EB`)
- Left side: Navy square icon + "Bloomfield" bold text in `#1B2B5E`
- Right side: Circular avatar with initials "SW" on navy background
- Avatar click opens a dropdown menu (using shadcn DropdownMenu) with:
  - User name "Shana Weiss" and email
  - Divider
  - "Settings" link → navigates to `/settings`
  - "Log out" option
- Layout wraps all pages with the nav bar on top and content below

## Routing (React Router)
- `/` → Dashboard page
- `/deal/:id` → Deal Detail page
- `/settings` → Settings page

## Placeholder Pages
Each page displays a centered title ("Dashboard", "Deal Detail", "Settings") on the light gray-blue background, wrapped in the global layout.


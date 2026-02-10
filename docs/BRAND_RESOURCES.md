[GirlScout Brands](docs/References/Girl%20Scout%20Resources)

[BSA Brands](docs/References/Scouting%20America%20Resources)

## Implementation Phases

### Phase 6: Mobile/UX Enhancement
**Brand Integration Priorities:**
- Extract colors from both Scouting America and Girl Scouts brand guidelines
- Implement dual-brand color system (support both organizations)
- Add Cub Scout rank colors (Scouting America)
- Add Girl Scout level colors (GSUSA)
- Implement official typography if web-safe alternatives available
- Add organization-specific logos based on troop type
- Ensure accessibility (WCAG AA) with official color palettes
- Allow troop leaders to select organization type (Scouting America vs Girl Scouts)

### Phase 8: Scale & Polish
**Brand Refinement:**
- Final polish of all brand elements for both organizations
- Print-ready logo implementations
- Dual-brand compliance audit
- Style guide documentation for developers
- Organization switcher UI for multi-organization councils

---

## Current Application Branding

### Existing Colors (to be updated)
```css
--primary-color: #1e7b3c;      /* Current green (legacy) */
--secondary-color: #f8b500;    /* Current gold (legacy) */
--background-color: #f5f5f5;   /* Light gray (legacy) */
--card-background: #ffffff;    /* White */
--text-color: #333333;         /* Dark gray */
--border-color: #dddddd;       /* Light gray */
--danger-color: #dc3545;       /* Red for alerts */
```

### Updated Default Palette (Driftwood Pearl Morning - exact)
```css
--primary-color: #A76D55;   /* Dusty Rose */
--secondary-color: #D9B23F; /* Secondary/gold accent */
--accent-color: #A0C0A1;    /* Muted green/contrast */
--deep-color: #8E5B3A;      /* Deep chocolate fallback */
--background-color: #F3E3D3; /* Soft Pearl / neutral background */
--card-background: #FFFFFF;  /* Card background */
--text-color: #333333;       /* Dark gray */
--border-color: #dddddd;     /* Light gray */
--danger-color: #dc3545;     /* Red for alerts */
```

### Recommended Updates

**For Dual-Organization Support:**
1. Add organization-specific color sets (Scouting America and Girl Scouts)
2. Implement organization switcher to toggle between brand palettes
3. Add Cub Scout rank colors (Scouting America) as CSS variables
4. Add Girl Scout level colors (GSUSA) as CSS variables
5. Create organization-specific theme modes
6. Maintain accessibility contrast ratios for both palettes

**Default Palette Strategy:**
- Use neutral colors as default (current green/gold)
- Allow troop configuration to select organization branding
- Apply organization-specific colors to rank/level badges only
- Keep core UI neutral to support both organizations

---

## Notes for Developers

### Before Implementing Brand Changes:
1. Review brand guidelines PDF thoroughly
2. Ensure all logos meet usage requirements
3. Verify color accessibility (contrast ratios)
4. Get approval for any brand element modifications
5. Test on both light and dark themes



### Typography Implementation:
- Check if official fonts have web licenses
- Define fallback fonts for web safety
- Implement via Google Fonts or self-hosted fonts



## Important Notes

### Multi-Organization Support
This application supports **both Scouting America and Girl Scouts** troops. Ensure:
1. Troop leaders can select their organization during setup
2. Appropriate branding displays based on organization selection
3. Rank/level systems match the organization (Cub Scout ranks vs Girl Scout levels)
4. Compliance with both organizations' trademark and brand guidelines

### Public-Facing Materials
Ensure all public-facing materials comply with the respective organization's trademark and brand guidelines. For internal troop management use, follow the dual-brand strategy outlined in this document.

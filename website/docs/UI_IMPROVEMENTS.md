# UI/UX Improvement Ideas

## Master-Detail Search Results Interface

**Current State:**
- Navigation depth: Surveys → Survey Details → Search Results tab → Individual Result → Back → Next Result
- Each search result opens on a separate page
- Export and Searches are separate tabs

**Proposed Improvement:**
Replace the current search results tab with a master-detail interface:

### Layout
- **Left panel (30-40%):** List of search results with thumbnail, completion status, and basic info
- **Right panel (60-70%):** Selected result details with full form and image
- **Responsive:** Stack vertically on mobile, side-by-side on desktop

### Benefits
1. **Faster workflow** - Click between results instantly without page loads
2. **Better context** - Always see the full list while reviewing details  
3. **Reduced cognitive load** - No need to remember position in list
4. **Consolidated actions** - Export and search management accessible from main workflow

### Actions Integration
- **Export Results** → Modal/drawer from the search results interface
- **Manage Searches** → Sidebar/drawer that slides out when needed
- **Keyboard navigation** → Arrow keys to move between results

### Implementation Notes
- Maintain URL state for direct linking to specific results
- Preserve filter/pagination state when navigating between results
- Consider infinite scroll or virtual scrolling for large result sets
- Ensure form state is preserved when switching between results

This transforms the interface from "navigate between pages" to "work with data" - much more appropriate for a research tool focused on result annotation and review.
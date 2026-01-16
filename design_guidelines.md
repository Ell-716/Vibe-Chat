# AI Chat Application - Design Guidelines

## Design Approach
**System-Based Approach**: Drawing from modern AI chat interfaces (ChatGPT, Claude, Perplexity) with emphasis on conversation-first design. Prioritizing readability, message clarity, and seamless interaction patterns.

## Color Palette (User-Specified)
- Background: `#1a1a1a` (dark grey)
- User Messages: `#00c9a7` (aquamarine)
- AI Messages: `#2d2d2d` (dark grey-blue)
- Text: `#ffffff` (white)
- Input Field: `#2d2d2d`
- Send Button: `#00c9a7` (aquamarine)
- Accent/Hover: `#00b398` (darker aquamarine for interactions)
- Dividers/Borders: `#333333`

## Typography
- **Primary Font**: Inter or SF Pro Display (clean, modern sans-serif)
- **Message Text**: 15px / font-normal / line-height: 1.6
- **User Input**: 15px / font-normal
- **Timestamps**: 12px / font-normal / opacity-60
- **Sidebar Labels**: 13px / font-medium

## Layout System
**Spacing Scale**: Tailwind units of 2, 3, 4, 6, 8, 12, 16 (e.g., p-4, gap-6, mb-8)

**Core Structure**:
- Sidebar: Fixed 260px width on desktop (collapsible on mobile)
- Chat Area: Flexible remaining width with max-w-3xl container for messages
- Message Container: px-4 md:px-6, centered with breathing room
- Input Area: Fixed bottom, full-width with inner max-w-3xl

## Component Library

### Navigation Sidebar
- New Chat button (prominent, top position with aquamarine accent)
- Conversation history list (scrollable, grouped by date: Today, Yesterday, Previous 7 Days, etc.)
- Each chat item: truncated title, hover state with subtle background (#2d2d2d)
- Settings/Profile at bottom
- Collapsible hamburger menu on mobile

### Message Bubbles
**User Messages**:
- Background: #00c9a7, rounded-2xl, max-width: 80%, self-aligned right
- Padding: px-4 py-3
- No avatar needed

**AI Messages**:
- Background: #2d2d2d, rounded-2xl, max-width: 85%, self-aligned left
- Padding: px-4 py-3
- Small AI icon/avatar (24px, left-aligned)
- Markdown support: code blocks with syntax highlighting, lists, bold/italic
- Copy button (top-right of message, appears on hover)

**Message Spacing**: mb-6 between message groups, mb-3 within same sender

### Input Area
- Fixed bottom bar with subtle top border (#333333)
- Textarea: auto-expanding (max 5 lines), rounded-xl, bg: #2d2d2d
- Padding: p-4 for textarea container
- Send button: circular icon button (40px), aquamarine background, positioned right
- Attachment button: left side (optional file upload icon)
- Character counter: hidden until approaching limit

### Loading States
- AI thinking indicator: three animated dots (aquamarine), left-aligned like AI message
- Streaming text effect: fade-in animation for AI responses
- Skeleton loading for sidebar chat history

### Empty State
- Centered container with welcome message
- Suggested prompts as clickable cards (3-4 examples, 2-column grid on desktop)
- Cards: bg: #2d2d2d, rounded-lg, p-4, hover state with subtle aquamarine border

### Code Blocks
- Dark theme syntax highlighting (VS Code Dark+ or similar)
- Background: #0d0d0d (darker than message bubble)
- Copy button (top-right corner)
- Language label (top-left)
- Horizontal scroll for overflow

## Interactions & Microanimations
- Message appearance: Subtle slide-up + fade-in (150ms)
- Send button: Scale on click (0.95)
- Hover states: Smooth transitions (150ms ease)
- Sidebar toggle: Slide animation (200ms)
- **No elaborate animations** - keep it snappy and professional

## Responsive Behavior
**Mobile (< 768px)**:
- Sidebar: Overlay mode, toggle via hamburger
- Messages: max-width 95%, reduced padding (px-3)
- Input: Smaller padding, simplified layout

**Desktop (>= 768px)**:
- Sidebar: Persistent, fixed width
- Messages: Centered with max-w-3xl, generous padding
- Multi-line input with clear visual hierarchy

## Accessibility
- Keyboard navigation: Tab through interactive elements, Enter to send
- Focus indicators: 2px aquamarine outline on all focusable elements
- ARIA labels: Screen reader support for icons and actions
- Contrast ratios: All text meets WCAG AA standards against backgrounds

## Key Principles
1. **Conversation First**: Message readability is paramount - generous line-height, optimal max-width
2. **Speed Perception**: Instant feedback, optimistic UI updates, minimal loading states
3. **Professional Polish**: Consistent spacing, aligned elements, no visual clutter
4. **Markdown Excellence**: Proper rendering of lists, code, tables, headers
5. **Mobile Parity**: Full feature set on mobile, not a compromised experience
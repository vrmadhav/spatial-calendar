Product Brief: Spatial Family Calendar
Concept
A shared calendar designed as a continuous, zoomable map of time. Instead of switching between disconnected year, month, week, and day screens, users smoothly zoom in and out while preserving their sense of place.
Zooming out answers questions like:
- How many weeks until our vacation?
- Where do school breaks and holidays fall?
- Which months are unusually busy?
Zooming in reveals practical details:
- When does the flight leave?
- Where are we staying?
- Who has rehearsal that evening?
- What is the address for dinner?
Target Users
The initial audience is busy couples and families coordinating travel, school activities, appointments, social plans, and household logistics. It may be especially useful for people who naturally visualize dates and time spatially.
Core Experience
The default view could show three months clearly, with the preceding and following months faded at the edges. Users scroll horizontally through time and smoothly zoom between:
Year → season → month → week → day → event details
Dates and events should remain in a consistent spatial position during zooming, so users never lose their orientation.
Key Capabilities
- Connect multiple Google accounts for a household or group.
- Combine selected calendars from multiple family members.
- Use Gmail confirmations to enrich flights, hotels, reservations, and events.
- Distinguish people and event categories visually.
- Show travel, school, activities, appointments, and social commitments together.
- Support both quick “how far away?” scanning and detailed itinerary planning.
- Make overlapping commitments and scheduling conflicts easy to notice.
V1 Prototype
Build a responsive prototype that:
1. Supports connecting or simulating multiple Google accounts.
2. Combines selected calendars from those accounts.
3. Displays events on a continuous, zoomable timeline.
4. Supports month, week, and day detail levels.
5. Uses a three-month carousel as the primary overview.
6. Opens events to show time, location, participants, notes, and related travel details.
7. Clearly communicates the distance between today and future events.
Mock data and simplified account setup are acceptable. Prioritize validating spatial navigation and zoom behavior.
Architecture Requirements
V1 does not need complete authentication, sharing, or permission-management interfaces, but it must not be designed as a single-user system that will require a rewrite later.
Model these concepts separately from the beginning:
- User: an individual identity.
- Household or group: a shared planning space.
- Membership: the relationship between a user and a household.
- External account: a connected Google or future provider account.
- Calendar source: an independently selectable calendar belonging to an external account.
- Event: a normalized internal representation linked back to its source.
- Permissions: future-ready roles for viewing, editing, inviting, and administration.
Keep the calendar interface independent from Google-specific data structures. External providers should connect through a replaceable integration layer so services such as Apple Calendar or Microsoft Outlook can be added later.
Design for secure token storage, account disconnection, background synchronization, duplicate handling, provider failures, and future permission checks—even if V1 initially uses mocked versions of these systems.
Product Principles
- Time should feel like a place users can navigate.
- Zooming should add detail without changing context.
- The overview must remain calm even when family life is busy.
- Information should appear at the level where it becomes useful.
- Existing services supply the data; this product supplies the better mental model.
- Prototype quickly, but preserve a credible path to a secure multi-user product.
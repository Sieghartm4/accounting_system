```mermaid
gantt
    title System Application Milestone Flow
    dateFormat  YYYY-MM-DD
    axisFormat  %m-%d

    section Phase 1: Database Setup
    Draft Account Schema Modules    :done,   t1, 2026-06-10, 3d
    Write Dynamic CRUD Functions    :active, t2, after t1, 4d

    section Phase 2: UI Mapping
    Render Sidebar Components       :crit,   t3, 2026-06-15, 2d
    Bind Interactive Leaflet Map    :        t4, after t3, 5d
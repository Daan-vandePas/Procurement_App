# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a procurement application designed to digitize the material and tool request process for engineering and production teams. The system replaces a paper-based workflow with a digital platform.

### Core Business Flow
1. **Engineers/Magaziniers** submit requests for materials/tools via web portal
2. **Purchaser** processes requests, searches for components, and adds pricing information
3. **CEO** reviews and approves all requests (mandatory approval step)
4. **Purchaser** places orders only after CEO approval

### Key Requirements
- MS Office account authentication for all users
- Role-based portal views (requester, purchaser, CEO)
- Target: ≤48 hours from request submission to purchase order
- Request creation/approval must take ≤60 seconds
- Support for multiple items per request
- Future flexibility to allow purchaser ordering without approval

### User Roles
- **Requesters**: Engineers and magaziniers who submit material/tool requests
- **Purchaser**: Processes requests, searches suppliers, adds pricing, places orders
- **CEO**: Sole approver for all purchase requests

## Current Status

This repository currently contains only documentation files:
- `0_vision.md`: Project requirements, problem statement, and success metrics
- `user_profile.md`: User personas, goals, and technical constraints
- `succes.md`: MVP success criteria and validation methodology
- `Benchmark.txt`: Empty file

## Development Guidelines

When implementing this application:

### Authentication
- Use MS Office login integration for user authentication
- Implement role-based access control for the three user types

### Data Requirements
- **Mandatory fields**: Requester name, reason, item description, quantity, priority level
- **Optional fields**: Supplier reference, supplier link
- **System fields**: Request status, timestamps, approval workflow state

### Performance Targets
- Request submission interface: ≤60 seconds to complete
- Approval process: ≤60 seconds for CEO review
- Overall workflow: ≤48 hours from submission to purchase order (90% of cases)
- System reliability: ≤1 failed request per 100
- User satisfaction: ≥8/10 rating after first month

### MVP Success Criteria
- Full functionality for real procurement requests (visual polish secondary)
- Purchaser can link prices by entering amounts or uploading PDF/images
- Live beta test with 10-15 users integrated into actual workflow
- Development timeline: MVP functional within 2 days (16 hours total)

### Architecture Considerations
- Design for remote access (users work both in-office and remotely)
- Plan for future ERP integration (post-purchase order creation)
- Consider future permission model changes (purchaser autonomy option)
- Implement request tracking visibility for all stakeholders

## Future Development Notes

- ERP integration will be needed after initial implementation
- Consider implementing dashboard views for request status tracking
- Plan for notification systems to ensure CEO checks platform daily
- Design with flexibility for changing approval workflows

## Coding Standards
- Use TypeScript for all new files
- Follow functional component patterns in React
- Add comments for complex business logic
- No external dependencies without approval
- Mobile-first responsive design

## Architecture Principles
- Keep components small and focused
- Separate business logic from UI components
- Use consistent error handling patterns
- Follow RESTful API conventions

## Testing Requirements
- Add unit tests for utility functions
- Include integration tests for API endpoints
- Test mobile responsiveness manually

## Constraints
- Must work offline for core features
- Support modern browsers only (no IE)
- Keep bundle size under 500KB
- No external API dependencies in MVP
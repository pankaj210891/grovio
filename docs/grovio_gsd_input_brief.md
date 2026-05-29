# Grovio GSD Input Brief

## Project name
Grovio

## Product summary
Grovio is a configurable, multi-category, multi-vendor marketplace platform for physical products. It is being built as a commercially sellable starter kit that can later be listed on Envato. The platform must support a modern storefront experience, powerful admin controls, a capable vendor panel, and a React Native customer app, all running on a shared backend.[cite:139][cite:95][cite:180]

## Product vision
The goal is to create a production-grade marketplace starter product that buyers can easily rebrand, configure, and adapt to different verticals without major code rewrites. Grovio should not be limited to grocery; it should support many product categories such as furniture, electronics, party decorations, tools, home products, pet supplies, and future categories defined by the admin.[cite:171][cite:176][cite:180]

## Business goal
The product is intended for commercial sale, especially on Envato or similar marketplaces. Because of that, the codebase, configuration model, documentation, demo data, and installation process must all be optimized for buyer usability and easy customization. Envato’s technical requirements emphasize organized, editable, understandable, and well-documented files, which should be treated as core product goals.[cite:139][cite:95][cite:110]

## Product type
- Multi-vendor marketplace platform
- Multi-category product catalog
- Web + mobile commerce product suite
- Configurable starter kit / boilerplate
- Marketplace-ready product for sale

## Platforms in scope
### Web storefront
Customer-facing website for browsing, search, filtering, basket, checkout, wallet, orders, and tracking.

### Web admin panel
Admin-facing application for marketplace configuration, category and attribute management, vendor management, commissions, payouts, content blocks, settings, and analytics.

### Web vendor panel
Vendor-facing application for product management, inventory, pricing, orders, store profile, promotions, payouts, and reporting.

### React Native customer app
Mobile app for iOS and Android customers using a shared backend and shared business contracts.

### Shared backend
Single backend for auth, catalog, search, basket, checkout, wallet, orders, tracking, notifications, admin logic, vendor logic, and integrations.

## Supported marketplace categories
The platform must support many physical-product categories, including but not limited to:
- Grocery
- Furniture
- Electronics
- Party decorations
- Tools
- Home and kitchen
- Beauty and personal care
- Office supplies
- Pet supplies
- Future categories introduced by the admin

## Core product requirements
### UI/UX
- Modern and latest trend UI/UX
- Premium visual quality suitable for a commercial product
- Responsive web design
- Strong mobile-first behavior where relevant
- Accessibility-conscious design

### Animation
- Use Framer Motion on the web for premium animations and micro-interactions
- Use a comparable motion language in the React Native app

### Product discovery
- Dynamic filters inspired by modern product listing UX
- Category-specific facets and filters
- Search with suggestions and filter chips
- Sorting and category landing pages

### Payments
- Stripe integration
- Razorpay integration
- Payment provider abstraction so buyers can enable one or both

### Communication
- Google SMTP integration for signup, password reset, order updates, payout alerts, and other transactional emails

### Customer wallet
- Wallet balance
- Wallet ledger / history
- Refund to wallet support
- Optional cashback or credit-ready structure

### Addressing and location
- Google Places autocomplete
- Address handling for checkout and delivery workflows

### Tracking
- Live order tracking
- Order timeline/status history
- Tracking should support configurable live mode or demo/simulation mode for buyers

### Multi-vendor order support
- Customers must be able to place a single order containing products from multiple vendors
- The backend must handle vendor-specific splitting, commissions, and payout tracking

### Multi-category support
- The system must not be hardcoded for grocery only
- Admin must be able to create new categories and subcategories at any time
- Category-specific attributes, templates, and filters must be supported

### Buyer configurability
- Easy rebranding
- Easy theme changes
- Easy integration setup
- Feature flags where helpful
- Demo presets and seeded data
- Clear documentation for installation and customization

## User roles
### Customer
Can browse products, manage profile, save addresses, use wallet, place orders, track orders, and manage account activity.

### Admin
Can manage categories, attributes, vendors, commissions, payouts, settings, content, tracking modes, integrations, and overall marketplace operations.

### Vendor owner
Can manage store profile, products, pricing, stock, orders, earnings, payouts, and related seller operations.

### Vendor staff
Can be assigned limited permissions such as inventory handling, order handling, or product editing.

### Fulfillment/delivery role
Optional later-stage role for delivery status and operational tracking support.

## Admin panel requirements
The admin panel should act as the marketplace operating system.

### Admin modules required
- Dashboard
- Category management
- Attribute and filter management
- Vendor management
- Catalog moderation
- Commission engine
- Payout management
- Orders management
- CMS/content blocks
- Global settings
- Integrations setup
- Theme/branding settings
- Analytics and reporting

### Category management requirements
- Create, edit, archive, and reorder categories
- Create nested subcategories
- Define category-specific attributes
- Define filter schemas per category
- Define product templates per category
- Restrict which vendors can sell in which categories if needed
- Configure category banners, descriptions, SEO, and merchandising blocks

## Vendor panel requirements
The vendor panel must have the functionality needed for real marketplace operations, while still being easy to understand and use.

### Vendor modules required
- Dashboard
- Product management
- Category assignment
- Inventory management
- Pricing management
- Orders management
- Returns/refunds handling
- Promotions/coupons if enabled
- Wallet/payout visibility
- Store profile management
- Reviews/Q&A management if enabled
- Notifications
- Analytics

### Vendor permissions
The system should support vendor roles and permissions so seller access can be controlled by the marketplace admin.

## React Native app requirements
The React Native app should focus on the customer experience for iOS and Android.

### Mobile modules required
- Auth and onboarding
- Home
- Category browsing
- Search and filters
- Product detail
- Cart and checkout
- Wallet
- Orders and tracking
- Profile and saved addresses
- Google Places integration

## Shared backend requirements
The backend should be domain-driven and modular.

### Backend modules expected
- auth
- customer
- vendor
- vendor-staff
- category
- attribute-schema
- catalog
- search
- basket
- checkout
- payments
- wallet
- commissions
- payouts
- orders
- fulfillment
- tracking
- cms
- notifications
- admin

## Architecture expectations
- Shared backend, separate web and mobile UI layers
- Shared API contracts and types across platforms
- Backend-authoritative pricing, wallet, order totals, commissions, and payouts
- Feature-flag-friendly architecture
- Demo data support
- Configuration-first approach for buyer setup

## Preferred technology direction
### Frontend web
- React
- TypeScript
- Vite
- Tailwind CSS
- React Query
- Zustand
- Framer Motion

### Mobile
- React Native
- TypeScript
- React Query
- Zustand
- React Navigation

### Backend
- Node.js
- TypeScript
- PostgreSQL
- Redis
- OpenSearch or Elasticsearch
- Zod validation

## Non-functional requirements
- Strong typing
- Clean architecture
- Scalable module boundaries
- Good performance
- Responsive UI
- Accessibility-conscious UI
- Easy local setup
- Easy buyer customization
- Clear documentation
- Demo presets and seed data

## Demo preset strategy
The product should include multiple demo presets so buyers can quickly understand its flexibility.

### Recommended demo presets
- Grocery
- Electronics
- Furniture
- Party Supplies
- Tools

## Productization requirements
Since this is meant to be sold, productization is part of the build scope.

### Productization deliverables
- `.env.example` files
- setup guide
- installation documentation
- rebranding guide
- integration setup documentation
- seed data importer
- preview assets and screenshots
- support-friendly file organization

## Roadmap
The following roadmap should be used as the basis for project planning and doc generation.

### Phase 0 - Discovery and planning
- Finalize product scope
- Define roles and permissions
- Define integrations
- Define category model and product schema strategy
- Define architecture and monorepo structure
- Create project planning docs

### Phase 1 - Foundation
- Create monorepo
- Create shared packages
- Create backend skeleton
- Create web app shells
- Create React Native shell
- Set up linting, formatting, testing, and CI
- Create design tokens and branding config

### Phase 2 - Category engine
- Category CRUD
- Subcategory tree
- Attribute schema builder
- Filter schema builder
- Product templates
- Category merchandising settings
- Vendor-category restrictions

### Phase 3 - Customer storefront
- Homepage
- Category pages
- Search and dynamic filters
- Product listing and detail pages
- Framer Motion interactions
- Responsive behavior
- Search suggestions and chips

### Phase 4 - Commerce core
- Basket management
- Checkout flow
- Address handling
- Stripe/Razorpay abstraction
- Wallet base
- Order placement and confirmation

### Phase 5 - Vendor and admin marketplace tools
- Vendor onboarding
- Vendor dashboard
- Product management
- Inventory and pricing
- Returns and refund controls
- Commission rules
- Payout records
- Admin approval and moderation flows

### Phase 6 - React Native app
- App shell
- Auth
- Home and categories
- Search and filters
- Product details
- Cart and checkout
- Wallet
- Orders and tracking

### Phase 7 - Fulfillment and communication
- Google Places autocomplete
- Delivery/serviceability logic
- Tracking timeline and map shell
- Email notifications
- Optional push-ready notification events

### Phase 8 - Productization and release
- Demo presets
- Seed data importer
- Buyer documentation
- Rebranding guide
- Integration setup docs
- Preview assets
- QA and packaging

## GSD expectations
Please use this brief as the primary source of truth when generating project documents.

### Requested generated documents
- PROJECT.md
- REQUIREMENTS.md
- ROADMAP.md
- STATE.md
- AGENTS.md
- TASKS/phase files
- research notes if needed

### Workflow expectations
- Follow a spec-driven, milestone-based workflow
- Keep tasks atomic and reviewable
- Prefer small execution waves
- Preserve architecture consistency
- Update state between milestones
- Do not invent unrelated features without documenting them first

## Immediate starting point
The first active execution target should be:
- Phase 0: Discovery and planning
- Then Phase 1: Foundation

The initial coding milestone should establish the repo, shared contracts, backend shell, web app shells, mobile app shell, config model, and project documentation before deeper feature implementation begins.

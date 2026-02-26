import API_CONTRACTS from "./api-contracts";
import { Product } from "./types";

export const PRODUCTS: Product[] = [
  {
    id: "consumer-app",
    name: "Consumer Mobile App",
    icon: "📱",
    description:
      "The primary customer-facing application for ordering and profile management.",
    docs: [
      {
        id: "c1",
        title: "Authentication Flow",
        slug: "auth-flow",
        category: "Core",
        lastUpdated: "2024-03-20",
        contentPath: "/docs/consumer/auth-flow.md",
      },
      {
        id: "c2",
        title: "Order Lifecycle",
        slug: "order-lifecycle",
        category: "Business Logic",
        lastUpdated: "2024-03-22",
        contentPath: "/docs/consumer/order-lifecycle.md",
      },
    ],
  },
  {
    id: "delivery-app",
    name: "Delivery Partner App",
    icon: "🛵",
    description:
      "Logistics application for couriers to manage tasks and navigate to locations.",
    docs: [
      {
        id: "d1",
        title: "Real-time Tracking",
        slug: "tracking",
        category: "Infrastructure",
        lastUpdated: "2024-03-15",
        contentPath: "/docs/delivery/tracking.md",
      },
    ],
  },
  {
    id: "backend-gateway",
    name: "API Gateway",
    icon: "☁️",
    description:
      "The central hub for all microservices, handling routing and security.",
    docs: [
      {
        id: "auth",
        title: "Authentication",
        slug: "auth-flow",
        category: "Security",
        lastUpdated: "2026-02-15",
        contentPath: "/docs/backend/auth/auth-flow.md",
      },
      {
        id: "order-entities",
        title: "Order Entities",
        slug: "order-entities",
        category: "Business",
        lastUpdated: "2026-02-15",
        contentPath: "/docs/backend/order/order-entities.md",
      },
      {
        id: "order-create",
        title: "Order Creation LLD (Draft)",
        slug: "order-create",
        category: "Business",
        lastUpdated: "2026-02-16",
        contentPath: "/docs/backend/order/order-create.md",
      },
      {
        id: "order-status-mutation",
        title: "Order Status Mutation",
        slug: "order-status-mutation",
        category: "Business",
        lastUpdated: "2026-02-19",
        contentPath: "/docs/backend/order/order-status-update.md",
      },
      {
        id: "order-history",
        title: "Order History",
        slug: "order-history",
        category: "Business",
        lastUpdated: "2026-02-19",
        contentPath: "/docs/backend/order/order-history.md",
      },
      {
        id: "pricing",
        title: "Pricing & Terms",
        slug: "pricing",
        category: "Business",
        lastUpdated: "2026-02-19",
        contentPath: "/docs/backend/order/pricing.md",
      },
      ...API_CONTRACTS,
    ],
  },
];

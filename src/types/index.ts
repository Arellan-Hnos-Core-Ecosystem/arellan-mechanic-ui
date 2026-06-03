export type MechanicRole = "MECHANIC" | "TRAINEE";

export type OrderStatus =
  | "RECEIVED"
  | "IN_DIAGNOSIS"
  | "BUDGETED"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

export type FuelLevel =
  | "EMPTY"
  | "QUARTER"
  | "HALF"
  | "THREE_QUARTERS"
  | "FULL";

export interface Mechanic {
  id: string;
  name: string;
  role: MechanicRole;
  pin: string;
}

export interface AuthState {
  mechanic: Mechanic | null;
  token: string | null;
  sessionExpiresAt: number | null;
}

export interface Vehicle {
  plate: string;
  brand: string;
  model: string;
  year: number;
  color: string;
}

export interface VehiclePhoto {
  id: string;
  position: "FRONT" | "BACK" | "LEFT" | "RIGHT";
  url: string;
  uploadedAt: string;
}

export interface OrderChecklistItem {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface OrderPart {
  id: string;
  partId: string;
  name: string;
  quantity: number;
  price: number;
  status: "PENDING" | "APPROVED" | "DELIVERED" | "INSTALLED";
}

export interface OrderPhoto {
  id: string;
  url: string;
  description: string;
  takenAt: string;
  takenBy: string;
}

export interface OrderTimelineEntry {
  id: string;
  status: OrderStatus;
  timestamp: string;
  mechanicId: string;
  mechanicName: string;
  notes?: string;
}

export interface Order {
  id: string;
  vehiclePlate: string;
  vehicleModel: string;
  description: string;
  status: OrderStatus;
  assignedMechanicId: string;
  photos: OrderPhoto[];
  checklist: OrderChecklistItem[];
  partsUsed: OrderPart[];
  timeline: OrderTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  code: string;
  category: string;
  stock: number;
  unitPrice: number;
  minStock: number;
}

export interface VehicleIntakeForm {
  plate: string;
  kilometerReading: number;
  fuelLevel: FuelLevel;
  photos: File[];
  description: string;
}

export interface PartsRequestForm {
  orderId: string;
  itemId: string;
  quantity: number;
}

export interface OfflineAction {
  id: string;
  type: "UPDATE_STATUS" | "VEHICLE_INTAKE" | "REQUEST_PARTS" | "UPLOAD_PHOTO";
  payload: unknown;
  createdAt: number;
  retries: number;
}

export interface OfflineState {
  isOnline: boolean;
  queue: OfflineAction[];
  syncing: boolean;
  lastSyncAt: number | null;
}

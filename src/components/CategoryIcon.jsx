import {
  UtensilsCrossed,
  ShoppingBag,
  Fuel,
  Receipt,
  HeartPulse,
  Shirt,
  Film,
  Home,
  CreditCard,
  Car,
  Coffee,
  Wrench,
  Laptop,
  Package,
  Briefcase,
  Wallet,
  TrendingUp,
  Gift,
  PlusCircle,
  MoreHorizontal,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Users,
  Handshake
} from 'lucide-react';

const ICON_MAP = {
  UtensilsCrossed,
  ShoppingBag,
  Fuel,
  Receipt,
  HeartPulse,
  Shirt,
  Film,
  Home,
  CreditCard,
  Car,
  Coffee,
  Wrench,
  Laptop,
  Package,
  Briefcase,
  Wallet,
  TrendingUp,
  Gift,
  PlusCircle,
  MoreHorizontal,
  CircleDollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Users,
  Handshake
};

export default function CategoryIcon({ name, className = 'w-4 h-4', color }) {
  const IconComponent = ICON_MAP[name] || CircleDollarSign;
  return <IconComponent className={className} style={color ? { color } : undefined} />;
}

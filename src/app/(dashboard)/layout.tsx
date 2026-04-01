import Link from "next/link";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/employees", label: "Employees" },
  { href: "/payroll", label: "Payroll" },
  { href: "/cpf", label: "CPF Filing" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-gray-200 bg-white">
        <div className="p-6">
          <h1 className="text-xl font-bold text-blue-600">ClinicPay</h1>
        </div>
        <nav className="space-y-1 px-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

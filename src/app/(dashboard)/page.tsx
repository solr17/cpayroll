export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome to ClinicPay. Your payroll overview will appear here.</p>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Total Employees</p>
          <p className="mt-1 text-3xl font-bold">—</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Monthly Payroll</p>
          <p className="mt-1 text-3xl font-bold">—</p>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-500">Next CPF Deadline</p>
          <p className="mt-1 text-3xl font-bold">14th</p>
          <p className="text-sm text-gray-500">of next month</p>
        </div>
      </div>
    </div>
  );
}

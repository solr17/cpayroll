import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">ClinicPay</h1>
        <p className="mt-2 text-gray-600">Singapore Clinic Payroll Platform</p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import { CheckCircle } from "lucide-react";

export default function SubmittedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-50 to-white flex flex-col items-center justify-center px-4">
      <div className="card p-10 max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <CheckCircle size={48} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-ink-900 mb-2">Request received!</h1>
        <p className="text-ink-500 mb-8">
          Thanks for reaching out. Elad and Oren will review your request and get
          back to you within 24 hours.
        </p>
        <Link href="/" className="btn-soft justify-center w-full">
          Submit another request
        </Link>
      </div>
    </div>
  );
}

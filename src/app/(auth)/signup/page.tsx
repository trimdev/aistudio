import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center mx-auto mb-3">
          <span className="text-white font-bold">G</span>
        </div>
        <h1 className="text-xl font-semibold text-gray-900">GhostStudio</h1>
        <p className="text-sm text-gray-500 mt-1">Create your free studio account</p>
      </div>
      <SignUp
        appearance={{
          elements: {
            rootBox: "w-full max-w-sm",
            card: "shadow-sm border border-gray-100 rounded-2xl",
            headerTitle: "hidden",
            headerSubtitle: "hidden",
          },
        }}
      />
    </div>
  );
}

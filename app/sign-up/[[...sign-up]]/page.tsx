import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5] py-12">
      <SignUp
        afterSignUpUrl="/dashboard"
        signInUrl="/sign-in"
        appearance={{
          variables: {
            colorPrimary: "#0066ff",
            colorText: "#1a1a1a",
            colorBackground: "#ffffff",
            borderRadius: "0.5rem",
          },
        }}
      />
    </div>
  );
}

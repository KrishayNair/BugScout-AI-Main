import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5] py-12">
      <SignIn
        afterSignInUrl="/dashboard"
        signUpUrl="/sign-up"
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

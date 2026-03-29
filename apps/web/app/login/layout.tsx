import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in or create a free PageAlert account. Monitor any website with AI — track prices, stock, new listings, and more.",
  alternates: { canonical: "https://pagealert.io/login" },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

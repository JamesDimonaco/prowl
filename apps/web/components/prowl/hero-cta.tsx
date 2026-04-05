"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function HeroCTA() {
  const session = authClient.useSession();
  const isLoggedIn = !session.isPending && !!session.data?.user;
  const ctaHref = isLoggedIn ? "/dashboard" : "/login";

  return (
    <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
      <Link href={ctaHref} className={buttonVariants({ size: "lg", className: "gap-2 h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20 w-full sm:w-auto" })}>
        {isLoggedIn ? "Go to Dashboard" : "Start Monitoring Free"}
        <ArrowRight className="h-5 w-5" />
      </Link>
      <a href="#how-it-works" className="w-full sm:w-auto">
        <Button variant="outline" size="lg" className="h-12 px-8 text-base font-medium w-full sm:w-auto">
          See how it works
        </Button>
      </a>
    </div>
  );
}
